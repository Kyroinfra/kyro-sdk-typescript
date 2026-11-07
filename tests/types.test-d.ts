import { describe, expectTypeOf, it } from "vitest";
import type {
  CollectionFile,
  FileListRow,
  FileRecord,
  FileStatus,
  FileUploadResponse,
  TextExtractionResponse,
} from "../src/core/types";
import type { FilesService } from "../src/services/files";

describe("FileStatus", () => {
  it("is exactly the five server values", () => {
    expectTypeOf<FileStatus>().toEqualTypeOf<
      "pending" | "processing" | "ready" | "failed" | "skipped"
    >();
  });
});

describe("FileRecord", () => {
  it("carries the single status field", () => {
    expectTypeOf<FileRecord["status"]>().toEqualTypeOf<FileStatus>();
    expectTypeOf<FileRecord["id"]>().toEqualTypeOf<string>();
    expectTypeOf<FileRecord["name"]>().toEqualTypeOf<string>();
    expectTypeOf<FileRecord["mimeType"]>().toEqualTypeOf<string>();
    expectTypeOf<FileRecord["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<FileRecord["createdAt"]>().toEqualTypeOf<string>();
  });
});

describe("FileUploadResponse", () => {
  it("is the plain file record — uploads return no extracted text", () => {
    expectTypeOf<FileUploadResponse>().toEqualTypeOf<FileRecord>();
  });
});

describe("FileListRow", () => {
  it("adds an optional error to the record", () => {
    expectTypeOf<FileListRow["error"]>().toEqualTypeOf<string | undefined>();
  });
});

describe("TextExtractionResponse", () => {
  it("uses the single status enum", () => {
    expectTypeOf<TextExtractionResponse["status"]>().toEqualTypeOf<FileStatus>();
  });
});

describe("CollectionFile", () => {
  it("inherits status and keeps addedAt", () => {
    expectTypeOf<CollectionFile["status"]>().toEqualTypeOf<FileStatus>();
    expectTypeOf<CollectionFile["addedAt"]>().toEqualTypeOf<string>();
  });
});

describe("FilesService.upload", () => {
  it("still accepts the DOM File", () => {
    expectTypeOf<Parameters<FilesService["upload"]>[0]>().toEqualTypeOf<File | Blob>();
  });
});
