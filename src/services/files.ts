import { HttpClient } from "../core/http";
import type {
  FileListResponse,
  FileUploadResponse,
  TextExtractionResponse,
  SearchResponse,
  TriggerExtractionResponse,
  FileMetadata,
  AskInput,
  AskResponse,
  AskStreamEvent,
  SemanticSearchInput,
  SemanticSearchResponse,
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

  async search(query: string, limit?: number, cursor?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (limit)  params.append("limit",  limit.toString());
    if (cursor) params.append("cursor", cursor);
    return this.http.get<SearchResponse>(`/files/search?${params}`, "apiKey");
  }

  // ── Extraction ──────────────────────────────────────────────────────────────

  async getText(id: string): Promise<TextExtractionResponse> {
    return this.http.get<TextExtractionResponse>(`/files/${id}/text`, "apiKey");
  }

  async triggerExtraction(id: string): Promise<TriggerExtractionResponse> {
    return this.http.post<TriggerExtractionResponse>(
      `/files/${id}/extract`,
      undefined,
      "apiKey"
    );
  }

  // ── Metadata ────────────────────────────────────────────────────────────────

  async getMetadata(id: string): Promise<FileMetadata> {
    return this.http.get<FileMetadata>(`/files/${id}/metadata`, "apiKey");
  }

  async setMetadata(id: string, metadata: FileMetadata): Promise<FileMetadata> {
    return this.http.put<FileMetadata>(`/files/${id}/metadata`, metadata, "apiKey");
  }

  async deleteMetadataKey(id: string, key: string): Promise<void> {
    await this.http.delete<void>(`/files/${id}/metadata/${encodeURIComponent(key)}`, "apiKey");
  }

  // ── Embedding ───────────────────────────────────────────────────────────────

  async embed(id: string): Promise<{ fileId: string; embeddingStatus: string; chunksCreated: number }> {
    return this.http.post<{ fileId: string; embeddingStatus: string; chunksCreated: number }>(
      `/files/${id}/embed`,
      undefined,
      "apiKey"
    );
  }

  // ── Semantic search ─────────────────────────────────────────────────────────

  async semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchResponse> {
    const params = new URLSearchParams({ q: input.query });
    if (input.collectionId) params.append("collection_id", input.collectionId);
    if (input.fileIds?.length) params.append("file_ids", input.fileIds.join(","));
    if (input.limit !== undefined) params.append("limit", input.limit.toString());
    if (input.minScore !== undefined) params.append("min_score", input.minScore.toString());
    return this.http.get<SemanticSearchResponse>(`/files/semantic-search?${params}`, "apiKey");
  }

  // ── Ask (non-streaming) ─────────────────────────────────────────────────────

  async ask(input: AskInput & { stream: false }): Promise<AskResponse>;
  async ask(input: AskInput): Promise<AskResponse>;
  async ask(input: AskInput): Promise<AskResponse> {
    return this.http.post<AskResponse>("/files/ask", { ...input, stream: false }, "apiKey");
  }

  // ── Ask (streaming) — async generator over SSE events ──────────────────────

  async *askStream(input: Omit<AskInput, "stream">): AsyncGenerator<AskStreamEvent> {
    const res = await this.http.getRawResponse(
      "/files/ask",
      {
        method:  "POST",
        body:    JSON.stringify({ ...input, stream: true }),
        headers: { "Content-Type": "application/json" },
      },
      "apiKey"
    );

    if (!res.body) {
      throw new Error("No response body for streaming ask");
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (!json) continue;
          try {
            yield JSON.parse(json) as AskStreamEvent;
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      // flush remaining buffer
      if (buffer.trim().startsWith("data:")) {
        const json = buffer.trim().slice(5).trim();
        if (json) {
          try {
            yield JSON.parse(json) as AskStreamEvent;
          } catch { /* ignore */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Backwards-compat aliases ────────────────────────────────────────────────

  /** @deprecated Use {@link list} instead */
  listFiles    = this.list.bind(this);
  /** @deprecated Use {@link upload} instead */
  uploadFile   = this.upload.bind(this);
  /** @deprecated Use {@link download} instead */
  downloadFile = this.download.bind(this);
  /** @deprecated Use {@link delete} instead */
  deleteFile   = this.delete.bind(this);
  /** @deprecated Use {@link search} instead */
  searchFiles  = this.search.bind(this);
}
