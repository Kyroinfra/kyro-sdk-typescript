import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/core/http";
import { FilesService } from "../src/services/files";
import {
  KyroConflictError,
  KyroNotFoundError,
  KyroValidationError,
} from "../src/core/errors";

const files = new FilesService(new HttpClient("http://test.local/api/v1", "k"));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("list", () => {
  it("requests /files with no query when params are unset", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], pagination: { limit: 100, hasMore: false, nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);
    await files.list();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/files");
  });

  it("includes limit and cursor query params when set", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], pagination: { limit: 5, hasMore: false, nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);
    await files.list(5, "abc");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/files?limit=5&cursor=abc");
  });
});

describe("upload", () => {
  it("sends the FormData 'file' field without a manual Content-Type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { id: "f1", name: "a.txt", mimeType: "text/plain", sizeBytes: 5, createdAt: "2026-01-01T00:00:00Z", status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);
    await files.upload(new Blob(["x"]), "a.txt");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files");
    expect(init.method).toBe("POST");
    const formData = init.body as FormData;
    expect(formData.get("file")).toBeInstanceOf(Blob);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

describe("getText", () => {
  it("requests /files/:id/text and returns the typed body", async () => {
    const body = { fileId: "f1", status: "ready", extractedText: "hello", error: undefined };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(files.getText("f1")).resolves.toEqual(body);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://test.local/api/v1/files/f1/text");
  });
});

describe("reprocess", () => {
  it("posts to /files/:id/reprocess and resolves the 202 body", async () => {
    const body = { fileId: "f1", status: "pending", message: "Reprocessing queued. Poll GET /files/:id/text for status." };
    const fetchMock = vi.fn(async () => jsonResponse(202, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(files.reprocess("f1")).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files/f1/reprocess");
    expect(init.method).toBe("POST");
  });

  it("throws KyroConflictError on 409 with the current status on .data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, { error: "Pipeline already in progress", status: "processing" })));
    const err = await files.reprocess("f1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroConflictError);
    expect((err as KyroConflictError).status).toBe(409);
    expect((err as KyroConflictError).data).toEqual({ status: "processing" });
  });

  it("carries supportedTypes on .data for the 400 case", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { error: "File type not supported for extraction", supportedTypes: ["application/pdf", "text/plain"] })));
    const err = await files.reprocess("f1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroValidationError);
    expect((err as KyroValidationError).data).toEqual({ supportedTypes: ["application/pdf", "text/plain"] });
  });

  it("throws KyroNotFoundError on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "File not found" })));
    await expect(files.reprocess("nope")).rejects.toBeInstanceOf(KyroNotFoundError);
  });
});

describe("metadata", () => {
  it("PUTs the metadata body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { document_type: "contract" }));
    vi.stubGlobal("fetch", fetchMock);
    await files.setMetadata("f1", { document_type: "contract" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files/f1/metadata");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ document_type: "contract" }));
  });

  it("URL-encodes the key in deleteMetadataKey", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    await files.deleteMetadataKey("f1", "a/b c");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files/f1/metadata/a%2Fb%20c");
    expect(init.method).toBe("DELETE");
  });
});

describe("delete", () => {
  it("requests /files/:id and passes the body through", async () => {
    const body = { message: "File deleted", id: "f1" };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(files.delete("f1")).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/files/f1");
    expect(init.method).toBe("DELETE");
  });
});

describe("removed surface", () => {
  it("no longer exposes dead endpoints or deprecated aliases", () => {
    const gone = [
      "search",
      "semanticSearch",
      "ask",
      "askStream",
      "triggerExtraction",
      "embed",
      "listFiles",
      "uploadFile",
      "downloadFile",
      "deleteFile",
      "searchFiles",
    ];
    for (const name of gone) {
      // `in` walks the prototype chain, same as instance method lookup
      expect(name in files).toBe(false);
    }
  });
});
