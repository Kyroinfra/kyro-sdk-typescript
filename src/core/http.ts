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
} from "./errors";
import type { ErrorDetail } from "./types";

export type AuthType = "apiKey";

export class HttpClient {
  constructor(
    private readonly baseURL: string,
    private readonly apiKey?: string
  ) {}

  private getHeaders(
    auth?: AuthType,
    contentType = "application/json"
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (auth === "apiKey" && this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    // Never set Content-Type for multipart — the browser/fetch sets it
    // automatically with the correct boundary.
    if (contentType !== "multipart/form-data") {
      headers["Content-Type"] = contentType;
    }

    return headers;
  }

  private async throwTypedError(res: Response): Promise<never> {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      // response body wasn't JSON — the parser falls back to a generic message
      body = undefined;
    }
    throw errorForStatus(res.status, body);
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    auth?: AuthType
  ): Promise<T> {
    const headers = options.headers as Record<string, string> | undefined;
    const contentType = headers?.["Content-Type"] ?? "application/json";
    const isMultipart = contentType === "multipart/form-data";

    // Drop the sentinel Content-Type we used to signal multipart
    const { "Content-Type": _drop, ...restHeaders } = headers ?? {};

    const res = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(auth, contentType),
        ...(isMultipart ? restHeaders : headers),
      },
    });

    if (!res.ok) {
      await this.throwTypedError(res);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  get<T>(path: string, auth?: AuthType): Promise<T> {
    return this.request<T>(path, {}, auth);
  }

  async getBlob(path: string, auth?: AuthType): Promise<Blob> {
    const res = await fetch(`${this.baseURL}${path}`, {
      headers: this.getHeaders(auth),
    });

    if (!res.ok) {
      await this.throwTypedError(res);
    }

    return res.blob();
  }

  /**
   * Returns the raw Response for endpoints that need streaming (SSE).
   * The caller is responsible for reading the body.
   */
  async getRawResponse(path: string, options: RequestInit = {}, auth?: AuthType): Promise<Response> {
    const res = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(auth),
        ...(options.headers as Record<string, string> ?? {}),
      },
    });

    if (!res.ok) {
      await this.throwTypedError(res);
    }

    return res;
  }

  post<T>(path: string, body?: unknown, auth?: AuthType): Promise<T> {
    return this.request<T>(
      path,
      {
        method: "POST",
        body:   body !== undefined ? JSON.stringify(body) : undefined,
      },
      auth
    );
  }

  postFormData<T>(path: string, formData: FormData, auth?: AuthType): Promise<T> {
    return this.request<T>(
      path,
      {
        method:  "POST",
        body:    formData,
        headers: { "Content-Type": "multipart/form-data" },
      },
      auth
    );
  }

  put<T>(path: string, body: unknown, auth?: AuthType): Promise<T> {
    return this.request<T>(
      path,
      { method: "PUT", body: JSON.stringify(body) },
      auth
    );
  }

  patch<T>(path: string, body: unknown, auth?: AuthType): Promise<T> {
    return this.request<T>(
      path,
      { method: "PATCH", body: JSON.stringify(body) },
      auth
    );
  }

  delete<T>(path: string, auth?: AuthType): Promise<T> {
    return this.request<T>(path, { method: "DELETE" }, auth);
  }
}

// ── Error-body parsing ───────────────────────────────────────────────────────
//
// The API emits two error envelope shapes:
//   1. inline route errors:  { error: "message", details?: [...], ...extras }
//   2. central handler:      { error: { message, stack? } }  (and not-found:
//                            { error: { message, statusCode } })
// `details` and `retryAfter` sit at the body's top level. Every other
// top-level field is preserved on `data`, so callers can read things like
// invalidFileIds or supportedTypes without re-parsing the body.

const STATUS_CODES: Record<number, string> = {
  400: "validation_error",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "file_too_large",
  415: "unsupported_media_type",
  422: "unprocessable",
  429: "rate_limit_exceeded",
  503: "service_unavailable",
  507: "storage_limit_exceeded",
};

function codeFor(status: number): string {
  return STATUS_CODES[status] ?? "http_error";
}

export interface ParsedErrorBody {
  message:    string;
  code:       string;
  details?:   ErrorDetail[];
  retryAfter?: number;
  data?:      Record<string, unknown>;
}

export function parseErrorBody(status: number, body: unknown): ParsedErrorBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawError = b.error;

  let message = `HTTP ${status}`;
  if (typeof rawError === "string" && rawError.length > 0) {
    message = rawError;
  } else if (rawError && typeof rawError === "object") {
    const m = (rawError as Record<string, unknown>).message;
    if (typeof m === "string" && m.length > 0) {
      message = m;
    }
  }

  const details = Array.isArray(b.details) ? (b.details as ErrorDetail[]) : undefined;
  const retryAfter = typeof b.retryAfter === "number" ? b.retryAfter : undefined;

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(b)) {
    if (key !== "error" && key !== "details" && key !== "retryAfter") {
      data[key] = value;
    }
  }

  return {
    message,
    code: codeFor(status),
    details,
    retryAfter,
    data: Object.keys(data).length > 0 ? data : undefined,
  };
}

export function errorForStatus(status: number, body: unknown): KyroApiError {
  const { message, code, details, retryAfter, data } = parseErrorBody(status, body);
  const options = { details, retryAfter, data };

  switch (status) {
    case 400: return new KyroValidationError(message, options);
    case 401: return new KyroAuthError(message, options);
    case 403: return new KyroForbiddenError(message, options);
    case 404: return new KyroNotFoundError(message, options);
    case 409: return new KyroConflictError(message, options);
    case 413: return new KyroFileTooLargeError(message, options);
    case 415: return new KyroUnsupportedMediaTypeError(message, options);
    case 422: return new KyroUnprocessableError(message, options);
    case 429: return new KyroRateLimitError(message, options);
    case 503: return new KyroServiceUnavailableError(message, options);
    case 507: return new KyroStorageLimitError(message, options);
    default:  return new KyroApiError(status, code, message, options);
  }
}
