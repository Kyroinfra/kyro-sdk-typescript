import { KyroApiError } from "./errors";

export type AuthType = "apiKey";

export class HttpClient {
    constructor(
        private baseURL: string,
        private apiKey?: string
    ) { }

    private getHeaders(auth?: AuthType, contentType: string = "application/json"): HeadersInit {
        const headers: Record<string, string> = {};

        if (auth === "apiKey" && this.apiKey) {
            headers["X-API-Key"] = this.apiKey;
        }

        if (contentType !== "multipart/form-data") {
            headers["Content-Type"] = contentType;
        }

        return headers;
    }

    private async request<T>(
        path: string,
        options: RequestInit = {},
        auth?: AuthType
    ): Promise<T> {
        const headers = options.headers as Record<string, string> | undefined;
        const contentType = headers?.["Content-Type"] || "application/json";
        const isMultipart = contentType === "multipart/form-data";

        const { "Content-Type": _drop, ...safeHeaders } = (headers || {});

        const res = await fetch(`${this.baseURL}${path}`, {
            ...options,
            headers: {
                ...this.getHeaders(auth, contentType),
                ...(isMultipart ? safeHeaders : headers), // never forward Content-Type for multipart
            },
        });

        if (!res.ok) {
            const errorBody = await res.json().catch(() => ({ error: { message: `HTTP Error ${res.status}`, code: "http_error", details: [] } }));
            const error = errorBody.error || { message: `HTTP Error ${res.status}`, code: "http_error", details: [] };
            throw new KyroApiError(res.status, error.code, error.message, error.details);
        }

        if (res.status === 204) {
            return {} as T;
        }

        return res.json();
    }

    get<T>(path: string, auth?: AuthType) {
        return this.request<T>(path, {}, auth);
    }

    async getBlob(path: string, auth?: AuthType): Promise<Blob> {
        const headers = this.getHeaders(auth, "application/json");

        const res = await fetch(`${this.baseURL}${path}`, {
            headers,
        });

        if (!res.ok) {
            const errorBody = await res.json().catch(() => ({ error: { message: `HTTP Error ${res.status}`, code: "http_error", details: [] } }));
            const error = errorBody.error || { message: `HTTP Error ${res.status}`, code: "http_error", details: [] };
            throw new KyroApiError(res.status, error.code, error.message, error.details);
        }

        return res.blob();
    }

    post<T>(path: string, body?: unknown, auth?: AuthType) {
        return this.request<T>(path, {
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        }, auth);
    }

    postFormData<T>(path: string, formData: FormData, auth?: AuthType) {
        return this.request<T>(path, {
            method: "POST",
            body: formData,
            headers: {
                "Content-Type": "multipart/form-data", // signals getHeaders to skip Content-Type
            },
        }, auth);
    }

    put<T>(path: string, body: unknown, auth?: AuthType) {
        return this.request<T>(path, {
            method: "PUT",
            body: JSON.stringify(body),
        }, auth);
    }

    delete<T>(path: string, auth?: AuthType) {
        return this.request<T>(path, {
            method: "DELETE",
        }, auth);
    }
}
