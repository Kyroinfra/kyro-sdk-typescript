// ── SDK Config ────────────────────────────────────────────────────────────────

export interface SDKConfig {
  apiKey: string;
  baseURL?: string;
}

// ── Shared ────────────────────────────────────────────────────────────────────

export type ExtractionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export type EmbeddingStatus =
  | "pending"
  | "embedding"
  | "completed"
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

export interface File {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface FileWithExtraction extends File {
  extractionStatus: ExtractionStatus;
}

export interface FileUploadResponse extends FileWithExtraction {
  extractedText?: string;
}

export interface TextExtractionResponse {
  fileId: string;
  extractionStatus: ExtractionStatus;
  extractedText?: string | null;
  error?: string;
}

export interface TriggerExtractionResponse {
  fileId: string;
  extractionStatus: ExtractionStatus;
  message?: string;
}

export interface SearchResult extends File {
  rank: number;
  headline: string;
}

export type FileListResponse = PaginatedResponse<FileWithExtraction>;
export type SearchResponse   = PaginatedResponse<SearchResult>;

// ── Metadata ──────────────────────────────────────────────────────────────────

/** Flat key-value object. All values are strings. */
export type FileMetadata = Record<string, string>;

// ── Collections ───────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionWithStats extends Collection {
  fileCount:     number;
  embeddedCount: number;
  pendingCount:  number;
  failedCount:   number;
  skippedCount?: number;
  queryReady?:   boolean;
}

export interface CollectionFile extends File {
  embeddingStatus: EmbeddingStatus;
  addedAt: string;
}

export type CollectionFilesResponse = PaginatedResponse<CollectionFile>;

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
  /** Minimum RRF score threshold. Default: 0. */
  minScore?:    number;
  /** Whether to stream the response. Default: true. */
  stream?:      boolean;
}

export interface AskResponse {
  answer:  string;
  sources: RetrievalSource[];
}

// ── Streaming events ──────────────────────────────────────────────────────────

export interface SourcesEvent {
  type:    "sources";
  sources: RetrievalSource[];
}

export interface ChunkEvent {
  type: "chunk";
  text: string;
}

export interface DoneEvent {
  type: "done";
}

export interface ErrorEvent {
  type:    "error";
  message: string;
}

export type AskStreamEvent = SourcesEvent | ChunkEvent | DoneEvent | ErrorEvent;

// ── Semantic search ───────────────────────────────────────────────────────────

export interface SemanticSearchInput {
  query:        string;
  collectionId?: string;
  fileIds?:      string[];
  limit?:        number;
  minScore?:     number;
}

export interface SemanticSearchResponse {
  data:     RetrievalSource[];
  query:    string;
  limit:    number;
  minScore: number;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:    "ok" | "degraded";
  uptime:    number;
  timestamp: string;
  database:  "connected" | "disconnected";
  redis:     "connected" | "disconnected" | "optional";
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
