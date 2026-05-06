import { HttpClient } from "../core/http";
import type { 
  FileWithExtraction, 
  FileListResponse, 
  FileUploadResponse,
  TextExtractionResponse,
  SearchResponse,
  TriggerExtractionResponse 
} from "../core/types";

export class FilesService {
  constructor(private http: HttpClient) {}

  async listFiles(limit?: number, cursor?: string): Promise<FileListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<FileListResponse>(`/files${query}`, "apiKey");
  }

  async uploadFile(file: File | Blob, fileName?: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return this.http.postFormData<FileUploadResponse>("/files", formData, "apiKey");
  }

  async downloadFile(id: string): Promise<Blob> {
    return this.http.getBlob(`/files/${id}`, "apiKey");
  }

  async deleteFile(id: string) {
    return this.http.delete<{ message: string; id: string }>(`/files/${id}`, "apiKey");
  }

  async searchFiles(query: string, limit?: number, cursor?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    return this.http.get<SearchResponse>(`/files/search?${params.toString()}`, "apiKey");
  }

  async getText(id: string): Promise<TextExtractionResponse> {
    return this.http.get<TextExtractionResponse>(`/files/${id}/text`, "apiKey");
  }

  async triggerExtraction(id: string): Promise<TriggerExtractionResponse> {
    return this.http.post<TriggerExtractionResponse>(`/files/${id}/extract`, undefined, "apiKey");
  }
}