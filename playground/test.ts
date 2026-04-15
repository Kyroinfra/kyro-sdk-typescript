import { KyroClient } from "../src";

const API_KEY = process.env.KYRO_API_KEY || "kyro_live_test";
const JWT_TOKEN = process.env.KYRO_JWT_TOKEN || "jwt_token_here";

const client = new KyroClient({
    baseURL: "http://localhost:80/api/v1",
    apiKey: API_KEY,
    token: JWT_TOKEN,
});


const testHealthClient = new KyroClient({
    baseURL: "http://localhost:80/health",
});

async function testHealth() {
    console.log("\n--- Testing Health ---");
    try {
        const res = await testHealthClient.health.getHealth();
        console.log("Health:", res);
    } catch (e) {
        console.error("Health failed:", e);
    }
}

async function testAuth() {
    console.log("\n--- Testing Auth ---");
    try {
        const registerRes = await client.auth.register({
            email: "test@example.com",
            password: "password123",
            orgName: "Test Org",
        });
        console.log("Register:", registerRes);

        const loginRes = await client.auth.login({
            email: "test@example.com",
            password: "password123",
        });
        console.log("Login:", loginRes);

        const meRes = await client.auth.getMe();
        console.log("Get Me:", meRes);
    } catch (e) {
        console.error("Auth failed:", e);
    }
}

async function testOrg() {
    console.log("\n--- Testing Org ---");
    try {
        const orgRes = await client.org.getOrg();
        console.log("Get Org:", orgRes);

        const membersRes = await client.org.listMembers();
        console.log("List Members:", membersRes);

        const inviteRes = await client.org.inviteMember({
            email: "newuser@example.com",
            password: "password123",
            role: "member",
        });
        console.log("Invite Member:", inviteRes);

        const removeRes = await client.org.removeMember("member-id-here");
        console.log("Remove Member:", removeRes);
    } catch (e) {
        console.error("Org failed:", e);
    }
}

async function testKeys() {
    console.log("\n--- Testing Keys ---");
    try {
        const listRes = await client.keys.listKeys();
        console.log("List Keys:", listRes);

        const createRes = await client.keys.createKey({
            name: "My API Key",
            scopes: ["read", "write"],
        });
        console.log("Create Key:", createRes);

        const revokeRes = await client.keys.revokeKey("key-id-here");
        console.log("Revoke Key:", revokeRes);
    } catch (e) {
        console.error("Keys failed:", e);
    }
}

async function testFiles() {
    console.log("\n--- Testing Files ---");
    try {
        const listRes = await client.files.listFiles();
        console.log("List Files:", listRes);

        const fileContent = new Blob(["Hello World"], { type: "text/plain" });
        const uploadRes = await client.files.uploadFile(fileContent, "test.txt");
        console.log("Upload File:", uploadRes);

        const downloadRes = await client.files.downloadFile("file-id-here");
        console.log("Download File:", downloadRes);

        const deleteRes = await client.files.deleteFile("file-id-here");
        console.log("Delete File:", deleteRes);
    } catch (e) {
        console.error("Files failed:", e);
    }
}

async function testUsage() {
    console.log("\n--- Testing Usage ---");
    try {
        const usageRes = await client.usage.getUsage("2024-01-01", "2024-01-31");
        console.log("Get Usage:", usageRes);

        const dailyRes = await client.usage.getDailyUsage("2024-01-01", "2024-01-31");
        console.log("Get Daily Usage:", dailyRes);
    } catch (e) {
        console.error("Usage failed:", e);
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
