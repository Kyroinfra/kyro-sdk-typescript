import { HttpClient } from "../core/http";
import { ApiKey, ApiKeyCreateResponse } from "../core/types";

export class KeysService {
  constructor(private http: HttpClient) {}

  async listKeys(limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<ApiKey[]>(`/keys${query}`, "bearer");
  }

  async createKey(data: { name: string; scopes?: ("read" | "write" | "admin")[] }) {
    return this.http.post<ApiKeyCreateResponse>("/keys", data, "bearer");
  }

  async revokeKey(id: string) {
    return this.http.delete<{ message: string; id: string }>(`/keys/${id}`, "bearer");
  }
}
