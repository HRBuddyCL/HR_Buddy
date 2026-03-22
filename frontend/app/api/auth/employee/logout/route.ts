import { NextRequest, NextResponse } from "next/server";
import {
  EMPLOYEE_SESSION_COOKIE,
  EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
} from "@/lib/auth/employee-session";

const RAW_UPSTREAM_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const UPSTREAM_BASE_URL = RAW_UPSTREAM_BASE_URL.replace(/\/$/, "");

export async function POST(request: NextRequest) {
  const token = request.cookies.get(EMPLOYEE_SESSION_COOKIE)?.value ?? null;

  if (token) {
    try {
      await fetch(`${UPSTREAM_BASE_URL}/auth-otp/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
        cache: "no-store",
      });
    } catch {
      // Best-effort upstream logout; local cookie cleanup below is authoritative.
    }
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set({
    name: EMPLOYEE_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
    value: "",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
