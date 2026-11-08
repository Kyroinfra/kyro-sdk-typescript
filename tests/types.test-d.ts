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
  HealthResponse,
  MetadataFilters,
  OffsetPagination,
  OffsetPaginatedResponse,
  AskInput,
  AskResponse,
  AskStreamEvent,
  AskTurn,
  RetrievalSource,
  SearchInput,
  SearchResponse,
  TextExtractionResponse,
  UpdateCollectionResponse,
} from "../src/core/types";
import type { KyroClient } from "../src/core/client";
import type { CollectionsService } from "../src/services/collections";
import type { FilesService } from "../src/services/files";
import type { HealthService } from "../src/services/health";

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

describe("HealthResponse", () => {
  it("is the exact four-field server body", () => {
    expectTypeOf<HealthResponse>().toEqualTypeOf<{
      status:    "ok" | "degraded";
      uptime:    number;
      timestamp: string;
      database:  "connected" | "disconnected";
    }>();
  });

  it("getHealth resolves it", () => {
    type GetHealthReturn = Awaited<ReturnType<HealthService["getHealth"]>>;
    expectTypeOf<GetHealthReturn>().toEqualTypeOf<HealthResponse>();
  });
});

describe("SearchResponse", () => {
  it("is the flat hybrid-retrieval wrapper", () => {
    expectTypeOf<SearchResponse>().toEqualTypeOf<{
      data:  RetrievalSource[];
      query: string;
      limit: number;
    }>();
  });

  it("client.search resolves it", () => {
    type SearchReturn = Awaited<ReturnType<KyroClient["search"]>>;
    expectTypeOf<SearchReturn>().toEqualTypeOf<SearchResponse>();
  });
});

describe("SearchInput", () => {
  it("keeps only wire-backed fields — no minScore", () => {
    expectTypeOf<SearchInput["query"]>().toEqualTypeOf<string>();
    expectTypeOf<SearchInput["limit"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SearchInput["filters"]>().toEqualTypeOf<MetadataFilters | undefined>();
  });
});

describe("AskTurn", () => {
  it("is the server's history turn shape", () => {
    expectTypeOf<AskTurn["role"]>().toEqualTypeOf<"user" | "assistant">();
    expectTypeOf<AskTurn["content"]>().toEqualTypeOf<string>();
  });
});

describe("AskInput", () => {
  it("has exactly the wire-backed fields — no minScore, no stream", () => {
    expectTypeOf<keyof AskInput>().toEqualTypeOf<
      "question" | "fileIds" | "collectionId" | "filters" | "topK" | "model" | "history"
    >();
  });
});

describe("AskResponse", () => {
  it("is the flat non-streaming body", () => {
    expectTypeOf<AskResponse>().toEqualTypeOf<{ answer: string; sources: RetrievalSource[] }>();
  });

  it("client.ask resolves it", () => {
    expectTypeOf<Awaited<ReturnType<KyroClient["ask"]>>>().toEqualTypeOf<AskResponse>();
  });
});

describe("AskStreamEvent", () => {
  it("is the inline four-event union", () => {
    expectTypeOf<AskStreamEvent>().toEqualTypeOf<
      | { type: "sources"; sources: RetrievalSource[] }
      | { type: "chunk"; text: string }
      | { type: "done" }
      | { type: "error"; message: string }
    >();
  });

  it("client.askStream yields it", () => {
    expectTypeOf<ReturnType<KyroClient["askStream"]>>().toEqualTypeOf<AsyncGenerator<AskStreamEvent>>();
  });
});
