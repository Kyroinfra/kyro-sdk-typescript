import { HttpClient } from "./http";
import { SDKConfig } from "./types";
import { HealthService } from "../services/health";
import { AuthService } from "../services/auth";
import { OrgService } from "../services/org";
import { KeysService } from "../services/keys";
import { FilesService } from "../services/files";
import { UsageService } from "../services/usage";

export class KyroClient {
  private http: HttpClient;

  public health: HealthService;
  public auth: AuthService;
  public org: OrgService;
  public keys: KeysService;
  public files: FilesService;
  public usage: UsageService;

  constructor(config: SDKConfig = {}) {
    const baseURL = config.baseURL || "http://localhost:80/api/v1";

    this.http = new HttpClient(baseURL, config.apiKey, config.token);

    this.health = new HealthService(this.http);
    this.auth = new AuthService(this.http);
    this.org = new OrgService(this.http);
    this.keys = new KeysService(this.http);
    this.files = new FilesService(this.http);
    this.usage = new UsageService(this.http);
  }
}
