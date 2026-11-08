# Kyro TypeScript SDK

<!-- To run test -->
<!-- npx tsx playground/test.ts -->

The official TypeScript SDK for [Kyro](https://kyro-henna.vercel.app) — file storage, text extraction, hybrid search, and RAG in one API.

## Installation

```bash
npm i @kyroinfra/kyro
```

## Quick Start

```ts
import { KyroClient } from "@kyroinfra/kyro";

const kyro = new KyroClient({
  baseURL: "https://your-kyro-instance.com/api/v1", // For Server URL
  apiKey:  "kyro_live_...",
});

const file = await kyro.files.upload(blob, "report.pdf");

const { answer, sources } = await kyro.ask({
  question: "What are the key findings?",
  fileIds:  [file.id],
});

console.log(answer);
```


## Typical Workflow

```ts
import { KyroClient } from "@kyroinfra/kyro";

const kyro = new KyroClient({
  apiKey: "kyro_live_...", // https://api.kyro.io/api/v1 is assumed when baseURL is omitted
});

// 1. Upload — extraction and embedding run automatically
const file = await kyro.files.upload(pdfBlob, "agreement.pdf");

// 2. Wait for the pipeline to settle
let status = (await kyro.files.getText(file.id)).status;
while (status === "pending" || status === "processing") {
  await new Promise(r => setTimeout(r, 2000));
  status = (await kyro.files.getText(file.id)).status;
}

// 3. Tag with metadata
await kyro.files.setMetadata(file.id, {
  document_type: "contract",
  matter_number: "M-2024-001",
});

// 4. Group files into a collection
const collection = await kyro.collections.create({
  name: "Q4 Contracts",
});
await kyro.collections.addFiles(collection.id, { fileIds: [file.id] });

// 5. Hybrid search
const results = await kyro.search({
  query:        "termination conditions",
  collectionId: collection.id,
});
console.log(results.data[0]?.rrfScore);

// 6. Ask grounded questions
const { answer, sources } = await kyro.ask({
  question:     "What are the termination conditions?",
  collectionId: collection.id,
});
```


<details>
<summary><strong>Initialization</strong></summary>

```ts
const kyro = new KyroClient({
  apiKey:  "kyro_live_...",   // required
  baseURL: "https://...",     // optional — defaults to https://api.kyro.io/api/v1
});
```

Base path rules:
- A `baseURL` that already contains `/api/` is used as-is (e.g. `https://example.com/api/v1`)
- Anything else gets `/api/v1` appended (`https://example.com` → `https://example.com/api/v1`)
- Trailing slashes are trimmed

</details>


<details>
<summary><strong>Files</strong></summary>

### Upload

```ts
const file = await kyro.files.upload(blob, "contract.pdf");
// file.id, file.status ("pending" | "processing" | "ready" | "failed" | "skipped")
```

Supported types: PDF, DOCX, TXT. Other types are stored but not extracted.

### List (cursor pagination)

```ts
const { data, pagination } = await kyro.files.list(50);

// Next page
if (pagination.hasMore && pagination.nextCursor) {
  const next = await kyro.files.list(50, pagination.nextCursor);
}
```

### Download

```ts
const blob = await kyro.files.download(fileId);
```

### Delete

```ts
await kyro.files.delete(fileId);
```

</details>


<details>
<summary><strong>Text Extraction</strong></summary>

Extraction runs automatically on upload — together with embedding. Poll `getText()` for progress, or reprocess to re-run the whole pipeline.

### Check status / read the text

```ts
const { status, extractedText } = await kyro.files.getText(fileId);
// status: "pending" | "processing" | "ready" | "failed" | "skipped"
```

### Re-run the pipeline

```ts
await kyro.files.reprocess(fileId);
// Sets the file back to "pending" and re-runs extraction + embedding
```

</details>


<details>
<summary><strong>Metadata</strong></summary>

Arbitrary key-value metadata per file. Useful for filtering in search and `/ask`.

### Set (upsert)

```ts
await kyro.files.setMetadata(fileId, {
  matter_number: "M-2024-001",
  document_type: "contract",
  counterparty:  "Acme Corp",
});
```

Non-destructive — keys not in the payload are left untouched.

### Get

```ts
const meta = await kyro.files.getMetadata(fileId);
// { matter_number: "M-2024-001", document_type: "contract", ... }
```

### Delete a key

```ts
await kyro.files.deleteMetadataKey(fileId, "counterparty");
```

</details>


<details>
<summary><strong>Collections</strong></summary>

A collection is a named group of files — useful for scoping search and `/ask` to a project, matter, or product area.

### Create

```ts
const collection = await kyro.collections.create({
  name:        "Q4 Contracts",
  description: "All contracts signed in Q4 2024",
});
```

### List

```ts
const collections = await kyro.collections.list();
// Each item includes fileCount, embeddedCount, pendingCount, failedCount
```

### Get (with embedding status summary)

```ts
const col = await kyro.collections.get(collectionId);
// col.queryReady — true when all files are embedded and ready to search
```

### Update

```ts
await kyro.collections.update(collectionId, { name: "Q4 Agreements" });
```

### Delete

```ts
await kyro.collections.delete(collectionId);
// Does not delete the files themselves
```

### Add files

```ts
await kyro.collections.addFiles(collectionId, {
  fileIds: [fileId1, fileId2],
});
```

### List files in a collection

```ts
const { data, pagination } = await kyro.collections.listFiles(collectionId, 20, 0);
// offset-paginated: pagination is { total, limit, offset, hasMore }
// data[i].status — per-file pipeline status
```

### Remove a file

```ts
await kyro.collections.removeFile(collectionId, fileId);
```

</details>


<details>
<summary><strong>Search</strong></summary>

Hybrid retrieval — pgvector + ts_rank fused with Reciprocal Rank Fusion (k = 60). Results are chunk-level: `data[i]` is `{ fileId, fileName, chunkIndex, content, rrfScore, rerankScore? }`.

RRF scores are small by design: ~0.016 = rank #1 in one arm, ~0.032 = rank #1 in both arms. Higher is better; there is no minimum-score filter.

### Org-wide

```ts
const { data, query, limit } = await kyro.search({ query: "force majeure clause" });
```

### Scoped to a collection — or to specific files

`collectionId` and `fileIds` are mutually exclusive (both together throw a `TypeError` client-side):

```ts
await kyro.search({
  query:        "termination rights",
  collectionId: collectionId,
});

await kyro.search({
  query:   "payment terms",
  fileIds: [fileId1, fileId2],
});
```

### Filtered by metadata

```ts
const res = await kyro.search({
  query: "indemnification obligations",
  filters: {
    document_type: "contract",                     // exact match
    matter_number: ["M-2024-001", "M-2024-002"],   // OR match
  },
});
```

`filters` combines with either scope. They AND across keys, OR across values.

| Option | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | — | What to retrieve |
| `limit` | `number` | `10` | Max results (the server caps this at 50) |
| `collectionId` | `string` | — | Scope to a collection. Mutually exclusive with `fileIds` |
| `fileIds` | `string[]` | — | Scope to specific files. Mutually exclusive with `collectionId` |
| `filters` | `object` | — | Metadata filters, as above |

</details>


<details>
<summary><strong>Ask (RAG)</strong></summary>

Send a natural language question and get an answer grounded in the retrieved chunks, with source citations. Requires `OLLAMA_URL` on the server — otherwise the API answers 400 (`OLLAMA_URL must be configured to use the /ask endpoint`).

### Buffered

```ts
const { answer, sources } = await kyro.ask({
  question:     "What is the total contract value across all agreements?",
  collectionId: collectionId,
});
// sources[i]: { fileId, fileName, chunkIndex, content, rrfScore }
```

### Streaming

```ts
for await (const event of kyro.askStream({ question: "Summarise the key risks." })) {
  switch (event.type) {
    case "sources": console.log("Sources:", event.sources); break;
    case "chunk":   process.stdout.write(event.text);       break;
    case "done":    console.log("\nDone");                  break;
    case "error":   console.error("Error:", event.message); break;
  }
}
```

One `sources` event opens the stream, `chunk` events carry the answer text, `done` closes it. If the LLM fails mid-stream, the failure arrives as an `error` event.

### Scoped to specific files

```ts
const { answer } = await kyro.ask({
  question: "Who are the parties?",
  fileIds:  [fileId1, fileId2],
});
```

### Filtered by metadata

```ts
const { answer } = await kyro.ask({
  question: "List all indemnification obligations.",
  filters: {
    document_type: "contract",
    matter_number: ["M-2024-001", "M-2024-002"],  // OR match
  },
});
```

### Follow-up questions (history)

Replay recent turns so follow-ups resolve against the thread — they are read-only context and never affect retrieval:

```ts
const { answer } = await kyro.ask({
  question:     "Who are the parties?",
  collectionId: collectionId,
});

const followUp = await kyro.ask({
  question:     "Which of them indemnifies the other?",
  collectionId: collectionId,
  history: [
    { role: "user",      content: "Who are the parties?" },
    { role: "assistant", content: answer },
  ],
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `question` | `string` | — | The question to answer (1–2000 chars) |
| `collectionId` | `string` | — | Scope to a collection. Mutually exclusive with `fileIds` |
| `fileIds` | `string[]` | — | Scope to specific files (max 20). Mutually exclusive with `collectionId` |
| `filters` | `object` | — | Metadata filters. AND across keys, OR across values |
| `topK` | `number` | `8` | Number of chunks to retrieve (1–20) |
| `model` | `string` | server default | Ollama model override |
| `history` | `AskTurn[]` | — | Up to 10 prior user/assistant turns for follow-ups |

</details>


<details>
<summary><strong>Error Handling</strong></summary>

All methods throw typed errors you can catch and inspect. Wrong *SDK usage* throws before any request is made — e.g. passing both `collectionId` and `fileIds` to `kyro.search`/`kyro.ask` raises a plain `TypeError`.

```ts
import {
  KyroApiError,
  KyroAuthError,
  KyroConflictError,
  KyroFileTooLargeError,
  KyroForbiddenError,
  KyroNotFoundError,
  KyroRateLimitError,
  KyroServiceUnavailableError,
  KyroStorageLimitError,
  KyroUnprocessableError,
  KyroUnsupportedMediaTypeError,
  KyroValidationError,
} from "@kyroinfra/kyro";

try {
  await kyro.files.upload(blob, "file.pdf");
} catch (err) {
  if (err instanceof KyroAuthError) {
    // 401 — invalid or missing API key
  } else if (err instanceof KyroForbiddenError) {
    // 403 — the API key lacks the required scope
  } else if (err instanceof KyroStorageLimitError) {
    // 507 — deployment storage cap reached
  } else if (err instanceof KyroNotFoundError) {
    // 404 — file or resource not found
  } else if (err instanceof KyroRateLimitError) {
    // 429 — slow down; err.retryAfter is the wait in seconds
    if (err.retryAfter) setTimeout(retry, err.retryAfter * 1000);
  } else if (err instanceof KyroValidationError) {
    // 400 — bad input; err.details has per-field messages
    console.error(err.details);
  } else if (err instanceof KyroConflictError) {
    // 409 — a duplicate or conflicting resource
  } else if (err instanceof KyroFileTooLargeError) {
    // 413 — upload exceeds the size limit
  } else if (err instanceof KyroUnsupportedMediaTypeError) {
    // 415 — unsupported content type (err.data.supportedTypes)
  } else if (err instanceof KyroUnprocessableError) {
    // 422 — the requested scope resolves to nothing
  } else if (err instanceof KyroServiceUnavailableError) {
    // 503 — server busy or a degraded dependency
  } else if (err instanceof KyroApiError) {
    // catch-all for anything unexpected
    console.error(err.status, err.code, err.message);
  }
}
```

</details>


<details>
<summary><strong>Health</strong></summary>

```ts
const { status, database } = await kyro.health.getHealth();
// status: "ok" | "degraded"
```

A degraded server answers 503 with a normal body — this resolves rather than throwing, so branch on `status`.

</details>
