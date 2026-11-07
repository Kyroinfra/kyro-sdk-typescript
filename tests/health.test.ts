import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthService } from "../src/services/health";
import {
  KyroApiError,
  KyroRateLimitError,
  KyroServiceUnavailableError,
} from "../src/core/errors";

const health = new HealthService("http://test.local/api/v1");
const bareHealth = new HealthService("http://test.local");

const healthyBody = { status: "ok", uptime: 100, timestamp: "2026-01-01T00:00:00Z", database: "connected" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL construction", () => {
  it("strips the API path — /health lives at the root", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, healthyBody));
    vi.stubGlobal("fetch", fetchMock);
    await health.getHealth();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/health");
  });

  it("handles a baseURL that already points at the root", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, healthyBody));
    vi.stubGlobal("fetch", fetchMock);
    await bareHealth.getHealth();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/health");
  });
});

describe("getHealth", () => {
  it("resolves the 200 body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, healthyBody)));
    await expect(health.getHealth()).resolves.toEqual(healthyBody);
  });

  it("resolves — not throws — the degraded 503 body", async () => {
    const body = { status: "degraded", uptime: 12, timestamp: "2026-01-01T00:00:00Z", database: "disconnected" };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, body)));
    await expect(health.getHealth()).resolves.toEqual(body);
  });

  it("throws KyroServiceUnavailableError for a degraded 503 without a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no json", { status: 503 })));
    const err = await health.getHealth().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroServiceUnavailableError);
  });

  it("maps other non-OK statuses to typed errors with their fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(429, { error: "Too many requests", retryAfter: 5 })));
    const err = await health.getHealth().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroRateLimitError);
    expect((err as KyroRateLimitError).retryAfter).toBe(5);
  });

  it("falls back to the generic error for unexpected non-JSON bodies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const err = await health.getHealth().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroApiError);
    const typed = err as KyroApiError;
    expect(typed.constructor).toBe(KyroApiError);
    expect(typed.message).toBe("HTTP 500");
  });

  it("lets network failures surface as-is", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(health.getHealth()).rejects.toBeInstanceOf(TypeError);
  });
});
