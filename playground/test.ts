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

const healthClient = new KyroClient({
    baseURL: "http://localhost:80",
});

const filesClient = new KyroClient({
    baseURL: "http://localhost:80/api/v1",
    apiKey: API_KEY,
});

let lastFileId = "";

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
        const res = await healthClient.health.getHealth();
        logResponse("Health", res);
    } catch (e) {
        logError("getHealth", e);
    }
}

async function testFiles() {
    console.log(c.header("\n--- Testing Files ---"));

    try {
        console.log(c.info("  → Testing listFiles..."));
        const listRes = await filesClient.files.listFiles();
        logResponse("List Files", listRes);
    } catch (e) {
        logError("ListFiles", e);
    }

    try {
        console.log(c.info("  → Testing uploadFile..."));
        const fileContent = new Blob(["Hello World"], { type: "text/plain" });
        const uploadRes = await filesClient.files.uploadFile(fileContent, "test.txt");
        logResponse("Upload File", uploadRes);
        lastFileId = uploadRes.id;
    } catch (e) {
        logError("UploadFile", e);
    }

    try {
        console.log(c.info("  → Testing downloadFile..."));
        await filesClient.files.downloadFile(lastFileId || "file-id-here");
        console.log(c.success("  Download File: <Blob>"));
    } catch (e) {
        logError("DownloadFile", e);
    }

    try {
        console.log(c.info("  → Testing deleteFile..."));
        const deleteRes = await filesClient.files.deleteFile(lastFileId || "file-id-here");
        logResponse("Delete File", deleteRes);
    } catch (e) {
        logError("DeleteFile", e);
    }
}

async function runAllTests() {
    console.log(c.header("Running Kyro SDK Tests..."));
    console.log(c.info("API Key:"), API_KEY);

    await testHealth();
    await testFiles();

    console.log(c.header("\n--- All Tests Complete ---"));
}

runAllTests().catch(console.error);
