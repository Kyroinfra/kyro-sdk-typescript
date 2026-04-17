import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { HealthService } from "../services/health";
import { FilesService } from "../services/files";

export class KyroClient {
  private http: HttpClient;

  public health: HealthService;
  public files: FilesService;

  constructor(config: SDKConfig = {}) {
    const baseURL = config.baseURL || "http://localhost:80/api/v1";

    this.http = new HttpClient(baseURL, config.apiKey);

    this.health = new HealthService(this.http);
    this.files = new FilesService(this.http);
  }
}