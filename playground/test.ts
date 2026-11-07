import 'dotenv/config';
import chalk from 'chalk';
import { KyroClient, KyroApiError } from "../src";
import type { AskStreamEvent } from "../src";

// ── Console helpers ───────────────────────────────────────────────────────────

const c = {
    success: (s: string) => chalk.green(s),
    error:   (s: string) => chalk.red(s),
    warn:    (s: string) => chalk.yellow(s),
    info:    (s: string) => chalk.blue(s),
    header:  (s: string) => chalk.cyan(chalk.bold(s)),
    dim:     (s: string) => chalk.dim(s),
};

function truncate(obj: any, maxLength = 300): string {
    if (obj === null || obj === undefined) return "null";
    const str = JSON.stringify(obj, null, 2);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "\n  ... (truncated)";
}

function logResponse(prefix: string, data: any) {
    console.log(`  ${c.success(prefix + ":")}`, truncate(data));
}

function logError(prefix: string, error: unknown) {
    if (error instanceof KyroApiError) {
        console.error(
            `  ${c.error(prefix + " FAILED:")}`,
            `[${chalk.red(error.status)}] ${chalk.bold(error.code)}: ${error.message}`
        );
        if (error.details && error.details.length > 0) {
            console.error("    Details:", error.details);
        }
    } else {
        console.error(`  ${c.error(prefix + " FAILED:")}`, error);
    }
}

function logSkip(prefix: string, reason: string) {
    console.log(`  ${c.warn(prefix + " SKIPPED:")} ${c.dim(reason)}`);
}

// ── Client setup ──────────────────────────────────────────────────────────────

const API_KEY = process.env.KYRO_API_KEY || "kyro_live_test";

console.log("API KEY:", API_KEY);

const client = new KyroClient({
    baseURL: "http://localhost:3000/api/v1",
    apiKey:  API_KEY,
});

// ── State shared across test sections ────────────────────────────────────────

let uploadedFileId     = "";
let uploadedFileId2    = "";
let collectionId       = "";

// ── Health ────────────────────────────────────────────────────────────────────

async function testHealth() {
    console.log(c.header("\n━━━ Health ━━━"));

    try {
        console.log(c.info("  → getHealth"));
        const res = await client.health.getHealth();
        logResponse("Health", res);
    } catch (e) {
        logError("getHealth", e);
    }
}

// ── Files ─────────────────────────────────────────────────────────────────────

async function testFiles() {
    console.log(c.header("\n━━━ Files ━━━"));

    // list (before uploads — should be empty or existing files)
    try {
        console.log(c.info("  → list"));
        const res = await client.files.list(5);
        logResponse("List", res);
    } catch (e) {
        logError("list", e);
    }

    // upload #1
    try {
        console.log(c.info("  → upload (txt)"));
        const blob = new Blob(
            ["The quick brown fox jumps over the lazy dog. Kyro is a document storage platform."],
            { type: "text/plain" }
        );
        const res = await client.files.upload(blob, "playground-1.txt");
        logResponse("Upload #1", res);
        uploadedFileId = res.id;
    } catch (e) {
        logError("upload #1", e);
    }

    // upload #2 (used to test multi-file collection later)
    try {
        console.log(c.info("  → upload (txt #2)"));
        const blob = new Blob(
            ["Hybrid search combines BM25 and vector retrieval using Reciprocal Rank Fusion."],
            { type: "text/plain" }
        );
        const res = await client.files.upload(blob, "playground-2.txt");
        logResponse("Upload #2", res);
        uploadedFileId2 = res.id;
    } catch (e) {
        logError("upload #2", e);
    }

    // download
    try {
        console.log(c.info("  → download"));
        if (!uploadedFileId) { logSkip("download", "no file id"); }
        else {
            const blob = await client.files.download(uploadedFileId);
            console.log(`  ${c.success("Download:")} Blob — size=${blob.size}, type="${blob.type}"`);
        }
    } catch (e) {
        logError("download", e);
    }

    // getText
    try {
        console.log(c.info("  → getText"));
        if (!uploadedFileId) { logSkip("getText", "no file id"); }
        else {
            const res = await client.files.getText(uploadedFileId);
            logResponse("getText", res);
        }
    } catch (e) {
        logError("getText", e);
    }

}

// ── Metadata ──────────────────────────────────────────────────────────────────

async function testMetadata() {
    console.log(c.header("\n━━━ Metadata ━━━"));

    if (!uploadedFileId) {
        logSkip("all metadata tests", "no file id from upload");
        return;
    }

    // setMetadata (upsert)
    try {
        console.log(c.info("  → setMetadata"));
        const res = await client.files.setMetadata(uploadedFileId, {
            document_type: "playground",
            matter_number: "M-2026-001",
            author:        "test-runner",
        });
        logResponse("setMetadata", res);
    } catch (e) {
        logError("setMetadata", e);
    }

    // getMetadata
    try {
        console.log(c.info("  → getMetadata"));
        const res = await client.files.getMetadata(uploadedFileId);
        logResponse("getMetadata", res);
    } catch (e) {
        logError("getMetadata", e);
    }

    // partial update (overwrite one key)
    try {
        console.log(c.info("  → setMetadata (partial update)"));
        const res = await client.files.setMetadata(uploadedFileId, {
            matter_number: "M-2026-002",
        });
        logResponse("setMetadata (partial)", res);
    } catch (e) {
        logError("setMetadata (partial)", e);
    }

    // deleteMetadataKey
    try {
        console.log(c.info("  → deleteMetadataKey (author)"));
        await client.files.deleteMetadataKey(uploadedFileId, "author");
        console.log(`  ${c.success("deleteMetadataKey:")} ok`);
    } catch (e) {
        logError("deleteMetadataKey", e);
    }

    // confirm deletion
    try {
        console.log(c.info("  → getMetadata (after delete)"));
        const res = await client.files.getMetadata(uploadedFileId);
        logResponse("getMetadata (after delete)", res);
    } catch (e) {
        logError("getMetadata (after delete)", e);
    }
}

