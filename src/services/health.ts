export class HealthService {
  private baseURL = "http://localhost:80";

  async getHealth() {
    const res = await fetch(`${this.baseURL}/health`);
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }
    return res.json();
  }
}