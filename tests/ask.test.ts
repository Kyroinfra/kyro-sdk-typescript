import { afterEach, describe, expect, it, vi } from "vitest";
import { KyroClient } from "../src/core/client";
import {
  KyroNotFoundError,
  KyroUnprocessableError,
  KyroValidationError,
} from "../src/core/errors";
import type { AskInput, AskStreamEvent } from "../src/core/types";

const client = new KyroClient({ apiKey: "k", baseURL: "http://test.local/api/v1" });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A 200 text/event-stream response whose body arrives in fixed chunks. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function collectEvents(
  input: Parameters<typeof client.askStream>[0],
): Promise<AskStreamEvent[]> {
  const events: AskStreamEvent[] = [];
  for await (const event of client.askStream(input)) {
    events.push(event);
  }
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client.ask", () => {
  it("POSTs /ask with stream forced to false", async () => {
    const body = {
      answer: "4,200",
      sources: [{ fileId: "f1", fileName: "a.pdf", chunkIndex: 2, content: "total", rrfScore: 0.016 }],
    };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client.ask({ question: "totals?" })).resolves.toEqual(body);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/ask");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ question: "totals?", stream: false }));
  });

  it("passes topK, model, filters and history through", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { answer: "a", sources: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const input: AskInput = {
      question: "q",
      topK: 12,
      model: "llama3.1",
      filters: { document_type: "contract" },
      history: [
        { role: "user",      content: "first question" },
        { role: "assistant", content: "first answer" },
      ],
    };
    await client.ask(input);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({
      ...input,
      stream: false,
    }));
  });

  it("throws client-side when both scopes are provided", async () => {
    await expect(
      client.ask({ question: "q", collectionId: "c1", fileIds: ["f1"] })
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("maps 404/422 scope failures to the typed errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { error: "Collection not found" })));
    await expect(client.ask({ question: "q", collectionId: "nope" })).rejects.toBeInstanceOf(KyroNotFoundError);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(422, { error: "Scope resolves to nothing" })));
    await expect(client.ask({ question: "q", fileIds: ["gone"] })).rejects.toBeInstanceOf(KyroUnprocessableError);
  });

  it("surfaces malformed input via details", async () => {
    const details = [{ message: "Too big", path: ["history"] }];
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { error: "Invalid input", details })));
    const err = await client.ask({ question: "q" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroValidationError);
    expect((err as KyroValidationError).details).toEqual(details);
  });

  it("reports the RAG-disabled 400 verbatim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, {
      error: "OLLAMA_URL must be configured to use the /ask endpoint",
    })));
    const err = await client.ask({ question: "q" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KyroValidationError);
    expect((err as KyroValidationError).message).toBe("OLLAMA_URL must be configured to use the /ask endpoint");
  });
});

describe("client.askStream", () => {
  it("POSTs /ask with stream forced to true", async () => {
    const fetchMock = vi.fn(async () => sseResponse(['data: {"type":"done"}\n\n']));
    vi.stubGlobal("fetch", fetchMock);
    await collectEvents({ question: "q" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/ask");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ question: "q", stream: true }));
  });

  it("yields sources, chunks and done in wire order", async () => {
    const source = { fileId: "f1", fileName: "a.pdf", chunkIndex: 0, content: "c", rrfScore: 0.02 };
    const chunks = [
      `data: ${JSON.stringify({ type: "sources", sources: [source] })}\n\n`,
      'data: {"type":"chunk","text":"Answer part 1. "}\ndata: {"type":"chunk","text":"Part 2."}\n\n',
      'data: {"type":"done"}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const events = await collectEvents({ question: "Summarise." });
    expect(events).toEqual([
      { type: "sources", sources: [source] },
      { type: "chunk", text: "Answer part 1. " },
      { type: "chunk", text: "Part 2." },
      { type: "done" },
    ]);
  });

  it("reassembles frames split across network chunks", async () => {
    const chunks = [
      'data: {"type":"sou',
      'rces","sources":[]}\n\ndata: {"type":"chunk","text":"hi"}\n\ndata: {"type":"do',
      'ne"}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const events = await collectEvents({ question: "q" });
    expect(events).toEqual([
      { type: "sources", sources: [] },
      { type: "chunk", text: "hi" },
      { type: "done" },
    ]);
  });

  it("flushes a final frame that lacks the terminating blank line", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(['data: {"type":"done"}'])));
    await expect(collectEvents({ question: "q" })).resolves.toEqual([{ type: "done" }]);
  });

  it("surfaces in-band error events", async () => {
    const chunks = [
      'data: {"type":"sources","sources":[]}\n\n',
      'data: {"type":"error","message":"ollama exploded"}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const events = await collectEvents({ question: "q" });
    expect(events).toEqual([
      { type: "sources", sources: [] },
      { type: "error", message: "ollama exploded" },
    ]);
  });

  it("skips malformed and non-data lines", async () => {
    const chunks = [
      ": keep-alive comment\n",
      'data: not json\ndata: \ndata: {"type":"done"}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const events = await collectEvents({ question: "q" });
    expect(events).toEqual([{ type: "done" }]);
  });

  it("rejects when the scope fails before the stream opens", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(422, { error: "Scope resolves to nothing" })));
    await expect(collectEvents({ question: "q", fileIds: ["gone"] })).rejects.toBeInstanceOf(KyroUnprocessableError);
  });

  it("errors honestly when there is no body at all", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    await expect(collectEvents({ question: "q" })).rejects.toThrow("No response body for streaming ask");
  });

  it("throws client-side when both scopes are provided", async () => {
    await expect(
      collectEvents({ question: "q", collectionId: "c1", fileIds: ["f1"] })
    ).rejects.toBeInstanceOf(TypeError);
  });
});
