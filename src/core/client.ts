import { HttpClient } from "./http";
import type {
  AskInput,
  AskResponse,
  AskStreamEvent,
  RetrievalSource,
  SDKConfig,
  SearchInput,
  SearchResponse,
} from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";
import { CollectionsService } from "../services/collections";

/**
 * The wire carries the RRF score as a string: the API computes it in SQL as
 * `1.0 / (k + rank)`, a Postgres `numeric`, which the pg driver serializes as
 * text — "0.03226645849596669269" was observed live. The documented contract
 * (and every doc example) is `number`, so scores are coerced on arrival.
 * `Number()` is a no-op on real numbers, so a server-side column-type fix
 * later stays transparent.
 */
function normalizeSource(source: RetrievalSource): RetrievalSource {
    const rrfScore    = typeof (source.rrfScore as number | string) === "string"
        ? Number(source.rrfScore)
        : source.rrfScore;
    const rerankScore = typeof (source.rerankScore as number | string | undefined) === "string"
        ? Number(source.rerankScore)
        : source.rerankScore;
    return { ...source, rrfScore, ...(rerankScore !== undefined ? { rerankScore } : {}) };
}

function normalizeSources(sources: RetrievalSource[]): RetrievalSource[] {
    return sources.map(normalizeSource);
}

/** Normalizes a stream's `sources` frame; every other event passes through untouched. */
function normalizeEvent(event: AskStreamEvent): AskStreamEvent {
    return event.type === "sources"
        ? { ...event, sources: normalizeSources(event.sources) }
        : event;
}

export class KyroClient {
    private http: HttpClient;
    private baseURL: string;

    public health:       HealthService;
    public files:        FilesService;
    public collections:  CollectionsService;

    constructor(config: SDKConfig) {
        if (config.baseURL) {
            // Trim trailing slashes first, so both "http://localhost:3000/"
            // and "http://localhost:3000/api/v1/" resolve cleanly. A baseURL
            // that already points at an API path is used as-is; anything else
            // gets the (only) API version path appended.
            const base = config.baseURL.replace(/\/+$/, "");
            this.baseURL = base.includes("/api/")
                ? base
                : `${base}/api/v1`;
        } else {
            this.baseURL = "https://api.kyro.io/api/v1";
        }

        this.http = new HttpClient(this.baseURL, config.apiKey);

        this.health      = new HealthService(this.baseURL);
        this.files       = new FilesService(this.http);
        this.collections = new CollectionsService(this.http);
    }

    /**
     * Hybrid retrieval — pgvector + ts_rank fused with Reciprocal Rank
     * Fusion (k = 60). RRF scale: ~0.016 = rank #1 in one arm, ~0.008 =
     * rank #60 in one arm, ~0.032 = rank #1 in both arms; higher is better.
     * There is no minimum-score filter.
     *
     * Scope: `collectionId` XOR `fileIds` — providing both throws
     * client-side; `filters` combines with either. `limit` defaults to 10
     * and the server caps it at 50.
     *
     * Throws:
     * - `KyroNotFoundError` (404) — a scoped collection or file does not
     *   exist in this organisation
     * - `KyroUnprocessableError` (422) — the scope resolves to nothing
     * - `KyroValidationError` (400) — invalid filters shape or empty query
     */
    async search(input: SearchInput): Promise<SearchResponse> {
        if (input.collectionId && input.fileIds?.length) {
            throw new TypeError("collectionId and fileIds are mutually exclusive — provide either, not both");
        }

        const params = new URLSearchParams({ q: input.query });
        if (input.limit !== undefined)        params.append("limit",         input.limit.toString());
        if (input.collectionId !== undefined) params.append("collection_id", input.collectionId);
        if (input.fileIds?.length)            params.append("file_ids",      input.fileIds.join(","));
        // URLSearchParams percent-encodes on toString() — JSON.stringify is
        // the only encoding done here.
        if (input.filters && Object.keys(input.filters).length > 0) {
            params.append("filters", JSON.stringify(input.filters));
        }

        const res = await this.http.get<SearchResponse>(`/search?${params}`, "apiKey");
        return { ...res, data: normalizeSources(res.data) };
    }

    /**
     * Document-grounded Q&A — POST /ask, non-streaming. Always sends
     * `stream: false`; use {@link KyroClient.askStream} for the SSE mode.
     * Retrieval is the same hybrid search as {@link KyroClient.search}
     * (RRF-fused chunks, no minimum-score filter). The server returns a
     * 400 with a verbatim hint when RAG itself is not configured.
     *
     * Scope: `collectionId` XOR `fileIds` — providing both throws
     * client-side; `filters` combines with either. `history` replays up to
     * 10 prior user/assistant turns so follow-up questions resolve against
     * the thread.
     *
     * Throws:
     * - `KyroValidationError` (400) — invalid input (`details` carries the
     *   per-field messages, e.g. a question over 2000 chars or more than
     *   10 history turns), or RAG is not configured on the server
     * - `KyroNotFoundError` (404) — a scoped collection or file does not
     *   exist in this organisation
     * - `KyroUnprocessableError` (422) — the scope resolves to nothing
     */
    async ask(input: AskInput): Promise<AskResponse> {
        this.assertAskScope(input);

        const res = await this.http.post<AskResponse>("/ask", { ...input, stream: false }, "apiKey");
        return { ...res, sources: normalizeSources(res.sources) };
    }

    /**
     * Document-grounded Q&A — POST /ask with `stream: true`, yielding the
     * server's SSE frames as they arrive: one `sources` event opens the
     * stream, then `chunk` events carry the answer and a trailing `done`
     * closes it. If the LLM fails after the stream is open, the failure
     * arrives as an `error` event — the status code is moot at that point.
     * Pre-stream failures (invalid input, scope errors, RAG not
     * configured) throw the same errors as {@link KyroClient.ask}.
     *
     * Scope/mutual-exclusion semantics: see {@link KyroClient.ask}.
     */
    async *askStream(input: AskInput): AsyncGenerator<AskStreamEvent> {
        this.assertAskScope(input);

        const res = await this.http.getRawResponse(
            "/ask",
            { method: "POST", body: JSON.stringify({ ...input, stream: true }) },
            "apiKey"
        );

        if (!res.body) {
            throw new Error("No response body for streaming ask");
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;
                    const json = trimmed.slice(5).trim();
                    if (!json) continue;
                    try {
                        // Frames are single-line JSON (what the server
                        // writes); multi-line data is never concatenated.
                        yield normalizeEvent(JSON.parse(json) as AskStreamEvent);
                    } catch {
                        // malformed SSE line — skip
                    }
                }
            }

            // flush a final frame that lacks the terminating blank line
            if (buffer.trim().startsWith("data:")) {
                const json = buffer.trim().slice(5).trim();
                if (json) {
                    try {
                        yield normalizeEvent(JSON.parse(json) as AskStreamEvent);
                    } catch { /* ignore */ }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /** Both ask modes accept only one retrieval scope — mirrors search(). */
    private assertAskScope(input: AskInput): void {
        if (input.collectionId && input.fileIds?.length) {
            throw new TypeError("collectionId and fileIds are mutually exclusive — provide either, not both");
        }
    }
}
