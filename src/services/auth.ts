import { HttpClient } from "../core/http";
import { User } from "../core/types";

interface RegisterRequest {
  email: string;
  password: string;
  orgName: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

export class AuthService {
  constructor(private http: HttpClient) {}

  async register(data: RegisterRequest) {
    return this.http.post<AuthResponse>("/auth/register", data);
  }

  async login(data: LoginRequest) {
    return this.http.post<AuthResponse>("/auth/login", data);
  }

  async getMe() {
    return this.http.get<User>("/auth/me", "bearer");
  }
}
