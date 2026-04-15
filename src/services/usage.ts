import { HttpClient } from "../core/http";
import { UsageStats, DailyUsage } from "../core/types";

export class UsageService {
  constructor(private http: HttpClient) {}

  async getUsage(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<UsageStats>(`/usage${query}`, "bearer");
  }

  async getDailyUsage(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.http.get<DailyUsage[]>(`/usage/daily${query}`, "bearer");
  }
}
