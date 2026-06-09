import { HttpClient } from "../core/http";
import type {
  CollectionWithStats,
  CollectionFilesResponse,
  CreateCollectionInput,
  UpdateCollectionInput,
  AddFilesToCollectionInput,
  AddFilesToCollectionResponse,
} from "../core/types";

export class CollectionsService {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<CollectionWithStats[]> {
    return this.http.get<CollectionWithStats[]>("/collections", "apiKey");
  }

  async create(input: CreateCollectionInput): Promise<CollectionWithStats> {
    return this.http.post<CollectionWithStats>("/collections", input, "apiKey");
  }

  async get(id: string): Promise<CollectionWithStats> {
    return this.http.get<CollectionWithStats>(`/collections/${id}`, "apiKey");
  }

  async update(id: string, input: UpdateCollectionInput): Promise<CollectionWithStats> {
    return this.http.patch<CollectionWithStats>(`/collections/${id}`, input, "apiKey");
  }

  async delete(id: string): Promise<void> {
    await this.http.delete<void>(`/collections/${id}`, "apiKey");
  }

  async listFiles(id: string, limit?: number, offset?: number): Promise<CollectionFilesResponse> {
    const params = new URLSearchParams();
    if (limit  !== undefined) params.append("limit",  limit.toString());
    if (offset !== undefined) params.append("offset", offset.toString());
    const q = params.size ? `?${params}` : "";
    return this.http.get<CollectionFilesResponse>(`/collections/${id}/files${q}`, "apiKey");
  }

  async addFiles(id: string, input: AddFilesToCollectionInput): Promise<AddFilesToCollectionResponse> {
    return this.http.post<AddFilesToCollectionResponse>(`/collections/${id}/files`, input, "apiKey");
  }

  async removeFile(id: string, fileId: string): Promise<void> {
    await this.http.delete<void>(`/collections/${id}/files/${fileId}`, "apiKey");
  }
}
