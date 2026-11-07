import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/core/http";
import { KyroForbiddenError, KyroRateLimitError } from "../src/core/errors";

const client = new HttpClient("http://test.local/api/v1", "kyro_live_test");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpClient", () => {
  it("throws the typed error for a string-shaped envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, { error: "Required scope: write" })));
    await expect(client.get("/files")).rejects.toBeInstanceOf(KyroForbiddenError);
  });

  it("surfaces retryAfter through the client", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(429, { error: "Too many requests", retryAfter: 12 })));
    const err = await client.get("/files").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroRateLimitError);
    expect((err as KyroRateLimitError).retryAfter).toBe(12);
  });

  it("sends the API key as X-API-Key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await client.get("/files", "apiKey");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("kyro_live_test");
  });

  it("resolves to {} on 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(client.delete("/files/1", "apiKey")).resolves.toEqual({});
  });

  it("passes the JSON body through on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { data: [1, 2] })));
    await expect(client.get("/files", "apiKey")).resolves.toEqual({ data: [1, 2] });
  });
});
