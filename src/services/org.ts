import { HttpClient } from "../core/http";
import { Organisation, Member } from "../core/types";

export class OrgService {
  constructor(private http: HttpClient) {}

  async getOrg() {
    return this.http.get<Organisation>("/org", "bearer");
  }

  async listMembers(limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.append("limit", limit.toString());
    if (cursor) params.append("cursor", cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<Member[]>(`/org/members${query}`, "bearer");
  }

  async inviteMember(data: { email: string; password: string; role?: "owner" | "admin" | "member" }) {
    return this.http.post<Member>("/org/members", data, "bearer");
  }

  async removeMember(id: string) {
    return this.http.delete<{ message: string; id: string }>(`/org/members/${id}`, "bearer");
  }
}
