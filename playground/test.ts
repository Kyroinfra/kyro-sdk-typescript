import 'dotenv/config';
import chalk from 'chalk';
import { KyroClient, KyroApiError } from "../src";

const c = {
    success: (s: string) => chalk.green(s),
    error: (s: string) => chalk.red(s),
    warn: (s: string) => chalk.yellow(s),
    info: (s: string) => chalk.blue(s),
    header: (s: string) => chalk.cyan(chalk.bold(s)),
};

const API_KEY = process.env.KYRO_API_KEY || "kyro_live_test";

console.log("API KEY:", API_KEY);

const client = new KyroClient({
    baseURL: "http://localhost/api/v2",
    apiKey: API_KEY,
});

let lastFileId = "";
let lastSearchResult: any = null;

function truncate(obj: any, maxLength: number = 200): string {
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
        console.error(`  ${c.error(prefix + " FAILED:")}`, `[${chalk.red(error.status)}] ${chalk.bold(error.code)}: ${error.message}`);
        if (error.details && error.details.length > 0) {
            console.error("    Details:", error.details);
        }
    } else {
        console.error(`  ${c.error(prefix + " FAILED:")}`, error);
    }
}

async function testHealth() {
    console.log(c.header("\n--- Testing Health ---"));
    try {
        console.log(c.info("  → Testing getHealth..."));
        const res = await client.health.getHealth();
        logResponse("Health", res);
    } catch (e) {
        logError("getHealth", e);
    }
}

async function testFilesV2() {
    console.log(c.header("\n--- Testing Files (v2) ---"));

    try {
        console.log(c.info("  → Testing listFiles..."));
        const listRes = await client.files.listFiles();
        logResponse("List Files", listRes);
    } catch (e) {
        logError("ListFiles", e);
    }

    try {
        console.log(c.info("  → Testing uploadFile..."));
        const fileContent = new Blob(["Hello World"], { type: "text/plain" });
        const uploadRes = await client.files.uploadFile(fileContent, "test-v2.txt");
        logResponse("Upload File", uploadRes);
        lastFileId = uploadRes.id;
    } catch (e) {
        logError("UploadFile", e);
    }

    try {
        console.log(c.info("  → Testing downloadFile..."));
        await client.files.downloadFile(lastFileId || "file-id-here");
        console.log(c.success("  Download File: <Blob>"));
    } catch (e) {
        logError("DownloadFile", e);
    }

    try {
        console.log(c.info("  → Testing getText..."));
        if (lastFileId) {
            const textRes = await client.files.getText(lastFileId);
            logResponse("Get Text", textRes);
        }
    } catch (e) {
        logError("getText", e);
    }

    try {
        console.log(c.info("  → Testing searchFiles..."));
        const searchRes = await client.files.searchFiles("Hello");
        logResponse("Search Files", searchRes);
        if (searchRes.data.length > 0) {
            lastSearchResult = searchRes.data[0];
        }
    } catch (e) {
        logError("searchFiles", e);
    }

    try {
        console.log(c.info("  → Testing triggerExtraction..."));
        if (lastFileId) {
            const extractRes = await client.files.triggerExtraction(lastFileId);
            logResponse("Trigger Extraction", extractRes);
        }
    } catch (e) {
        logError("triggerExtraction", e);
    }

    try {
        console.log(c.info("  → Testing deleteFile..."));
        const deleteRes = await client.files.deleteFile(lastFileId || "file-id-here");
        logResponse("Delete File", deleteRes);
    } catch (e) {
        logError("DeleteFile", e);
    }
}

async function testFilesV1() {
    console.log(c.header("\n--- Testing Files (v1) ---"));

    const clientV1 = new KyroClient({
        baseURL: "http://localhost/api/v1",
        apiKey: API_KEY,
        version: "v1",
    });

    try {
        console.log(c.info("  → Testing listFiles (v1)..."));
        const listRes = await clientV1.files.listFiles();
        logResponse("List Files (v1)", listRes);
    } catch (e) {
        logError("ListFiles (v1)", e);
    }

    try {
        console.log(c.info("  → Testing uploadFile (v1)..."));
        const fileContent = new Blob(["V1 Test"], { type: "text/plain" });
        const uploadRes = await clientV1.files.uploadFile(fileContent, "test-v1.txt");
        logResponse("Upload File (v1)", uploadRes);
    } catch (e) {
        logError("UploadFile (v1)", e);
    }
}

async function runAllTests() {
    console.log(c.header("Running Kyro SDK Tests..."));
    console.log(c.info("API Key:"), API_KEY);

    await testHealth();
    await testFilesV2();
    await testFilesV1();

    console.log(c.header("\n--- All Tests Complete ---"));
}

runAllTests().catch(console.error);
