import type { HealthResponse } from "../core/types";

export class HealthService {
  constructor(private readonly baseURL: string) {}

  async getHealth(): Promise<HealthResponse> {
    // Health endpoint is at the root, not under /api/vN
    // Strip the /api/vN suffix to reach /health
    const rootURL = this.baseURL.replace(/\/api\/v\d+.*$/, "");

    const res = await fetch(`${rootURL}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: HTTP ${res.status}`);
    }
    return res.json() as Promise<HealthResponse>;
  }
}
