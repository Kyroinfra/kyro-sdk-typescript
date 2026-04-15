import { HttpClient } from "../core/http";
import { File } from "../core/types";

export class FilesService {
  constructor(private http: HttpClient) {}

  async listFiles(limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<File[]>(`/files${query}`, "apiKey");
  }

  async uploadFile(file: File | Blob, fileName?: string) {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return this.http.postFormData<File>("/files", formData, "apiKey");
  }

  async downloadFile(id: string): Promise<Blob> {
    const res = await fetch(`${(this.http as any).baseURL}/files/${id}`, {
      headers: {
        "X-API-Key": (this.http as any).apiKey,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }
    return res.blob();
  }

  async deleteFile(id: string) {
    return this.http.delete<{ message: string; id: string }>(`/files/${id}`, "apiKey");
  }
}
