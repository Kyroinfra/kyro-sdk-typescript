import {
  KyroApiError,
  KyroAuthError,
  KyroNotFoundError,
  KyroQuotaError,
  KyroRateLimitError,
  KyroValidationError,
} from "./errors";

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
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // response body wasn't JSON — use a generic message
    }

    const err = body?.error ?? {};
    const message: string  = err.message ?? `HTTP ${res.status}`;
    const code: string     = err.code    ?? "http_error";
    const details          = err.details ?? [];
    const retryAfter       = body?.retryAfter as number | undefined;

    switch (res.status) {
      case 400: throw new KyroValidationError(message, details);
      case 401: throw new KyroAuthError(message);
      case 403: throw new KyroQuotaError(message);
      case 404: throw new KyroNotFoundError(message);
      case 429: throw new KyroRateLimitError(retryAfter);
      default:  throw new KyroApiError(res.status, code, message, details);
    }
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
