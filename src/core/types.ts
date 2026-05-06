export interface SDKConfig {
  apiKey: string;
  baseURL?: string;
  version?: "v1" | "v2";
}

export type ExtractionStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

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

export interface TextExtractionResponse {
  fileId: string;
  extractionStatus: ExtractionStatus;
  extractedText?: string;
  error?: string;
}

export interface SearchResult extends File {
  rank: number;
  headline: string;
}

export interface SearchResponse {
  data: SearchResult[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface FileListResponse {
  data: FileWithExtraction[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface FileUploadResponse extends FileWithExtraction {
  extractedText?: string;
}

export interface TriggerExtractionResponse {
  fileId: string;
  extractionStatus: ExtractionStatus;
  message?: string;
}

export interface ErrorDetail {
  message: string;
  path: string;
}

export interface KyroError {
  message: string;
  code: string;
  details: ErrorDetail[];
}

export interface ApiError {
  error: KyroError;
}
