import { getAuthToken, type TokenType } from "@/lib/auth/tokens";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

type PrimitiveQueryValue = string | number | boolean;

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  tokenType?: TokenType;
  query?: Record<string, PrimitiveQueryValue | undefined | null>;
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
  const url = new URL(`${API_BASE_URL}${path}`);

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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { tokenType, query, headers, body, ...rest } = options;

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

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: requestHeaders,
    body: finalBody,
  });

  const json = (await tryParseJson(response)) as T | ApiErrorBody | null;

  if (!response.ok) {
    throw new ApiError(response.status, (json as ApiErrorBody | null) ?? null, `Request failed: ${response.status}`);
  }

  return (json ?? ({} as T)) as T;
}
