import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { KyroClient } from "../../src";
import { KyroApiError, KyroNotFoundError, KyroUnprocessableError, KyroValidationError } from "../../src/core/errors";
import type { AskStreamEvent } from "../../src/core/types";

// ── Live-server gate ───────────────────────────────────────────────────────
//
// The suite self-skips unless a real deployment is provided AND the run was
// started by the dedicated integration runner (issue #22), which sets
// KYRO_TEST_LIVE itself. dotenv loads `.env` for it, so the key can live in
// the file instead of the command line; plain `npm test` never sets the
// switch and never touches the network.
//
// The key variable is strictly KYRO_TEST_API_KEY — never a fallback to
// KYRO_API_KEY (the playground's name), so a repo carrying that name must
// not start live traffic by accident. To run against a live dev stack
// (compose + `pnpm dev:api`):
//
//   export KYRO_TEST_API_KEY=kyro_live_...   # or put it in .env
//   npm run test:integration
//
// Optionally KYRO_TEST_BASE_URL points the client elsewhere.

const API_KEY = process.env.KYRO_TEST_API_KEY;
// Only the integration script sets this; without it the suite cannot open,
// however the key is provided.
const LIVE_RUN = process.env.KYRO_TEST_LIVE === "1";
const BASE_URL = process.env.KYRO_TEST_BASE_URL ?? "http://localhost:3000/api/v1";
const T = 60_000; // generous per-test budget: ingest pipeline + first-hit LLM

const client = new KyroClient({ baseURL: BASE_URL, apiKey: API_KEY ?? "" });

// epoch-tagged names so reruns never collide with leftovers in the org
const epoch = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
const textA = "The quick brown fox jumps over the lazy dog. Kyro is a document storage platform.";
const textB = "Hybrid search combines lexical and vector retrieval using Reciprocal Rank Fusion.";
const matterKey = `M-IT-${epoch}`;

let fileAId = "";
let fileBId = "";
let collectionId = "";
let ragEnabled = true;
// Root-cause capture: when a creator test fails, dependents label themselves
// with it instead of spraying empty-id 404s ("/files//text") across the run.
let uploadCause = "";
let collectionCause = "";

function info(msg: string) {
    console.log(`  [live] ${msg}`);
}
function warn(msg: string) {
    console.warn(`  [live] ${msg}`);
}

/** Best-effort cleanup — logs failures instead of masking test results. */
async function deleteQuietly(label: string, fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (e) {
        warn(`cleanup ${label} failed: ${e instanceof Error ? e.message : String(e)}`);
        return;
    }
    info(`cleanup ${label} deleted`);
}

/** Dependent tests fail with the captured creator error, not empty-id noise. */
function requireFiles(): void {
    if (!fileAId) {
        throw new Error(`prerequisite failed: upload test produced no file ids (${uploadCause || "unknown cause"})`);
    }
}
function requireCollection(): void {
    if (!collectionId) {
        throw new Error(`prerequisite failed: collections.create produced no id (${collectionCause || "unknown cause"})`);
    }
}

