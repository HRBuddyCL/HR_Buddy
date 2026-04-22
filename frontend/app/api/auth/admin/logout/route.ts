import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_REMEMBER_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_EXPIRES_AT_COOKIE,
  getAdminSessionFromRequest,
} from "@/lib/auth/admin-session";

const RAW_UPSTREAM_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const UPSTREAM_BASE_URL = RAW_UPSTREAM_BASE_URL.replace(/\/$/, "");

export async function POST(request: NextRequest) {
  const token = getAdminSessionFromRequest(request).token;

  if (token) {
    try {
      await fetch(`${UPSTREAM_BASE_URL}/admin/auth/logout`, {
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

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: ADMIN_SESSION_EXPIRES_AT_COOKIE,
    value: "",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: ADMIN_REMEMBER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
