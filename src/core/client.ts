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
        if (config.baseURL) {
            // Trim trailing slashes first, so both "http://localhost:3000/"
            // and "http://localhost:3000/api/v1/" resolve cleanly. A baseURL
            // that already points at an API path is used as-is; anything else
            // gets the (only) API version path appended.
            const base = config.baseURL.replace(/\/+$/, "");
            this.baseURL = base.includes("/api/")
                ? base
                : `${base}/api/v1`;
        } else {
            this.baseURL = "https://api.kyro.io/api/v1";
        }

        this.http = new HttpClient(this.baseURL, config.apiKey);

        this.health      = new HealthService(this.baseURL);
        this.files       = new FilesService(this.http);
        this.collections = new CollectionsService(this.http);
    }
}
