import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "hrbuddy_admin_session";
export const ADMIN_REMEMBER_SESSION_COOKIE = "hrbuddy_admin_remember_session";
export const ADMIN_SESSION_EXPIRES_AT_COOKIE =
  "hrbuddy_admin_session_expires_at";

function isIsoDateInFuture(iso: string | null | undefined) {
  if (!iso) {
    return false;
  }

  const expiresAt = new Date(iso).getTime();
  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt > Date.now();
}

export function getAdminSessionFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const rememberedSessionToken =
    request.cookies.get(ADMIN_REMEMBER_SESSION_COOKIE)?.value ?? null;

  return {
    token: sessionToken ?? rememberedSessionToken,
    expiresAt:
      request.cookies.get(ADMIN_SESSION_EXPIRES_AT_COOKIE)?.value ?? null,
  };
}

export function hasActiveAdminSessionFromRequest(request: NextRequest) {
  const { token, expiresAt } = getAdminSessionFromRequest(request);
  return Boolean(token) && isIsoDateInFuture(expiresAt);
}

function readCookieValue(cookieName: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${cookieName}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

export function getAdminSessionExpiresAtFromCookie() {
  return readCookieValue(ADMIN_SESSION_EXPIRES_AT_COOKIE);
}

export function hasActiveAdminSessionFromCookie() {
  return isIsoDateInFuture(getAdminSessionExpiresAtFromCookie());
}
