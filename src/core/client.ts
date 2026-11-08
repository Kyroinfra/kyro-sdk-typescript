import { HttpClient } from "./http";
import type { SDKConfig, SearchInput, SearchResponse } from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";
import { CollectionsService } from "../services/collections";

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

        return this.http.get<SearchResponse>(`/search?${params}`, "apiKey");
    }
}
