import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";
import { CollectionsService } from "../services/collections";

export class KyroClient {
    private http: HttpClient;
    private baseURL: string;

    public health:       HealthService;
    public files:        FilesService;
    public collections:  CollectionsService;

    constructor(config: SDKConfig) {
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

        this.health      = new HealthService(this.baseURL);
        this.files       = new FilesService(this.http);
        this.collections = new CollectionsService(this.http);
    }
}
