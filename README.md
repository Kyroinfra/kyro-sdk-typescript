# Kyro TypeScript SDK

<!-- To run test -->
<!-- npx tsx playground/test.ts -->

The official TypeScript SDK for [Kyro](https://kyro-henna.vercel.app) — file storage, text extraction, semantic search, and RAG in one API.

## Installation

```bash
npm i @kyroinfra/kyro
```

## Quick Start

```ts
import { KyroClient } from "kyro-sdk";

const kyro = new KyroClient({
  baseURL: "https://your-kyro-instance.com/api/v2", // For Server URL
  apiKey: "kyro_live_...",
});

const file = await kyro.files.upload(blob, "report.pdf");

const { answer, sources } = await kyro.files.ask({
  question: "What are the key findings?",
  stream: false,
});
```


## Typical Workflow

```ts
// 1. Upload
const file = await kyro.files.upload(pdfBlob, "agreement.pdf");

// 2. Tag with metadata
await kyro.files.setMetadata(file.id, {
  document_type: "contract",
  matter_number: "M-2024-001",
});

// 3. Add to a collection
await kyro.collections.addFiles(collectionId, { fileIds: [file.id] });

// 4. Wait for embedding (poll or use webhooks)
let status = (await kyro.files.getText(file.id)).extractionStatus;
while (status !== "completed") {
  await new Promise(r => setTimeout(r, 2000));
  status = (await kyro.files.getText(file.id)).extractionStatus;
}
await kyro.files.embed(file.id);

// 5. Ask questions
const { answer } = await kyro.files.ask({
  question:     "What are the termination conditions?",
  collectionId: collectionId,
  stream:       false,
});
```


<details>
<summary><strong>Initialization</strong></summary>

```ts
const kyro = new KyroClient({
  apiKey:  "kyro_live_...",   // required
  baseURL: "https://...",     // optional — defaults to https://api.kyro.io
  version: "v2",              // optional — "v1" | "v2", defaults to "v2"
});
```

</details>


<details>
<summary><strong>Files</strong></summary>

### Upload

```ts
const file = await kyro.files.upload(blob, "contract.pdf");
// file.id, file.extractionStatus ("pending" | "completed" | "skipped")
```

Supported types: PDF, DOCX, TXT. Other types are stored but not extracted.

### List

```ts
const { data, pagination } = await kyro.files.list(50);

// Next page
if (pagination.hasMore) {
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

### Full-text search (BM25)

```ts
const { data } = await kyro.files.search("indemnification clause");
// data[i].headline — snippet with <mark> highlights
```

</details>


<details>
<summary><strong>Text Extraction</strong></summary>

Text is extracted automatically on upload when Redis is available. You can also trigger it manually or poll for status.

### Check status

```ts
const { extractionStatus, extractedText } = await kyro.files.getText(fileId);
// extractionStatus: "pending" | "processing" | "completed" | "failed" | "skipped"
```

### Trigger manually

```ts
await kyro.files.triggerExtraction(fileId);
// Poll getText() until extractionStatus === "completed"
```

</details>


<details>
<summary><strong>Embeddings</strong></summary>

Embeddings are required before semantic search or `/ask` will return results for a file.

```ts
const { chunksCreated, embeddingStatus } = await kyro.files.embed(fileId);
```

Requires `OLLAMA_URL` to be configured on the server.

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
const { data } = await kyro.collections.listFiles(collectionId);
// data[i].embeddingStatus — per-file embedding state
```

### Remove a file

```ts
await kyro.collections.removeFile(collectionId, fileId);
```

</details>


<details>
<summary><strong>Semantic Search</strong></summary>

Hybrid BM25 + vector search with Reciprocal Rank Fusion.

### Org-wide

```ts
const { data } = await kyro.files.semanticSearch({
  query:    "force majeure clause",
  limit:    10,
  minScore: 0.01,
});
// data[i]: { fileId, fileName, chunkIndex, content, rrfScore }
```

### Scoped to a collection

```ts
const { data } = await kyro.files.semanticSearch({
  query:        "termination rights",
  collectionId: collectionId,
});
```

### Scoped to specific files

```ts
const { data } = await kyro.files.semanticSearch({
  query:   "payment terms",
  fileIds: [fileId1, fileId2],
});
```

</details>


<details>
<summary><strong>Ask (RAG)</strong></summary>

Send a natural language question and get an answer grounded in your documents, with source citations.

### Non-streaming

```ts
const { answer, sources } = await kyro.files.ask({
  question: "What is the total contract value across all agreements?",
  stream:   false,
});

console.log(answer);
// sources[i]: { fileId, fileName, chunkIndex, content, rrfScore }
```

### Streaming

```ts
for await (const event of kyro.files.askStream({ question: "Summarise the key risks." })) {
  switch (event.type) {
    case "sources": console.log("Sources:", event.sources); break;
    case "chunk":   process.stdout.write(event.text);       break;
    case "done":    console.log("\nDone");                  break;
    case "error":   console.error("Error:", event.message); break;
  }
}
```

### Scoped to a collection

```ts
const { answer } = await kyro.files.ask({
  question:     "What are the payment terms?",
  collectionId: collectionId,
  stream:       false,
});
```

### Scoped to specific files

```ts
const { answer } = await kyro.files.ask({
  question: "Who are the parties?",
  fileIds:  [fileId1, fileId2],
  stream:   false,
});
```

### Filtered by metadata

```ts
const { answer } = await kyro.files.ask({
  question: "List all indemnification obligations.",
  filters: {
    document_type: "contract",
    matter_number: ["M-2024-001", "M-2024-002"],  // OR match
  },
  stream: false,
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `question` | `string` | — | The question to answer |
| `collectionId` | `string` | — | Scope to a collection. Mutually exclusive with `fileIds` |
| `fileIds` | `string[]` | — | Scope to specific files. Mutually exclusive with `collectionId` |
| `filters` | `object` | — | Metadata key-value filters. Can combine with `collectionId` or `fileIds` |
| `topK` | `number` | `8` | Number of chunks to retrieve |
| `minScore` | `number` | `0` | Minimum RRF score threshold |
| `model` | `string` | server default | Ollama model override |
| `stream` | `boolean` | `true` | Whether to stream the response |

</details>


<details>
<summary><strong>Error Handling</strong></summary>

All methods throw typed errors you can catch and inspect:

```ts
import {
  KyroApiError,
  KyroAuthError,
  KyroNotFoundError,
  KyroRateLimitError,
  KyroQuotaError,
  KyroValidationError,
} from "kyro-sdk";

try {
  await kyro.files.upload(blob, "file.pdf");
} catch (err) {
  if (err instanceof KyroAuthError) {
    // 401 — invalid or missing API key
  } else if (err instanceof KyroQuotaError) {
    // 403 — storage quota exceeded
  } else if (err instanceof KyroNotFoundError) {
    // 404 — file or resource not found
  } else if (err instanceof KyroRateLimitError) {
    // 429 — slow down; err.retryAfter is seconds to wait
    setTimeout(retry, err.retryAfter * 1000);
  } else if (err instanceof KyroValidationError) {
    // 400 — bad input; err.details has per-field messages
    console.error(err.details);
  } else if (err instanceof KyroApiError) {
    // catch-all for any other API error
    console.error(err.status, err.code, err.message);
  }
}
```

</details>


<details>
<summary><strong>Health</strong></summary>

```ts
const { status, database, redis } = await kyro.health.getHealth();
// status: "ok" | "degraded"
```

</details>