// ── Collections ───────────────────────────────────────────────────────────────

async function testCollections() {
    console.log(c.header("\n━━━ Collections ━━━"));

    // create
    try {
        console.log(c.info("  → create"));
        const res = await client.collections.create({
            name:        "Playground Collection",
            description: "Created by the test runner",
        });
        logResponse("create", res);
        collectionId = res.id;
    } catch (e) {
        logError("create", e);
    }

    // list
    try {
        console.log(c.info("  → list"));
        const res = await client.collections.list();
        logResponse("list", res);
    } catch (e) {
        logError("list", e);
    }

    // get (with stats)
    try {
        console.log(c.info("  → get"));
        if (!collectionId) { logSkip("get", "no collection id"); }
        else {
            const res = await client.collections.get(collectionId);
            logResponse("get", res);
        }
    } catch (e) {
        logError("get", e);
    }

    // update
    try {
        console.log(c.info("  → update"));
        if (!collectionId) { logSkip("update", "no collection id"); }
        else {
            const res = await client.collections.update(collectionId, {
                description: "Updated by test runner",
            });
            logResponse("update", res);
        }
    } catch (e) {
        logError("update", e);
    }

    // addFiles
    try {
        console.log(c.info("  → addFiles"));
        if (!collectionId || (!uploadedFileId && !uploadedFileId2)) {
            logSkip("addFiles", "missing collection or file ids");
        } else {
            const fileIds = [uploadedFileId, uploadedFileId2].filter(Boolean);
            const res = await client.collections.addFiles(collectionId, { fileIds });
            logResponse("addFiles", res);
        }
    } catch (e) {
        logError("addFiles", e);
    }

    // listFiles
    try {
        console.log(c.info("  → listFiles"));
        if (!collectionId) { logSkip("listFiles", "no collection id"); }
        else {
            const res = await client.collections.listFiles(collectionId);
            logResponse("listFiles", res);
        }
    } catch (e) {
        logError("listFiles", e);
    }

    // removeFile
    try {
        console.log(c.info("  → removeFile (file #2)"));
        if (!collectionId || !uploadedFileId2) {
            logSkip("removeFile", "missing collection or file id");
        } else {
            await client.collections.removeFile(collectionId, uploadedFileId2);
            console.log(`  ${c.success("removeFile:")} ok`);
        }
    } catch (e) {
        logError("removeFile", e);
    }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function testCleanup() {
    console.log(c.header("\n━━━ Cleanup ━━━"));

    // delete collection (does not delete the files)
    try {
        console.log(c.info("  → collections.delete"));
        if (!collectionId) { logSkip("collections.delete", "no collection id"); }
        else {
            await client.collections.delete(collectionId);
            console.log(`  ${c.success("collections.delete:")} ok`);
        }
    } catch (e) {
        logError("collections.delete", e);
    }

    // delete files
    for (const [label, id] of [["file #1", uploadedFileId], ["file #2", uploadedFileId2]] as const) {
        try {
            console.log(c.info(`  → files.delete (${label})`));
            if (!id) { logSkip(`files.delete (${label})`, "no file id"); continue; }
            const res = await client.files.delete(id);
            logResponse(`delete (${label})`, res);
        } catch (e) {
            logError(`delete (${label})`, e);
        }
    }
}

// ── v1 smoke test ─────────────────────────────────────────────────────────────

async function testV1Smoke() {
    console.log(c.header("\n━━━ v1 Smoke Test ━━━"));

    const v1 = new KyroClient({
        baseURL: "http://localhost/api/v1",
        apiKey:  API_KEY,
    });

    try {
        console.log(c.info("  → list (v1)"));
        const res = await v1.files.list(3);
        logResponse("list (v1)", res);
    } catch (e) {
        logError("list (v1)", e);
    }

    try {
        console.log(c.info("  → upload (v1)"));
        const blob = new Blob(["V1 smoke test"], { type: "text/plain" });
        const res  = await v1.files.upload(blob, "smoke-v1.txt");
        logResponse("upload (v1)", res);

        // immediate cleanup
        await v1.files.delete(res.id);
        console.log(`  ${c.success("delete (v1):")} ok`);
    } catch (e) {
        logError("upload/delete (v1)", e);
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function runAllTests() {
    console.log(c.header("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(c.header("  Kyro SDK Playground"));
    console.log(c.header("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(c.info("API Key:"), API_KEY);

    await testHealth();
    await testFiles();
    await testMetadata();
    await testCollections();
    await testCleanup();
    await testV1Smoke();

    console.log(c.header("\n━━━ All Tests Complete ━━━\n"));
}

runAllTests().catch(console.error);
