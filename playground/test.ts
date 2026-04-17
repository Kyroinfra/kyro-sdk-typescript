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
const JWT_TOKEN = process.env.KYRO_JWT_TOKEN || "jwt_token_here";

console.log("API KEY", API_KEY);
console.log("JWT", JWT_TOKEN);

const client = new KyroClient({
    apiKey: API_KEY,
    token: JWT_TOKEN,
});

const testHealthClient = new KyroClient({
    baseURL: "http://localhost:80",
});

let registeredEmail = "";
let lastMemberId = "";
let lastKeyId = "";
let lastFileId = "";

function randomEmail() {
    return `test${Date.now()}${Math.random().toString(36).substring(2, 8)}@example.com`;
}

function randomOrgName() {
    return `Test Org ${Date.now()}`;
}

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
        const res = await testHealthClient.health.getHealth();
        logResponse("Health", res);
    } catch (e) {
        logError("getHealth", e);
    }
}

async function testAuth() {
    console.log(c.header("\n--- Testing Auth ---"));

    const testEmail = randomEmail();
    const testOrgName = randomOrgName();

    try {
        console.log(c.info("  → Testing register..."));
        const registerRes = await client.auth.register({
            email: testEmail,
            password: "password123",
            orgName: testOrgName,
        });
        logResponse("Register", registerRes);
    } catch (e) {
        logError("Register", e);
    }

    try {
        console.log(c.info("  → Testing login..."));
        const loginRes = await client.auth.login({
            email: testEmail,
            password: "password123",
        });
        logResponse("Login", loginRes);
    } catch (e) {
        logError("Login", e);
    }

    try {
        console.log(c.info("  → Testing getMe..."));
        const meRes = await client.auth.getMe();
        logResponse("Get Me", meRes);
    } catch (e) {
        logError("GetMe", e);
    }
}

async function testOrg() {
    console.log(c.header("\n--- Testing Org ---"));

    try {
        console.log(c.info("  → Testing getOrg..."));
        const orgRes = await client.org.getOrg();
        logResponse("Get Org", orgRes);
    } catch (e) {
        logError("GetOrg", e);
    }

    try {
        console.log(c.info("  → Testing listMembers..."));
        const membersRes = await client.org.listMembers();
        logResponse("List Members", membersRes);
    } catch (e) {
        logError("ListMembers", e);
    }

    try {
        console.log(c.info("  → Testing inviteMember..."));
        const inviteRes = await client.org.inviteMember({
            email: randomEmail(),
            password: "password123",
            role: "member",
        });
        logResponse("Invite Member", inviteRes);
        lastMemberId = inviteRes.id;
    } catch (e) {
        logError("InviteMember", e);
    }

    try {
        console.log(c.info("  → Testing removeMember..."));
        const removeRes = await client.org.removeMember(lastMemberId || "member-id-here");
        logResponse("Remove Member", removeRes);
    } catch (e) {
        logError("RemoveMember", e);
    }
}

async function testKeys() {
    console.log(c.header("\n--- Testing Keys ---"));

    try {
        console.log(c.info("  → Testing listKeys..."));
        const listRes = await client.keys.listKeys();
        logResponse("List Keys", listRes);
    } catch (e) {
        logError("ListKeys", e);
    }

    try {
        console.log(c.info("  → Testing createKey..."));
        const createRes = await client.keys.createKey({
            name: "My API Key",
            scopes: ["read", "write"],
        });
        logResponse("Create Key", createRes);
        lastKeyId = createRes.id;
    } catch (e) {
        logError("CreateKey", e);
    }

    try {
        console.log(c.info("  → Testing revokeKey..."));
        const revokeRes = await client.keys.revokeKey(lastKeyId || "key-id-here");
        logResponse("Revoke Key", revokeRes);
    } catch (e) {
        logError("RevokeKey", e);
    }
}

async function testFiles() {
    console.log(c.header("\n--- Testing Files ---"));

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
        const uploadRes = await client.files.uploadFile(fileContent, "test.txt");
        logResponse("Upload File", uploadRes);
        lastFileId = uploadRes.id;
    } catch (e) {
        logError("UploadFile", e);
    }

    try {
        console.log(c.info("  → Testing downloadFile..."));
        const downloadRes = await client.files.downloadFile(lastFileId || "file-id-here");
        console.log(c.success("  Download File: <Blob>"));
    } catch (e) {
        logError("DownloadFile", e);
    }

    try {
        console.log(c.info("  → Testing deleteFile..."));
        const deleteRes = await client.files.deleteFile(lastFileId || "file-id-here");
        logResponse("Delete File", deleteRes);
    } catch (e) {
        logError("DeleteFile", e);
    }
}

async function testUsage() {
    console.log(c.header("\n--- Testing Usage ---"));

    try {
        console.log(c.info("  → Testing getUsage..."));
        const usageRes = await client.usage.getUsage("2024-01-01", "2024-01-31");
        logResponse("Get Usage", usageRes);
    } catch (e) {
        logError("GetUsage", e);
    }

    try {
        console.log(c.info("  → Testing getDailyUsage..."));
        const dailyRes = await client.usage.getDailyUsage("2024-01-01", "2024-01-31");
        logResponse("Get Daily Usage", dailyRes);
    } catch (e) {
        logError("GetDailyUsage", e);
    }
}

async function runAllTests() {
    console.log(c.header("Running Kyro SDK Tests..."));
    console.log(c.info("API Key:"), API_KEY);
    console.log(c.info("JWT Token:"), JWT_TOKEN ? c.success("set") : c.warn("not set"));

    await testHealth();
    await testAuth();
    await testOrg();
    await testKeys();
    await testFiles();
    await testUsage();

    console.log(c.header("\n--- All Tests Complete ---"));
}

runAllTests().catch(console.error);
