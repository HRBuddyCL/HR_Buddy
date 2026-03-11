import { resolveApiBaseUrl } from "@/lib/api/base-url";
import { getAuthToken, type TokenType } from "@/lib/auth/tokens";

type PrimitiveQueryValue = string | number | boolean;

type ApiRetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  statuses?: number[];
};

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  tokenType?: TokenType;
  query?: Record<string, PrimitiveQueryValue | undefined | null>;
  retry?: number | ApiRetryOptions;
};

export type ApiErrorBody = {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  error?: string;
  field?: string;
};

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, fallbackMessage: string) {
    super(resolveErrorMessage(body, fallbackMessage));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function resolveErrorMessage(body: ApiErrorBody | null, fallbackMessage: string) {
  const message = body?.message;

  if (Array.isArray(message) && message.length > 0) {
    return message.join(", ");
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallbackMessage;
}

function buildUrl(path: string, query?: ApiFetchOptions["query"]) {
  const apiBaseUrl = resolveApiBaseUrl();
  const target = `${apiBaseUrl}${path}`;
  const url = /^https?:\/\//i.test(apiBaseUrl)
    ? new URL(target)
    : new URL(target, typeof window !== "undefined" ? window.location.origin : "http://localhost");

  if (!query) {
    return url.toString();
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function tryParseJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function resolveRetryPolicy(method: string | undefined, retry: ApiFetchOptions["retry"]) {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  const defaultAttempts = normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS" ? 3 : 1;

  if (typeof retry === "number") {
    return {
      attempts: Math.max(1, retry),
      baseDelayMs: 700,
      statuses: new Set([502, 503, 504]),
    };
  }

  return {
    attempts: Math.max(1, retry?.attempts ?? defaultAttempts),
    baseDelayMs: Math.max(100, retry?.baseDelayMs ?? 700),
    statuses: new Set(retry?.statuses ?? [502, 503, 504]),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { tokenType, query, headers, body, retry, ...rest } = options;
  const retryPolicy = resolveRetryPolicy(rest.method, retry);

  const requestHeaders = new Headers(headers ?? {});
  requestHeaders.set("Accept", "application/json");

  let finalBody: BodyInit | undefined;

  if (body !== undefined && body !== null) {
    requestHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(body);
  }

  if (tokenType && !requestHeaders.has("Authorization")) {
    const token = getAuthToken(tokenType);
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  for (let attempt = 0; attempt < retryPolicy.attempts; attempt += 1) {
    try {
      const response = await fetch(buildUrl(path, query), {
        ...rest,
        headers: requestHeaders,
        body: finalBody,
      });

      if (response.ok) {
        const json = (await tryParseJson(response)) as T | null;
        return (json ?? ({} as T)) as T;
      }

      const shouldRetry = attempt < retryPolicy.attempts - 1 && retryPolicy.statuses.has(response.status);
      if (shouldRetry) {
        await sleep(retryPolicy.baseDelayMs * (attempt + 1));
        continue;
      }

      const json = (await tryParseJson(response)) as ApiErrorBody | null;
      throw new ApiError(response.status, json, `Request failed: ${response.status}`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (attempt < retryPolicy.attempts - 1) {
        await sleep(retryPolicy.baseDelayMs * (attempt + 1));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Request exhausted retry attempts");
}
