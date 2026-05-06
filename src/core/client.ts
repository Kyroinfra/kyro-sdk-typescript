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
        const version = config.version ?? "v2";
        const apiVersion = config.version ?? "v2";
        
        if (config.baseURL) {
            const hasApi = config.baseURL.includes("/api/");
            this.baseURL = hasApi 
                ? config.baseURL 
                : `${config.baseURL}/api/${apiVersion}`;
        } else {
            this.baseURL = `https://api.kyro.io/api/${apiVersion}`;
        }
        
        this.http = new HttpClient(this.baseURL, config.apiKey);

        this.health = new HealthService();
        this.files = new FilesService(this.http);
    }
}
