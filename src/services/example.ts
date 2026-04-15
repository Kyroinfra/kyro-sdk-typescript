import { HttpClient } from "../core/http";

export class ExampleService {
    constructor(private http: HttpClient) { }

    async getHealth() {
        return this.http.get<{
            status: string;
            uptime: number;
            test: string;
            timestamp: string;
            database: string;
            redis: string;
        }>("/health");
    }

    async createUser(data: { name: string }) {
        return this.http.post("/users", data);
    }
}
