# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/); this project adheres to
[Semantic Versioning](https://semver.org/).

## 2.0.0 — 2026-11-13

Realignment of the SDK to the current Kyro API. The API serves `/api/v1` only,
and the surface changed substantially; everything below is breaking. Migration
notes at the bottom.

### Removed

- **BM25 keyword search and vector-only semantic search** — the server exposes
  one hybrid retrieval endpoint (pgvector + ts_rank fused with Reciprocal Rank
  Fusion, k = 60). The separate `search` / `semanticSearch` file methods and
  the `minScore` option are gone (#5, #6).
- **`files.ask()`** — asking moved to the client: `kyro.ask()` and
  `kyro.askStream()` (#7).
- **The `stream` option on ask** — streaming is its own method (`askStream`),
  not a flag; the buffered `ask` always resolves with `{ answer, sources }` (#7).
- **Manual extraction / embedding triggers** — upload runs extraction and
  embedding automatically; `files.reprocess()` re-runs the whole pipeline (#5).

### Changed

- **Base path** (#3): the client defaults to `https://api.kyro.io/api/v1`.
  A `baseURL` containing `/api/` is used as-is; anything else gets `/api/v1`
  appended; trailing slashes are trimmed.
- **`FileStatus`** (#4): one pipeline enum — `pending | processing | ready |
  failed | skipped` — because extraction and embedding share the ingest
  pipeline's single `status` column.
- **`kyro.search()`** (#6, #10): top-level client method. Scope by
  `collectionId` XOR `fileIds` — passing both throws a client-side `TypeError`
  before any request. `filters` AND across keys, OR across values, and combine
  with either scope. `limit` defaults to 10 (server cap 50). Results are
  chunk-level rows with `rrfScore` (small by design, higher is better, no
  minimum-score filter).
- **`kyro.ask()` / `kyro.askStream()`** (#7): client methods with the new wire
  schema — `question` (1–2000 chars), `collectionId` XOR `fileIds` (max 20,
  mutual exclusion enforced client-side), `filters`, `topK` (1–20, default 8),
  optional `model`, and `history` (`AskTurn[]`, up to 10 prior turns) for
  follow-ups. No `minScore`, no `stream` flag.
- **`AskStreamEvent`** (#7): a four-event union — one `sources` event opens
  the stream, `chunk` events carry answer text, `done` closes it, and an
  in-band `error` event signals mid-stream failure.
- **Pagination** (#5, #8): `files.list()` is cursor-paginated
  (`pagination: { limit, hasMore, nextCursor }`); collections `listFiles()`
  is offset-paginated (`pagination: { total, limit, offset, hasMore }`);
  collection lookup by slug is gone — use ids.
- **Errors** (#9, #10): full typed hierarchy — `KyroAuthError` (401),
  `KyroForbiddenError` (403), `KyroNotFoundError` (404), `KyroConflictError`
  (409), `KyroValidationError` (400), `KyroFileTooLargeError` (413),
  `KyroUnsupportedMediaTypeError` (415), `KyroUnprocessableError` (422),
  `KyroRateLimitError` (429, with `retryAfter`), `KyroStorageLimitError`
  (507), `KyroServiceUnavailableError` (503), catch-all `KyroApiError`. A
  degraded server resolves `health.getHealth()` with `status: "degraded"`
  instead of throwing.
- **Health** (#9): served at the deployment root (`/health`, outside the API
  base path — the client handles this); the `redis` field is gone.

### Added

- **`collections`** (#8): create / get / update / delete, `addFiles` and
  `removeFile`, `listFiles` with per-file pipeline status, and a detail view
  carrying `fileCount` / `embeddedCount` / `pendingCount` / `failedCount` and
  the `queryReady` flag.
- **`files`** (#4, #5): `getText` (status + extracted text), metadata
  `setMetadata` (non-destructive upsert) / `getMetadata` / `deleteMetadataKey`,
  `download`, `reprocess`.
- **`history`** (#7): replay up to 10 prior user/assistant turns on `ask` so
  follow-up questions resolve against the thread.

### Fixed

- **`rrfScore` now always arrives as a `number`** — the API computes it in
  Postgres as `numeric`, which reaches the wire as a string
  (`"0.03226645849596669269"`), so consumer code doing `.toFixed()` or
  numeric comparisons crashed on live data. Scores are coerced on arrival
  in `search()`, `ask()` and `askStream()` (`rerankScore` likewise when
  present). Found by the pre-publish consumer simulation against the live
  API (KYR-17).

### Packaging

- Runtime `dependencies` are now **empty** — the SDK core is dependency-free
  (`chalk` / `dotenv` were dev-only) (#12).
- Added an `exports` map, `engines: { node: ">=18" }` (global `fetch`), and
  `files: ["dist"]` — the tarball ships the built surface only (#12).
- The build now emits **CommonJS** matching the package's declared
  `"type": "commonjs"` — prior builds emitted ESM syntax that Node could not
  load under `require()` or `import()`; bundlers were unaffected (#12).

### Migration notes

- Replace removed file-method calls: `kyro.search()` and `kyro.ask()` are now
  client methods scoped by `collectionId` / `fileIds`.
- Drop `stream: true`; consume `kyro.askStream()` and its event union instead.
- Drop `minScore`; if you need a score floor, filter `rrfScore` client-side.
- Drop manual extraction steps; poll `files.getText().status` until it leaves
  `pending` / `processing`.
- Point `baseURL` at a `/api/v1` deployment (or omit it entirely).
- Node.js >= 18 is required.
