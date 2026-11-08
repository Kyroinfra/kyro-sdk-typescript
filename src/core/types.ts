// ── SDK Config ────────────────────────────────────────────────────────────────

export interface SDKConfig {
  apiKey: string;
  baseURL?: string;
}

// ── Shared ────────────────────────────────────────────────────────────────────

/**
 * The single file lifecycle status. Extraction and embedding run inside the
 * same ingest pipeline, so the server keeps one `status` column with these
 * five values.
 */
export type FileStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "skipped";

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

// ── Files ─────────────────────────────────────────────────────────────────────

/**
 * A file record as the API returns it. Named `FileRecord` — not `File` — to
 * avoid colliding with the DOM `File` accepted by `files.upload()`.
 */
export interface FileRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  status: FileStatus;
}

/** Row of `GET /files`. `error` is present only when status is "failed". */
export interface FileListRow extends FileRecord {
  error?: string;
}

/** Response of `files.upload()` — the upload route returns the record itself. */
export type FileUploadResponse = FileRecord;

export interface TextExtractionResponse {
  fileId: string;
  status: FileStatus;
  extractedText?: string | null;
  error?: string;
}

/**
 * Response of `POST /files/:id/reprocess` (202). The server sets the file
 * back to "pending" and re-runs the full pipeline (extract → embed).
 */
export interface ReprocessResponse {
  fileId: string;
  status: FileStatus;
  message: string;
}

export type FileListResponse = PaginatedResponse<FileListRow>;

// ── Metadata ──────────────────────────────────────────────────────────────────

/** Flat key-value object. All values are strings. */
export type FileMetadata = Record<string, string>;

// ── Collections ───────────────────────────────────────────────────────────────

/** Row of `GET /collections`. Counts derive from `files.status`. */
export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount:     number;
  embeddedCount: number;
  pendingCount:  number;
  failedCount:   number;
}

/**
 * Response of `GET /collections/:id` — the summary shape plus the full
 * per-status breakdown and the query-readiness flag.
 */
export interface CollectionDetail extends CollectionSummary {
  skippedCount: number;
  /** true when every member file is extracted and embedded. */
  queryReady: boolean;
}

/** Response of `POST /collections` (201) — not a full record. */
export interface CreateCollectionResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/** Response of `PATCH /collections/:id` — not a full record. */
export interface UpdateCollectionResponse {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
}

export interface CollectionFile extends FileRecord {
  addedAt: string;
}

export interface OffsetPagination {
  total:   number;
  limit:   number;
  offset:  number;
  hasMore: boolean;
}

export interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: OffsetPagination;
}

export type CollectionFilesResponse = OffsetPaginatedResponse<CollectionFile>;

export interface CreateCollectionInput {
  name: string;
  description?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
}

export interface AddFilesToCollectionInput {
  fileIds: string[];
}

export interface AddFilesToCollectionResponse {
  added: number;
  collectionId: string;
}

// ── RAG / Ask ─────────────────────────────────────────────────────────────────

/**
 * Metadata filters for scoping a search or /ask query.
 * Keys are metadata field names; values are a single string (exact match)
 * or an array of strings (OR match).
 *
 * Example: { matter_number: "M-2024-001", document_type: ["contract", "amendment"] }
 */
export type MetadataFilters = Record<string, string | string[]>;

export interface RetrievalSource {
  fileId:      string;
  fileName:    string;
  chunkIndex:  number;
  content:     string;
  rrfScore:    number;
  rerankScore?: number;
}

/** One prior conversational turn for `AskInput.history`. */
export interface AskTurn {
  role:    "user" | "assistant";
  content: string;
}

export interface AskInput {
  question:     string;
  /** Search within specific files. Mutually exclusive with collectionId. */
  fileIds?:     string[];
  /** Search within a collection. Mutually exclusive with fileIds. */
  collectionId?: string;
  /** Metadata filters. Can be combined with fileIds or collectionId. */
  filters?:     MetadataFilters;
  /** Number of source chunks to retrieve. Default: 8. */
  topK?:        number;
  /** Ollama model override. */
  model?:       string;
  /**
   * Conversation memory: recent user/assistant turns replayed to the LLM
   * verbatim (read-only — they never affect retrieval). Max 10 turns,
   * content 1–2000 chars each.
   */
  history?:     AskTurn[];
}

export interface AskResponse {
  answer:  string;
  sources: RetrievalSource[];
}

/**
 * Events of `client.askStream()` — the server's SSE frames, each a JSON
 * object on a single `data:` line. One `sources` frame opens the stream,
 * `chunk` frames carry the answer text, and `error` arrives in-band when
 * the LLM fails after the stream is open.
 */
export type AskStreamEvent =
  | { type: "sources"; sources: RetrievalSource[] }
  | { type: "chunk";   text: string }
  | { type: "done" }
  | { type: "error";   message: string };

// ── Search ───────────────────────────────────────────────────────────────────

/** Input of `client.search()`. */
export interface SearchInput {
  query: string;
  /** Default 10 — the server caps the limit at 50. */
  limit?: number;
  /** Mutually exclusive with fileIds — providing both throws client-side. */
  collectionId?: string;
  /** Mutually exclusive with collectionId; sent comma-joined as `file_ids`. */
  fileIds?: string[];
  /**
   * Metadata filters: AND across keys, OR across values. Serialized as a
   * URL-encoded JSON object.
   *
   * Example: { matter_number: "M-2024-001", document_type: ["contract", "amendment"] }
   */
  filters?: MetadataFilters;
}

/**
 * Response of `client.search()` — hybrid retrieval (pgvector + ts_rank)
 * fused with Reciprocal Rank Fusion (k = 60).
 */
export interface SearchResponse {
  data:  RetrievalSource[];
  query: string;
  limit: number;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:    "ok" | "degraded";
  uptime:    number;
  timestamp: string;
  database:  "connected" | "disconnected";
}

// ── Errors ────────────────────────────────────────────────────────────────────

export interface ErrorDetail {
  message: string;
  /** Zod issue path — an array; array indices appear as numbers. */
  path:    (string | number)[];
}

/**
 * The raw error body the API emits. `error` is a plain string on inline route
 * errors and an object ({message, ...}) from the central error handler;
 * `details` and `retryAfter` sit at the top level, next to any extra fields
 * (e.g. invalidFileIds, supportedTypes).
 */
export interface KyroError {
  error:       string | { message?: string; code?: string; stack?: string };
  details?:    ErrorDetail[];
  retryAfter?: number;
  [key: string]: unknown;
}