describe.skipIf(!API_KEY || !LIVE_RUN)("live Kyro API", () => {
    /** Polls getText() until both uploads reach a terminal pipeline status. */
    async function awaitTerminalFiles(): Promise<void> {
        const deadline = Date.now() + 45_000;
        for (;;) {
            const [a, b] = await Promise.all([
                client.files.getText(fileAId),
                client.files.getText(fileBId),
            ]);
            const terminal = (s: string) => s === "ready" || s === "failed" || s === "skipped";
            if (terminal(a.status) && terminal(b.status)) {
                info(`pipeline statuses: A=${a.status} B=${b.status}`);
                return;
            }
            if (Date.now() > deadline) {
                throw new Error(`ingest pipeline did not settle in 45s (A=${a.status}, B=${b.status})`);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    afterAll(async () => {
        if (collectionId) await deleteQuietly("collection", () => client.collections.delete(collectionId));
        if (fileAId) await deleteQuietly("file A", () => client.files.delete(fileAId));
        if (fileBId) await deleteQuietly("file B", () => client.files.delete(fileBId));
    });

    it("health resolves a well-shaped status", async () => {
        const res = await client.health.getHealth();
        expect(res.status === "ok" || res.status === "degraded").toBe(true);
        expect(res.database === "connected" || res.database === "disconnected").toBe(true);
        expect(typeof res.uptime).toBe("number");
        if (res.status === "degraded") {
            warn(`server reports degraded (database=${res.database}) — continuing, score-dependent flow may find nothing`);
        }
    }, T);

    it("RAG availability probe", async () => {
        try {
            await client.ask({ question: "ping" });
        } catch (e) {
            if (e instanceof KyroValidationError && e.message === "OLLAMA_URL must be configured to use the /ask endpoint") {
                ragEnabled = false;
                warn("RAG is disabled server-side — ask/askStream cases will skip");
                return;
            }
            throw e;
        }
    }, T);

    it("files: uploads two uniquely-named texts", async () => {
        try {
            const a = await client.files.upload(new Blob([textA], { type: "text/plain" }), `kyro-sdk-it-${epoch}-a.txt`);
            expect(a.id).toBeTypeOf("string");
            expect(["pending", "processing"]).toContain(a.status);
            fileAId = a.id;

            const b = await client.files.upload(new Blob([textB], { type: "text/plain" }), `kyro-sdk-it-${epoch}-b.txt`);
            expect(b.id).toBeTypeOf("string");
            fileBId = b.id;
        } catch (e) {
            uploadCause = e instanceof KyroApiError ? `[${e.status}] ${e.message}` : String(e);
            throw e;
        }
    }, T);

    it("files: ingest pipeline settles (extract + embed are automatic)", async () => {
        requireFiles();
        await awaitTerminalFiles();
        const [a, b] = await Promise.all([
            client.files.getText(fileAId),
            client.files.getText(fileBId),
        ]);
        expect(a.status, `file A failed: ${a.error ?? "?"}`).toBe("ready");
        expect(b.status, `file B failed: ${b.error ?? "?"}`).toBe("ready");
    }, T);

    it("files: list answers cursor pagination", async () => {
        const { data, pagination } = await client.files.list(10);
        expect(pagination.limit).toBe(10);
        expect(typeof pagination.hasMore).toBe("boolean");
        expect(pagination.nextCursor === null || typeof pagination.nextCursor === "string").toBe(true);
        expect(Array.isArray(data)).toBe(true);
    }, T);

    it("files: download returns the original bytes", async () => {
        requireFiles();
        const blob = await client.files.download(fileAId);
        expect(blob.size).toBeGreaterThan(0);
    }, T);

    it("metadata: set, merge, and delete a key", async () => {
        requireFiles();
        const set = await client.files.setMetadata(fileAId, { matter_number: matterKey, author: "kyro-it" });
        expect(set).toMatchObject({ matter_number: matterKey, author: "kyro-it" });

        // partial update — the other keys survive
        await client.files.setMetadata(fileAId, { author: "kyro-it-2" });
        const merged = await client.files.getMetadata(fileAId);
        expect(merged).toMatchObject({ matter_number: matterKey, author: "kyro-it-2" });

        await client.files.deleteMetadataKey(fileAId, "author");
        const after = await client.files.getMetadata(fileAId);
        expect(after.matter_number).toBe(matterKey);
        expect(after).not.toHaveProperty("author");
    }, T);

    it("collections: create and read the detail view", async () => {
        try {
            const created = await client.collections.create({
                name:        `kyro-sdk-it-${epoch}`,
                description: "live integration run",
            });
            expect(created.id).toBeTypeOf("string");
            collectionId = created.id;

            const detail = await client.collections.get(collectionId);
            expect(detail.name).toBe(`kyro-sdk-it-${epoch}`);
            expect(detail.fileCount).toBe(0);
            expect(typeof detail.queryReady).toBe("boolean");
        } catch (e) {
            collectionCause = e instanceof KyroApiError ? `[${e.status}] ${e.message}` : String(e);
            throw e;
        }
    }, T);

    it("collections: addFiles, duplicates tolerated", async () => {
        requireCollection();
        const first = await client.collections.addFiles(collectionId, { fileIds: [fileAId, fileBId] });
        expect(first.added).toBe(2);

        const dup = await client.collections.addFiles(collectionId, { fileIds: [fileAId] });
        expect(dup.added).toBe(0);
    }, T);

    it("collections: listFiles offsets over exactly its members", async () => {
        requireCollection();
        const res = await client.collections.listFiles(collectionId);
        expect(res.pagination.total).toBe(2);
        expect(res.pagination.hasMore).toBe(false);
        const ids = res.data.map(f => f.id).sort();
        expect(ids).toEqual([fileAId, fileBId].sort());
    }, T);

    it("collections: queryReady flips once members are embedded", async () => {
        requireCollection();
        const detail = await client.collections.get(collectionId);
        expect(detail.queryReady, `embedded=${detail.embeddedCount}/${detail.fileCount}`).toBe(true);
    }, T);

    it("search: org-wide retrieves the ingested text", async () => {
        requireFiles();
        const res = await client.search({ query: "quick brown fox", limit: 20 });
        const rows = res.data.filter(d => d.fileId === fileAId);
        expect(rows.length, `no row for file A among ${res.data.length} results`).toBeGreaterThan(0);
        expect(rows.every(r => r.rrfScore > 0)).toBe(true);
        expect(rows.some(r => r.content.includes("quick brown fox"))).toBe(true);
        expect(res.limit).toBe(20);
    }, T);

    it("search: collection scope is rectified to its members", async () => {
        requireFiles();
        requireCollection();
        const res = await client.search({
            query:        "quick brown fox",
            collectionId: collectionId,
        });
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data.every(d => d.fileId === fileAId || d.fileId === fileBId)).toBe(true);
        expect(res.data.some(d => d.fileId === fileAId)).toBe(true);
    }, T);

    it("search: fileIds scope stays within the requested files", async () => {
        requireFiles();
        const res = await client.search({
            query:   "Reciprocal Rank Fusion",
            fileIds: [fileBId],
        });
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data.every(d => d.fileId === fileBId)).toBe(true);
    }, T);

    it("search: metadata filters exclude unmarked files", async () => {
        // file B carries no metadata — the filter must exclude it entirely
        requireFiles();
        const res = await client.search({
            query:   "quick brown fox",
            filters: { matter_number: matterKey },
        });
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data.every(d => d.fileId === fileAId)).toBe(true);
    }, T);

    it("collections: removeFile takes effect", async () => {
        requireFiles();
        requireCollection();
        await client.collections.removeFile(collectionId, fileBId);
        const res = await client.collections.listFiles(collectionId);
        expect(res.pagination.total).toBe(1);
        expect(res.data[0]?.id).toBe(fileAId);
    }, T);

    it("ask: buffered answer grounded in the collection", async (ctx) => {
        if (!ragEnabled) { ctx.skip(); return; }
        requireCollection();
        const res = await client.ask({
            question:     "What animal is mentioned in the text?",
            collectionId: collectionId,
        });
        expect(res.sources.some(s => s.fileId === fileAId), `sources: ${JSON.stringify(res.sources.map(s => s.fileId))}`).toBe(true);
        expect(res.answer.length).toBeGreaterThan(0);
        info(`answer: ${res.answer}`);
    }, T);

    it("ask: history follow-up carries the thread", async (ctx) => {
        if (!ragEnabled) { ctx.skip(); return; }
        requireCollection();
        const res = await client.ask({
            question:     "What color is that animal?",
            collectionId: collectionId,
            history: [
                { role: "user",      content: "What animal is mentioned in the text?" },
                { role: "assistant", content: "The text mentions a fox." },
            ],
        });
        expect(res.answer.length).toBeGreaterThan(0);
        info(`answer: ${res.answer}`);
    }, T);

    it("askStream: sources first, chunks, then a terminal done", async (ctx) => {
        if (!ragEnabled) { ctx.skip(); return; }
        requireCollection();
        const events: AskStreamEvent[] = [];
        for await (const event of client.askStream({
            question:     "Summarise the text.",
            collectionId: collectionId,
        })) {
            events.push(event);
            if (event.type === "error") {
                throw new Error(`in-band stream error: ${event.message}`);
            }
        }
        expect(events.length).toBeGreaterThan(0);
        expect(events[0]?.type).toBe("sources");
        expect(events[events.length - 1]?.type).toBe("done");
        expect(events.some(e => e.type === "chunk")).toBe(true);
        info(`${events.filter(e => e.type === "chunk").length} chunk event(s)`);
    }, T);

    it("negative: unknown collection or fileIds scope to a typed 404", async () => {
        const col = await client.search({ query: "x", collectionId: crypto.randomUUID() }).catch((e: unknown) => e);
        expect(col).toBeInstanceOf(KyroNotFoundError);
        expect((col as KyroApiError).status).toBe(404);

        // rag/scope.ts resolves fileIds the same way — no owned id -> 404
        const fil = await client.search({ query: "x", fileIds: [crypto.randomUUID()] }).catch((e: unknown) => e);
        expect(fil).toBeInstanceOf(KyroNotFoundError);
        expect((fil as KyroApiError).status).toBe(404);
    }, T);

    it("negative: metadata filters matching nothing resolve to a typed 422", async () => {
        // a key no file will ever carry, so the answer is 422 in every state
        const err = await client.search({
            query:   "x",
            filters: { matter_number: `no-such-metadata-${epoch}` },
        }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(KyroUnprocessableError);
        expect((err as KyroApiError).status).toBe(422);
    }, T);

    it("negative: mutual exclusion throws client-side before any request", async () => {
        await expect(
            client.search({ query: "x", collectionId: "c", fileIds: ["f"] })
        ).rejects.toBeInstanceOf(TypeError);
        await expect(
            client.ask({ question: "x", collectionId: "c", fileIds: ["f"] })
        ).rejects.toBeInstanceOf(TypeError);
        const iter = client.askStream({ question: "x", collectionId: "c", fileIds: ["f"] });
        await expect(iter.next()).rejects.toBeInstanceOf(TypeError);
    }, T);
});
