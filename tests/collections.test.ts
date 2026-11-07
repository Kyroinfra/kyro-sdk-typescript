import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/core/http";
import { CollectionsService } from "../src/services/collections";
import { KyroNotFoundError, KyroValidationError } from "../src/core/errors";

const collections = new CollectionsService(new HttpClient("http://test.local/api/v1", "k"));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("list", () => {
  it("requests /collections and returns the rows", async () => {
    const rows = [{
      id: "c1", name: "n", description: null, createdAt: "x", updatedAt: "y",
      fileCount: 2, embeddedCount: 1, pendingCount: 1, failedCount: 0,
    }];
    const fetchMock = vi.fn(async () => jsonResponse(200, rows));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.list()).resolves.toEqual(rows);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/collections");
  });
});

describe("create", () => {
  it("POSTs the name/body and returns the 201 shape", async () => {
    const body = { id: "c1", name: "n", description: null, createdAt: "x" };
    const fetchMock = vi.fn(async () => jsonResponse(201, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.create({ name: "n" })).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "n" }));
  });
});

describe("get", () => {
  it("requests /collections/:id", async () => {
    const body = {
      id: "c1", name: "n", description: null, createdAt: "x", updatedAt: "y",
      fileCount: 1, embeddedCount: 1, pendingCount: 0, failedCount: 0,
      skippedCount: 0, queryReady: true,
    };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.get("c1")).resolves.toEqual(body);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/collections/c1");
  });
});

describe("update", () => {
  it("PATCHes /collections/:id", async () => {
    const body = { id: "c1", name: "n", description: "d", updatedAt: "y" };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.update("c1", { name: "n" })).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/c1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ name: "n" }));
  });
});

describe("delete", () => {
  it("DELETEs /collections/:id and resolves on 204", async () => {
    const fetchMock = vi.fn(async () => noContent());
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.delete("c1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/c1");
    expect(init.method).toBe("DELETE");
  });
});

describe("listFiles", () => {
  it("builds the offset query params", async () => {
    const body = { data: [], pagination: { total: 0, limit: 20, offset: 40, hasMore: false } };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.listFiles("c1", 20, 40)).resolves.toEqual(body);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/collections/c1/files?limit=20&offset=40");
  });

  it("omits unset params", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], pagination: { total: 0, limit: 100, offset: 0, hasMore: false } }));
    vi.stubGlobal("fetch", fetchMock);
    await collections.listFiles("c1");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/collections/c1/files");
  });
});

describe("addFiles", () => {
  it("POSTs the fileIds body", async () => {
    const body = { added: 2, collectionId: "c1" };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.addFiles("c1", { fileIds: ["f1", "f2"] })).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/c1/files");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ fileIds: ["f1", "f2"] }));
  });

  it("surfaces invalidFileIds on .data for the foreign/missing case", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, {
      error: "Some files not found or do not belong to your organisation",
      invalidFileIds: ["f1", "f2"],
    })));
    const err = await collections.addFiles("c1", { fileIds: ["f1", "f2"] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroValidationError);
    expect((err as KyroValidationError).message).toBe("Some files not found or do not belong to your organisation");
    expect((err as KyroValidationError).data).toEqual({ invalidFileIds: ["f1", "f2"] });
  });
});

describe("removeFile", () => {
  it("DELETEs /collections/:id/files/:fileId", async () => {
    const fetchMock = vi.fn(async () => noContent());
    vi.stubGlobal("fetch", fetchMock);
    await expect(collections.removeFile("c1", "f1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/c1/files/f1");
    expect(init.method).toBe("DELETE");
  });

  it("throws KyroNotFoundError when the file is not in the collection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "File not in this collection" })));
    await expect(collections.removeFile("c1", "f1")).rejects.toBeInstanceOf(KyroNotFoundError);
  });
});
