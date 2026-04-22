import { ApiError, apiFetch, type ApiErrorBody } from "@/lib/api/client";

export type AdminLoginPayload = {
  username: string;
  password: string;
  rememberMe?: boolean;
};

export type AdminLoginResponse = {
  expiresAt: string;
};

export type AdminSessionMe = {
  username: string;
  expiresAt: string;
};

async function parseJson(response: Response) {
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

export async function adminLogin(payload: AdminLoginPayload) {
  const response = await fetch("/api/auth/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await parseJson(response)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody,
      `Request failed: ${response.status}`,
    );
  }

  const body = (await parseJson(response)) as AdminLoginResponse | null;
  if (!body?.expiresAt) {
    throw new ApiError(
      502,
      null,
      "Admin login response is missing session expiry",
    );
  }

  return body;
}

export async function adminMe() {
  return apiFetch<AdminSessionMe>("/admin/auth/me", {
    method: "GET",
    tokenType: "admin",
    retry: {
      attempts: 3,
      baseDelayMs: 900,
    },
  });
}

export async function adminLogout() {
  const response = await fetch("/api/auth/admin/logout", {
    method: "POST",
    headers: {
      accept: "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await parseJson(response)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody,
      `Request failed: ${response.status}`,
    );
  }

  return (
    ((await parseJson(response)) as { ok: boolean } | null) ?? {
      ok: true,
    }
  );
}
