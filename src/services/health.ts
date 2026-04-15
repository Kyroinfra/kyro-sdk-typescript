import { HttpClient } from "../core/http";

export class HealthService {
  constructor(private http: HttpClient) {}

  async getHealth() {
    return this.http.get<{ status: string }>("/health", undefined);
  }
}
