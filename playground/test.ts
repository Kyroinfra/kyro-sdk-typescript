import { KyroClient } from "../src";

const client = new KyroClient({
    baseURL: "http://localhost:80",
});

async function test() {
    const res = await client.example.getHealth();
    console.log(res);
}

test();
