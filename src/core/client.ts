import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";

export class KyroClient {
  private http: HttpClient;
  private baseURL = "http://localhost:80/api/v1";

  public health: HealthService;
  public files: FilesService;

  constructor(config: SDKConfig) {
    this.http = new HttpClient(this.baseURL, config.apiKey);

    this.health = new HealthService();
    this.files = new FilesService(this.http);
  }
}