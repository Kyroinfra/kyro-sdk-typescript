import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";

export class KyroClient {
    private http: HttpClient;
    private baseURL: string;

    public health: HealthService;
    public files: FilesService;

    constructor(config: SDKConfig) {
        this.baseURL = config.baseURL ?? "https://api.kyro.io/api/v1";
        this.http = new HttpClient(this.baseURL, config.apiKey);

        this.health = new HealthService();
        this.files = new FilesService(this.http);
    }
}
