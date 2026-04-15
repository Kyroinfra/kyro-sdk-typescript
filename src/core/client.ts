import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { ExampleService } from "../services/example";

export class KyroClient {
  private http: HttpClient;

  public example: ExampleService;

  constructor(config: SDKConfig = {}) {
    const baseURL = config.baseURL || "http://localhost:80";

    this.http = new HttpClient(baseURL, config.apiKey);

    // Services
    this.example = new ExampleService(this.http);
  }
}
