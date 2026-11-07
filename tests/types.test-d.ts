import { describe, expectTypeOf, it } from "vitest";
import type {
  CollectionDetail,
  CollectionFile,
  CollectionFilesResponse,
  CollectionSummary,
  CreateCollectionResponse,
  FileListRow,
  FileRecord,
  FileStatus,
  FileUploadResponse,
  OffsetPagination,
  OffsetPaginatedResponse,
  TextExtractionResponse,
  UpdateCollectionResponse,
} from "../src/core/types";
import type { CollectionsService } from "../src/services/collections";
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

describe("CollectionSummary", () => {
  it("is the exact list shape — no slug, no detail-only fields", () => {
    expectTypeOf<CollectionSummary>().toEqualTypeOf<{
      id: string;
      name: string;
      description: string | null;
      createdAt: string;
      updatedAt: string;
      fileCount: number;
      embeddedCount: number;
      pendingCount: number;
      failedCount: number;
    }>();
  });
});

describe("CollectionDetail", () => {
  it("adds the detail-only fields, required", () => {
    expectTypeOf<CollectionDetail["skippedCount"]>().toEqualTypeOf<number>();
    expectTypeOf<CollectionDetail["queryReady"]>().toEqualTypeOf<boolean>();
  });
});

describe("CreateCollectionResponse", () => {
  it("is the narrowed 201 shape", () => {
    expectTypeOf<CreateCollectionResponse>().toEqualTypeOf<{
      id: string;
      name: string;
      description: string | null;
      createdAt: string;
    }>();
  });
});

describe("UpdateCollectionResponse", () => {
  it("is the narrowed update shape", () => {
    expectTypeOf<UpdateCollectionResponse>().toEqualTypeOf<{
      id: string;
      name: string;
      description: string | null;
      updatedAt: string;
    }>();
  });
});

describe("CollectionFilesResponse", () => {
  it("uses offset pagination", () => {
    expectTypeOf<CollectionFilesResponse>().toEqualTypeOf<OffsetPaginatedResponse<CollectionFile>>();
    expectTypeOf<CollectionFilesResponse["pagination"]>().toEqualTypeOf<OffsetPagination>();
  });
});

describe("CollectionsService", () => {
  it("returns the real shapes, not pretend full records", () => {
    type ListReturn   = Awaited<ReturnType<CollectionsService["list"]>>;
    type CreateReturn = Awaited<ReturnType<CollectionsService["create"]>>;
    type GetReturn    = Awaited<ReturnType<CollectionsService["get"]>>;
    type UpdateReturn = Awaited<ReturnType<CollectionsService["update"]>>;
    expectTypeOf<ListReturn>().toEqualTypeOf<CollectionSummary[]>();
    expectTypeOf<CreateReturn>().toEqualTypeOf<CreateCollectionResponse>();
    expectTypeOf<GetReturn>().toEqualTypeOf<CollectionDetail>();
    expectTypeOf<UpdateReturn>().toEqualTypeOf<UpdateCollectionResponse>();
  });
});
