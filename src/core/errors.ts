// errors.ts — the typed error hierarchy. Every class carries the HTTP status,
// an SDK-derived code (the API does not send a code field), the server's
// message verbatim, optional zod validation `details`, and any extra
// top-level fields the API attached to the error body (e.g. invalidFileIds,
// supportedTypes) on `data`.

import type { ErrorDetail } from "./types";

export interface KyroErrorOptions {
  /** Per-field validation issues (zod), when the API sent them. */
  details?: ErrorDetail[];
  /** Seconds to wait before retrying a 429 — from the API's error body. */
  retryAfter?: number;
  /** Any other top-level fields the API attached to the error body. */
  data?: Record<string, unknown>;
}

export class KyroApiError extends Error {
  readonly status:      number;
  readonly code:        string;
  readonly details?:    ErrorDetail[];
  readonly retryAfter?: number;
  readonly data?:       Record<string, unknown>;

  constructor(status: number, code: string, message: string, options: KyroErrorOptions = {}) {
    super(message);
    this.name = "KyroApiError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.data = options.data;
    // Maintains proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, KyroApiError.prototype);
  }
}

export class KyroValidationError extends KyroApiError {
  constructor(message: string, options: KyroErrorOptions = {}) {
    super(400, "validation_error", message, options);
    this.name = "KyroValidationError";
    Object.setPrototypeOf(this, KyroValidationError.prototype);
  }
}

export class KyroAuthError extends KyroApiError {
  constructor(message = "Invalid or missing API key", options: KyroErrorOptions = {}) {
    super(401, "unauthorized", message, options);
    this.name = "KyroAuthError";
    Object.setPrototypeOf(this, KyroAuthError.prototype);
  }
}

// 403 is scope/role denial — the API's storage cap answers 507, not 403.
export class KyroForbiddenError extends KyroApiError {
  constructor(message = "Insufficient permissions", options: KyroErrorOptions = {}) {
    super(403, "forbidden", message, options);
    this.name = "KyroForbiddenError";
    Object.setPrototypeOf(this, KyroForbiddenError.prototype);
  }
}

export class KyroNotFoundError extends KyroApiError {
  constructor(message: string, options: KyroErrorOptions = {}) {
    // The server's message already says what was not found — never append to it.
    super(404, "not_found", message, options);
    this.name = "KyroNotFoundError";
    Object.setPrototypeOf(this, KyroNotFoundError.prototype);
  }
}

export class KyroConflictError extends KyroApiError {
  constructor(message: string, options: KyroErrorOptions = {}) {
    super(409, "conflict", message, options);
    this.name = "KyroConflictError";
    Object.setPrototypeOf(this, KyroConflictError.prototype);
  }
}

export class KyroFileTooLargeError extends KyroApiError {
  constructor(message = "File too large", options: KyroErrorOptions = {}) {
    super(413, "file_too_large", message, options);
    this.name = "KyroFileTooLargeError";
    Object.setPrototypeOf(this, KyroFileTooLargeError.prototype);
  }
}

export class KyroUnsupportedMediaTypeError extends KyroApiError {
  constructor(message = "Unsupported file type", options: KyroErrorOptions = {}) {
    super(415, "unsupported_media_type", message, options);
    this.name = "KyroUnsupportedMediaTypeError";
    Object.setPrototypeOf(this, KyroUnsupportedMediaTypeError.prototype);
  }
}

export class KyroUnprocessableError extends KyroApiError {
  constructor(message: string, options: KyroErrorOptions = {}) {
    super(422, "unprocessable", message, options);
    this.name = "KyroUnprocessableError";
    Object.setPrototypeOf(this, KyroUnprocessableError.prototype);
  }
}

export class KyroRateLimitError extends KyroApiError {
  constructor(message = "Rate limit exceeded", options: KyroErrorOptions = {}) {
    super(429, "rate_limit_exceeded", message, options);
    this.name = "KyroRateLimitError";
    Object.setPrototypeOf(this, KyroRateLimitError.prototype);
  }
}

export class KyroServiceUnavailableError extends KyroApiError {
  constructor(message = "Service degraded", options: KyroErrorOptions = {}) {
    super(503, "service_unavailable", message, options);
    this.name = "KyroServiceUnavailableError";
    Object.setPrototypeOf(this, KyroServiceUnavailableError.prototype);
  }
}

export class KyroStorageLimitError extends KyroApiError {
  constructor(message = "Storage limit reached", options: KyroErrorOptions = {}) {
    super(507, "storage_limit_exceeded", message, options);
    this.name = "KyroStorageLimitError";
    Object.setPrototypeOf(this, KyroStorageLimitError.prototype);
  }
}
