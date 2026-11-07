import { HttpClient } from "../core/http";
import type {
  FileListResponse,
  FileUploadResponse,
  TextExtractionResponse,
  ReprocessResponse,
  FileMetadata,
} from "../core/types";

export class FilesService {
  constructor(private readonly http: HttpClient) {}

  // ── File CRUD ───────────────────────────────────────────────────────────────

  async list(limit?: number, cursor?: string): Promise<FileListResponse> {
    const params = new URLSearchParams();
    if (limit)  params.append("limit",  limit.toString());
    if (cursor) params.append("cursor", cursor);
    const q = params.size ? `?${params}` : "";
    return this.http.get<FileListResponse>(`/files${q}`, "apiKey");
  }

  async upload(file: File | Blob, fileName?: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return this.http.postFormData<FileUploadResponse>("/files", formData, "apiKey");
  }

  async download(id: string): Promise<Blob> {
    return this.http.getBlob(`/files/${id}`, "apiKey");
  }

  async delete(id: string): Promise<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(`/files/${id}`, "apiKey");
  }

  // ── Status / reprocessing ───────────────────────────────────────────────

  async getText(id: string): Promise<TextExtractionResponse> {
    return this.http.get<TextExtractionResponse>(`/files/${id}/text`, "apiKey");
  }

  /**
   * Re-runs the full ingest pipeline (extract → embed) for an already-uploaded
   * file. The server queues the job and answers 202 with the file set back to
   * "pending" — poll {@link getText} for the new status.
   *
   * Throws:
   * - `KyroConflictError` (409) — a pipeline run is already in progress; the
   *   current status is on `err.data.status`
   * - `KyroValidationError` (400) — the file's type is not supported for
   *   extraction; the accepted types are on `err.data.supportedTypes`
   * - `KyroNotFoundError` (404) — no such file in this organisation
   */
  async reprocess(id: string): Promise<ReprocessResponse> {
    return this.http.post<ReprocessResponse>(`/files/${id}/reprocess`, undefined, "apiKey");
  }

  // ── Metadata ────────────────────────────────────────────────────────────────

  async getMetadata(id: string): Promise<FileMetadata> {
    return this.http.get<FileMetadata>(`/files/${id}/metadata`, "apiKey");
  }

  /**
   * Merges the given keys into the file's metadata — an upsert, not a
   * replacement: keys in the body win, everything already stored is left
   * untouched. An empty body is a no-op that returns `{}`. To remove a key,
   * use {@link deleteMetadataKey}.
   */
  async setMetadata(id: string, metadata: FileMetadata): Promise<FileMetadata> {
    return this.http.put<FileMetadata>(`/files/${id}/metadata`, metadata, "apiKey");
  }

  async deleteMetadataKey(id: string, key: string): Promise<void> {
    await this.http.delete<void>(`/files/${id}/metadata/${encodeURIComponent(key)}`, "apiKey");
  }
}
