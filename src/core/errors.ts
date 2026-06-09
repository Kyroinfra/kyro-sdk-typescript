export class KyroApiError extends Error {
  constructor(
    public readonly status:   number,
    public readonly code:     string,
    message:                  string,
    public readonly details?: { message: string; path: string }[]
  ) {
    super(message);
    this.name = "KyroApiError";
    // Maintains proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, KyroApiError.prototype);
  }
}

export class KyroAuthError extends KyroApiError {
  constructor(message = "Invalid or missing API key") {
    super(401, "unauthorized", message);
    this.name = "KyroAuthError";
    Object.setPrototypeOf(this, KyroAuthError.prototype);
  }
}

export class KyroNotFoundError extends KyroApiError {
  constructor(resource = "Resource") {
    super(404, "not_found", `${resource} not found`);
    this.name = "KyroNotFoundError";
    Object.setPrototypeOf(this, KyroNotFoundError.prototype);
  }
}

export class KyroQuotaError extends KyroApiError {
  constructor(message = "Storage quota exceeded") {
    super(403, "quota_exceeded", message);
    this.name = "KyroQuotaError";
    Object.setPrototypeOf(this, KyroQuotaError.prototype);
  }
}

export class KyroRateLimitError extends KyroApiError {
  constructor(public readonly retryAfter?: number) {
    super(429, "rate_limit_exceeded", "Rate limit exceeded");
    this.name = "KyroRateLimitError";
    Object.setPrototypeOf(this, KyroRateLimitError.prototype);
  }
}

export class KyroValidationError extends KyroApiError {
  constructor(
    message: string,
    details?: { message: string; path: string }[]
  ) {
    super(400, "validation_error", message, details);
    this.name = "KyroValidationError";
    Object.setPrototypeOf(this, KyroValidationError.prototype);
  }
}
