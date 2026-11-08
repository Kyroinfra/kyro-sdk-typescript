import { afterEach, describe, expect, it, vi } from "vitest";
import { KyroClient } from "../src/core/client";
import { KyroNotFoundError, KyroUnprocessableError } from "../src/core/errors";

const client = new KyroClient({ apiKey: "k", baseURL: "http://test.local/api/v1" });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function searchUrl(input: Parameters<typeof client.search>[0]): Promise<string> {
  const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], query: "", limit: 10 }));
  vi.stubGlobal("fetch", fetchMock);
  await client.search(input);
  const [url] = fetchMock.mock.calls[0] as unknown as [string];
  return url;
}

describe("client.search", () => {
  it("builds the org-wide query", async () => {
    expect(await searchUrl({ query: "fox" })).toBe("http://test.local/api/v1/search?q=fox");
  });

  it("serializes multi-word queries", async () => {
    expect(await searchUrl({ query: "fox dog" })).toBe("http://test.local/api/v1/search?q=fox+dog");
  });

  it("uses the snake_case wire names", async () => {
    expect(await searchUrl({ query: "a", collectionId: "c1" })).toBe(
      "http://test.local/api/v1/search?q=a&collection_id=c1"
    );
  });

  it("comma-joins file_ids", async () => {
    expect(await searchUrl({ query: "a", fileIds: ["id1", "id2"] })).toBe(
      "http://test.local/api/v1/search?q=a&file_ids=id1%2Cid2"
    );
  });

  it("appends limit when set", async () => {
    expect(await searchUrl({ query: "a", limit: 25 })).toBe(
      "http://test.local/api/v1/search?q=a&limit=25"
    );
  });

  it("sends filters as URL-encoded JSON", async () => {
    const filters = { document_type: ["contract", "amendment"] };
    expect(await searchUrl({ query: "a", filters })).toBe(
      `http://test.local/api/v1/search?q=a&filters=${encodeURIComponent(JSON.stringify(filters))}`
    );
  });

  it("omits empty filters entirely", async () => {
    expect(await searchUrl({ query: "a", filters: {} })).toBe("http://test.local/api/v1/search?q=a");
  });

  it("enforces collectionId/fileIds mutual exclusion client-side", async () => {
    await expect(
      client.search({ query: "a", collectionId: "c1", fileIds: ["f1"] })
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("passes the response through, including optional rerankScore", async () => {
    const body = {
      data: [{ fileId: "f1", fileName: "a.txt", chunkIndex: 0, content: "hello", rrfScore: 0.016, rerankScore: 0.5 }],
      query: "hello",
      limit: 10,
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, body)));
    await expect(client.search({ query: "hello" })).resolves.toEqual(body);
  });

  it("maps scope failures to the typed errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "Collection not found" })));
    await expect(client.search({ query: "x", collectionId: "nope" })).rejects.toBeInstanceOf(KyroNotFoundError);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(422, { error: "Scope resolves to nothing" })));
    await expect(client.search({ query: "x", fileIds: ["gone"] })).rejects.toBeInstanceOf(KyroUnprocessableError);
  });
});
