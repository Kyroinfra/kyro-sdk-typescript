export class KyroApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { message: string; path: string }[]
  ) {
    super(message);
    this.name = "KyroApiError";
  }
}
