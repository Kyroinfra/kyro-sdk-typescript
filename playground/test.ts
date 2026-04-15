import 'dotenv/config';
import { KyroClient } from "../src";

const API_KEY = process.env.KYRO_API_KEY || "kyro_live_test";
const JWT_TOKEN = process.env.KYRO_JWT_TOKEN || "jwt_token_here";

console.log("API KEY", API_KEY);
console.log("JWT", JWT_TOKEN);

const client = new KyroClient({
    baseURL: "http://localhost:80/api/v1",
    apiKey: API_KEY,
    token: JWT_TOKEN,
});

const testHealthClient = new KyroClient({
    baseURL: "http://localhost:80",
});

async function testHealth() {
    console.log("\n--- Testing Health ---");
    try {
        console.log("  → Testing getHealth...");
        const res = await testHealthClient.health.getHealth();
        console.log("  Health:", res);
    } catch (e) {
        console.error("  getHealth FAILED:", e);
    }
}

async function testAuth() {
    console.log("\n--- Testing Auth ---");

    try {
        console.log("  → Testing register...");
        const registerRes = await client.auth.register({
            email: "test@example.com",
            password: "password123",
            orgName: "Test Org",
        });
        console.log("  Register:", registerRes);
    } catch (e) {
        console.error("  Register FAILED:", e);
    }

    try {
        console.log("  → Testing login...");
        const loginRes = await client.auth.login({
            email: "test@example.com",
            password: "password123",
        });
        console.log("  Login:", loginRes);
    } catch (e) {
        console.error("  Login FAILED:", e);
    }

    try {
        console.log("  → Testing getMe...");
        const meRes = await client.auth.getMe();
        console.log("  Get Me:", meRes);
    } catch (e) {
        console.error("  Get Me FAILED:", e);
    }
}

async function testOrg() {
    console.log("\n--- Testing Org ---");

    try {
        console.log("  → Testing getOrg...");
        const orgRes = await client.org.getOrg();
        console.log("  Get Org:", orgRes);
    } catch (e) {
        console.error("  Get Org FAILED:", e);
    }

    try {
        console.log("  → Testing listMembers...");
        const membersRes = await client.org.listMembers();
        console.log("  List Members:", membersRes);
    } catch (e) {
        console.error("  List Members FAILED:", e);
    }

    try {
        console.log("  → Testing inviteMember...");
        const inviteRes = await client.org.inviteMember({
            email: "newuser@example.com",
            password: "password123",
            role: "member",
        });
        console.log("  Invite Member:", inviteRes);
    } catch (e) {
        console.error("  Invite Member FAILED:", e);
    }

    try {
        console.log("  → Testing removeMember...");
        const removeRes = await client.org.removeMember("member-id-here");
        console.log("  Remove Member:", removeRes);
    } catch (e) {
        console.error("  Remove Member FAILED:", e);
    }
}

async function testKeys() {
    console.log("\n--- Testing Keys ---");

    try {
        console.log("  → Testing listKeys...");
        const listRes = await client.keys.listKeys();
        console.log("  List Keys:", listRes);
    } catch (e) {
        console.error("  List Keys FAILED:", e);
    }

    try {
        console.log("  → Testing createKey...");
        const createRes = await client.keys.createKey({
            name: "My API Key",
            scopes: ["read", "write"],
        });
        console.log("  Create Key:", createRes);
    } catch (e) {
        console.error("  Create Key FAILED:", e);
    }

    try {
        console.log("  → Testing revokeKey...");
        const revokeRes = await client.keys.revokeKey("key-id-here");
        console.log("  Revoke Key:", revokeRes);
    } catch (e) {
        console.error("  Revoke Key FAILED:", e);
    }
}

async function testFiles() {
    console.log("\n--- Testing Files ---");

    try {
        console.log("  → Testing listFiles...");
        const listRes = await client.files.listFiles();
        console.log("  List Files:", listRes);
    } catch (e) {
        console.error("  List Files FAILED:", e);
    }

    try {
        console.log("  → Testing uploadFile...");
        const fileContent = new Blob(["Hello World"], { type: "text/plain" });
        const uploadRes = await client.files.uploadFile(fileContent, "test.txt");
        console.log("  Upload File:", uploadRes);
    } catch (e) {
        console.error("  Upload File FAILED:", e);
    }

    try {
        console.log("  → Testing downloadFile...");
        const downloadRes = await client.files.downloadFile("file-id-here");
        console.log("  Download File:", downloadRes);
    } catch (e) {
        console.error("  Download File FAILED:", e);
    }

    try {
        console.log("  → Testing deleteFile...");
        const deleteRes = await client.files.deleteFile("file-id-here");
        console.log("  Delete File:", deleteRes);
    } catch (e) {
        console.error("  Delete File FAILED:", e);
    }
}

async function testUsage() {
    console.log("\n--- Testing Usage ---");

    try {
        console.log("  → Testing getUsage...");
        const usageRes = await client.usage.getUsage("2024-01-01", "2024-01-31");
        console.log("  Get Usage:", usageRes);
    } catch (e) {
        console.error("  Get Usage FAILED:", e);
    }

    try {
        console.log("  → Testing getDailyUsage...");
        const dailyRes = await client.usage.getDailyUsage("2024-01-01", "2024-01-31");
        console.log("  Get Daily Usage:", dailyRes);
    } catch (e) {
        console.error("  Get Daily Usage FAILED:", e);
    }
}

async function runAllTests() {
    console.log("Running Kyro SDK Tests...");
    console.log("API Key:", API_KEY);
    console.log("JWT Token:", JWT_TOKEN ? "set" : "not set");

    await testHealth();
    await testAuth();
    await testOrg();
    await testKeys();
    await testFiles();
    await testUsage();

    console.log("\n--- All Tests Complete ---");
}

runAllTests().catch(console.error);
