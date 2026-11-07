import { errorForStatus } from "../core/http";
import type { HealthResponse } from "../core/types";

export class HealthService {
  constructor(private readonly baseURL: string) {}

  /**
   * Checks the deployment's health.
   *
   * The endpoint is mounted at the root, outside the API router, so the
   * `/api/vN` path is stripped before the request. No API key is sent — the
   * endpoint is public.
   *
   * A *degraded* server answers **503 with a normal body**: this resolves
   * with `status: "degraded"` so callers can branch on it instead of
   * catching. Only unexpected failures (any other non-OK status) throw,
   * through the typed error hierarchy with the same envelope parsing as
   * every other endpoint. Network failures (no response at all) surface as
   * the fetch layer's own error (e.g. `TypeError: fetch failed`).
   */
  async getHealth(): Promise<HealthResponse> {
    // Health endpoint is at the root, not under /api/vN
    // Strip the /api/vN suffix to reach /health
    const rootURL = this.baseURL.replace(/\/api\/v\d+.*$/, "");

    const res = await fetch(`${rootURL}/health`);

    // Degraded: the server deliberately answers 503 with a normal
    // HealthResponse body — the status field is the contract.
    if (res.status === 503) {
      try {
        return (await res.json()) as HealthResponse;
      } catch {
        // Degraded but not JSON — treat as an unexpected failure.
        throw errorForStatus(res.status, undefined);
      }
    }

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        // response body wasn't JSON — the parser falls back to a generic message
        body = undefined;
      }
      throw errorForStatus(res.status, body);
    }

    return res.json() as Promise<HealthResponse>;
  }
}
