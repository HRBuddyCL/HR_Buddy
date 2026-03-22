import { NextRequest, NextResponse } from "next/server";
import {
  computeSessionMaxAgeSeconds,
  EMPLOYEE_SESSION_COOKIE,
  EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
} from "@/lib/auth/employee-session";

const RAW_UPSTREAM_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const UPSTREAM_BASE_URL = RAW_UPSTREAM_BASE_URL.replace(/\/$/, "");

type VerifyOtpBackendResponse = {
  sessionToken?: string;
  expiresAt?: string;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as unknown;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${UPSTREAM_BASE_URL}/auth-otp/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
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
      .catch(() => null)) as VerifyOtpBackendResponse | null) ?? {};

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
        message: "OTP verification response is missing session data",
      },
      { status: 502 },
    );
  }

  const maxAge = computeSessionMaxAgeSeconds(expiresAt);
  const responsePayload = {
    ...upstreamJson,
    sessionToken: undefined,
    expiresAt,
  };

  const response = NextResponse.json(responsePayload, { status: 200 });
  response.cookies.set({
    name: EMPLOYEE_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  response.cookies.set({
    name: EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
    value: expiresAt,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return response;
}
