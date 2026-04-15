export class HttpClient {
  constructor(
    private baseURL: string,
    private apiKey?: string
  ) {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        ...options.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, {
      method: "DELETE",
    });
  }
}
