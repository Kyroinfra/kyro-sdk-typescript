export interface SDKConfig {
  baseURL?: string;
  apiKey?: string;
}

export interface File {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
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