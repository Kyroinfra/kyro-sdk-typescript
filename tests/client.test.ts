import { afterEach, describe, expect, it, vi } from "vitest";
import { KyroClient } from "../src/core/client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Runs files.list() against a stubbed fetch and returns the requested URL —
 * the observable result of the client's base-URL logic.
 */
async function requestUrlFor(config: { apiKey: string; baseURL?: string }): Promise<string> {
  const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], nextCursor: null }));
  vi.stubGlobal("fetch", fetchMock);
  const client = new KyroClient(config);
  await client.files.list();
  const [url] = fetchMock.mock.calls[0] as unknown as [string];
  return url;
}

describe("KyroClient base URL", () => {
  it("defaults to https://api.kyro.io/api/v1", async () => {
    expect(await requestUrlFor({ apiKey: "k" })).toBe("https://api.kyro.io/api/v1/files");
  });

  it("appends /api/v1 to a custom baseURL and trims trailing slashes", async () => {
    expect(await requestUrlFor({ apiKey: "k", baseURL: "http://localhost:3000" })).toBe(
      "http://localhost:3000/api/v1/files"
    );
    expect(await requestUrlFor({ apiKey: "k", baseURL: "http://localhost:3000/" })).toBe(
      "http://localhost:3000/api/v1/files"
    );
    expect(await requestUrlFor({ apiKey: "k", baseURL: "http://localhost:3000///" })).toBe(
      "http://localhost:3000/api/v1/files"
    );
  });

  it("uses a baseURL that already contains /api/ as-is", async () => {
    expect(await requestUrlFor({ apiKey: "k", baseURL: "http://localhost:3000/api/v1" })).toBe(
      "http://localhost:3000/api/v1/files"
    );
    expect(await requestUrlFor({ apiKey: "k", baseURL: "http://localhost:3000/api/v1/" })).toBe(
      "http://localhost:3000/api/v1/files"
    );
  });
});
