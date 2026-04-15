export type AuthType = "bearer" | "apiKey" | "both";

export class HttpClient {
  constructor(
    private baseURL: string,
    private apiKey?: string,
    private token?: string
  ) {}

  private getHeaders(auth?: AuthType, contentType: string = "application/json"): HeadersInit {
    const headers: Record<string, string> = {};

    if (auth === "bearer" && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    } else if (auth === "apiKey" && this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    } else if (auth === "both") {
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }
      if (this.apiKey) {
        headers["X-API-Key"] = this.apiKey;
      }
    }

    if (contentType !== "multipart/form-data") {
      headers["Content-Type"] = contentType;
    }

    return headers;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    auth?: AuthType
  ): Promise<T> {
    const contentType = options.headers?.["Content-Type"] || "application/json";

    const res = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(auth, contentType),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: `HTTP Error: ${res.status}`, code: "http_error" } }));
      throw new Error(error.error?.message || `HTTP Error: ${res.status}`);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json();
  }

  get<T>(path: string, auth?: AuthType) {
    return this.request<T>(path, {}, auth);
  }

  async getBlob(path: string, auth?: AuthType): Promise<Blob> {
    const headers = this.getHeaders(auth, "application/json");

    const res = await fetch(`${this.baseURL}${path}`, {
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: `HTTP Error: ${res.status}`, code: "http_error" } }));
      throw new Error(error.error?.message || `HTTP Error: ${res.status}`);
    }

    return res.blob();
  }

  post<T>(path: string, body?: unknown, auth?: AuthType) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }, auth);
  }

  postFormData<T>(path: string, formData: FormData, auth?: AuthType) {
    return this.request<T>(path, {
      method: "POST",
      body: formData,
    }, auth);
  }

  put<T>(path: string, body: unknown, auth?: AuthType) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }, auth);
  }

  delete<T>(path: string, auth?: AuthType) {
    return this.request<T>(path, {
      method: "DELETE",
    }, auth);
  }
}
