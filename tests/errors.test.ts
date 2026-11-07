import { describe, expect, it } from "vitest";
import {
  KyroApiError,
  KyroAuthError,
  KyroConflictError,
  KyroFileTooLargeError,
  KyroForbiddenError,
  KyroNotFoundError,
  KyroRateLimitError,
  KyroServiceUnavailableError,
  KyroStorageLimitError,
  KyroUnprocessableError,
  KyroUnsupportedMediaTypeError,
  KyroValidationError,
} from "../src/core/errors";
import { errorForStatus, parseErrorBody } from "../src/core/http";

describe("parseErrorBody", () => {
  it("reads a string-shaped error", () => {
    expect(parseErrorBody(400, { error: "Invalid input" }).message).toBe("Invalid input");
  });

  it("reads an object-shaped error", () => {
    expect(
      parseErrorBody(507, { error: { message: "Storage limit reached" } }).message
    ).toBe("Storage limit reached");
  });

  it("falls back to \"HTTP <status>\" for empty or non-object bodies", () => {
    expect(parseErrorBody(500, undefined).message).toBe("HTTP 500");
    expect(parseErrorBody(500, {}).message).toBe("HTTP 500");
    expect(parseErrorBody(500, "boom").message).toBe("HTTP 500");
  });

  it("keeps extra top-level fields in data", () => {
    const parsed = parseErrorBody(400, {
      error: "Some files not found or do not belong to your organisation",
      invalidFileIds: ["a", "b"],
    });
    expect(parsed.data).toEqual({ invalidFileIds: ["a", "b"] });
  });

  it("never leaks error/details/retryAfter into data", () => {
    const parsed = parseErrorBody(429, { error: "Too many requests", retryAfter: 30 });
    expect(parsed.retryAfter).toBe(30);
    expect(parsed.data).toBeUndefined();
  });

  it("derives the code from the status, not the body", () => {
    expect(parseErrorBody(403, { error: "Required scope: write" }).code).toBe("forbidden");
    expect(parseErrorBody(599, { error: "odd" }).code).toBe("http_error");
  });
});

describe("errorForStatus maps every status to its class", () => {
  const cases: Array<{
    status: number;
    body: unknown;
    cls: new (...args: never[]) => KyroApiError;
    code: string;
  }> = [
    { status: 400, body: { error: "Invalid input" }, cls: KyroValidationError, code: "validation_error" },
    { status: 401, body: { error: "Invalid API key" }, cls: KyroAuthError, code: "unauthorized" },
    { status: 403, body: { error: "Required scope: write" }, cls: KyroForbiddenError, code: "forbidden" },
    { status: 404, body: { error: { message: "File not found", statusCode: 404 } }, cls: KyroNotFoundError, code: "not_found" },
    { status: 409, body: { error: "Pipeline already in progress" }, cls: KyroConflictError, code: "conflict" },
    { status: 413, body: { error: { message: "File too large" } }, cls: KyroFileTooLargeError, code: "file_too_large" },
    { status: 415, body: { error: { message: "Unsupported file type: video/mp4" } }, cls: KyroUnsupportedMediaTypeError, code: "unsupported_media_type" },
    { status: 422, body: { error: "Collection has no files" }, cls: KyroUnprocessableError, code: "unprocessable" },
    { status: 429, body: { error: "Too many requests", retryAfter: 30 }, cls: KyroRateLimitError, code: "rate_limit_exceeded" },
    { status: 503, body: { error: { message: "Service degraded" } }, cls: KyroServiceUnavailableError, code: "service_unavailable" },
    { status: 507, body: { error: { message: "Storage limit reached" } }, cls: KyroStorageLimitError, code: "storage_limit_exceeded" },
  ];

  for (const c of cases) {
    it(`status ${c.status} -> ${c.cls.name}`, () => {
      const err = errorForStatus(c.status, c.body);
      expect(err).toBeInstanceOf(c.cls);
      expect(err).toBeInstanceOf(KyroApiError);
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(c.status);
      expect(err.code).toBe(c.code);
    });
  }

  it("does not double the not-found suffix", () => {
    expect(errorForStatus(404, { error: { message: "Collection not found" } }).message).toBe("Collection not found");
    expect(errorForStatus(404, { error: "File not found" }).message).toBe("File not found");
  });

  it("carries zod details with array paths on validation errors", () => {
    const err = errorForStatus(400, {
      error: "Invalid input",
      details: [{ message: "Required", path: ["body", "fileIds", 0] }],
    });
    expect(err).toBeInstanceOf(KyroValidationError);
    expect(err.details).toEqual([{ message: "Required", path: ["body", "fileIds", 0] }]);
  });

  it("surfaces retryAfter on rate-limit errors", () => {
    const err = errorForStatus(429, { error: "Too many requests", retryAfter: 12 });
    expect(err).toBeInstanceOf(KyroRateLimitError);
    expect(err.retryAfter).toBe(12);
  });

  it("surfaces extra body fields on .data", () => {
    const err = errorForStatus(400, {
      error: "File type not supported for extraction",
      supportedTypes: ["application/pdf", "text/plain"],
    });
    expect(err.data).toEqual({ supportedTypes: ["application/pdf", "text/plain"] });
  });

  it("returns the plain base class for unmapped statuses", () => {
    const err = errorForStatus(500, { error: { message: "boom" } });
    expect(err.constructor).toBe(KyroApiError);
    expect(err.code).toBe("http_error");
    expect(err.message).toBe("boom");
  });
});
