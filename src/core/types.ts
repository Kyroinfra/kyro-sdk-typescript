export interface SDKConfig {
  baseURL?: string;
  apiKey?: string;
  token?: string;
}

export interface User {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  orgId: string;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

export interface Member {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ("read" | "write" | "admin")[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiKeyCreateResponse extends ApiKey {
  key: string;
}

export interface File {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface UsageStats {
  total_requests: number;
  total_bytes_in: number;
  total_bytes_out: number;
  total_storage: number;
  active_api_keys: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  bytes_in: number;
  bytes_out: number;
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
