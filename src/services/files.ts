import { HttpClient } from "../core/http";
import type { File as KyroFile } from "../core/types";

export class FilesService {
  constructor(private http: HttpClient) {}

  async listFiles(limit?: number, cursor?: string): Promise<KyroFile[]> {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<KyroFile[]>(`/files${query}`, "apiKey");
  }

  async uploadFile(file: File | Blob, fileName?: string): Promise<KyroFile> {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return this.http.postFormData<KyroFile>("/files", formData, "apiKey");
  }

  async downloadFile(id: string): Promise<Blob> {
    return this.http.getBlob(`/files/${id}`, "apiKey");
  }

  async deleteFile(id: string) {
    return this.http.delete<{ message: string; id: string }>(`/files/${id}`, "apiKey");
  }
}