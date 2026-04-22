import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_REMEMBER_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_EXPIRES_AT_COOKIE,
} from "@/lib/auth/admin-session";

const RAW_UPSTREAM_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const UPSTREAM_BASE_URL = RAW_UPSTREAM_BASE_URL.replace(/\/$/, "");

type AdminLoginBackendResponse = {
  sessionToken?: string;
  expiresAt?: string;
  [key: string]: unknown;
};

type AdminLoginRequestBody = {
  username?: unknown;
  password?: unknown;
  rememberMe?: unknown;
};

function parseAdminLoginBody(body: unknown) {
  const normalized =
    body && typeof body === "object" ? (body as AdminLoginRequestBody) : {};

  return {
    username: normalized.username,
    password: normalized.password,
    rememberMe: normalized.rememberMe === true,
  };
}

export async function POST(request: NextRequest) {
  const body = parseAdminLoginBody((await request.json()) as unknown);
  const backendPayload = {
    username: body.username,
    password: body.password,
    rememberMe: body.rememberMe,
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${UPSTREAM_BASE_URL}/admin/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(backendPayload),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Upstream backend is temporarily unavailable",
        error: error instanceof Error ? error.message : "Unknown proxy error",
      },
      { status: 503 },
    );
  }

  const upstreamJson =
    ((await upstreamResponse
      .json()
      .catch(() => null)) as AdminLoginBackendResponse | null) ?? {};

  if (!upstreamResponse.ok) {
    return NextResponse.json(upstreamJson, { status: upstreamResponse.status });
  }

  const sessionToken =
    typeof upstreamJson.sessionToken === "string"
      ? upstreamJson.sessionToken
      : null;
  const expiresAt =
    typeof upstreamJson.expiresAt === "string" ? upstreamJson.expiresAt : null;

  if (!sessionToken || !expiresAt) {
    return NextResponse.json(
      {
        message: "Admin login response is missing session data",
      },
      { status: 502 },
    );
  }

  const strictExpiresAt = new Date(expiresAt);

  if (!Number.isFinite(strictExpiresAt.getTime())) {
    return NextResponse.json(
      {
        message: "Admin login response has invalid session expiry",
      },
      { status: 502 },
    );
  }

  const responsePayload = {
    ...upstreamJson,
    sessionToken: undefined,
    expiresAt,
  };

  const response = NextResponse.json(responsePayload, { status: 200 });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: strictExpiresAt,
  });

  if (body.rememberMe) {
    response.cookies.set({
      name: ADMIN_REMEMBER_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: strictExpiresAt,
    });
  } else {
    response.cookies.set({
      name: ADMIN_REMEMBER_SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  response.cookies.set({
    name: ADMIN_SESSION_EXPIRES_AT_COOKIE,
    value: expiresAt,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: strictExpiresAt,
  });

  return response;
}
