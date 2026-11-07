import { HttpClient } from "../core/http";
import type {
  CollectionSummary,
  CollectionDetail,
  CreateCollectionResponse,
  UpdateCollectionResponse,
  CollectionFilesResponse,
  CreateCollectionInput,
  UpdateCollectionInput,
  AddFilesToCollectionInput,
  AddFilesToCollectionResponse,
} from "../core/types";

export class CollectionsService {
  constructor(private readonly http: HttpClient) {}

  /** Lists all collections in the organisation — the endpoint is not paginated. */
  async list(): Promise<CollectionSummary[]> {
    return this.http.get<CollectionSummary[]>("/collections", "apiKey");
  }

  async create(input: CreateCollectionInput): Promise<CreateCollectionResponse> {
    return this.http.post<CreateCollectionResponse>("/collections", input, "apiKey");
  }

  async get(id: string): Promise<CollectionDetail> {
    return this.http.get<CollectionDetail>(`/collections/${id}`, "apiKey");
  }

  async update(id: string, input: UpdateCollectionInput): Promise<UpdateCollectionResponse> {
    return this.http.patch<UpdateCollectionResponse>(`/collections/${id}`, input, "apiKey");
  }

  async delete(id: string): Promise<void> {
    await this.http.delete<void>(`/collections/${id}`, "apiKey");
  }

  /** Offset-paginated — the server defaults to 100 and caps limit at 100. */
  async listFiles(id: string, limit?: number, offset?: number): Promise<CollectionFilesResponse> {
    const params = new URLSearchParams();
    if (limit  !== undefined) params.append("limit",  limit.toString());
    if (offset !== undefined) params.append("offset", offset.toString());
    const q = params.size ? `?${params}` : "";
    return this.http.get<CollectionFilesResponse>(`/collections/${id}/files${q}`, "apiKey");
  }

  /**
   * Adds files to a collection. Duplicates already in the collection are
   * ignored. Throws:
   * - `KyroValidationError` (400) — any of the ids do not exist in (or do not
   *   belong to) your organisation; the rejected ids are on
   *   `err.data.invalidFileIds`
   * - `KyroValidationError` (400) — invalid input; per-field issues on
   *   `err.details`
   * - `KyroNotFoundError` (404) — unknown collection in this organisation
   */
  async addFiles(id: string, input: AddFilesToCollectionInput): Promise<AddFilesToCollectionResponse> {
    return this.http.post<AddFilesToCollectionResponse>(`/collections/${id}/files`, input, "apiKey");
  }

  /**
   * Removes a file from a collection — the file itself is kept.
   * Throws `KyroNotFoundError` (404) when the file is not in the collection
   * ("File not in this collection").
   */
  async removeFile(id: string, fileId: string): Promise<void> {
    await this.http.delete<void>(`/collections/${id}/files/${fileId}`, "apiKey");
  }
}
