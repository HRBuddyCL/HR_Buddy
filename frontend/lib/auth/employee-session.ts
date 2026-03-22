import type { NextRequest } from "next/server";

export const EMPLOYEE_SESSION_COOKIE = "hrbuddy_employee_session";
export const EMPLOYEE_SESSION_EXPIRES_AT_COOKIE =
  "hrbuddy_employee_session_expires_at";

export function isIsoDateInFuture(iso: string | null | undefined) {
  if (!iso) {
    return false;
  }

  const expiresAt = new Date(iso).getTime();
  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt > Date.now();
}

export function computeSessionMaxAgeSeconds(expiresAtIso: string) {
  const expiresAt = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export function getEmployeeSessionFromRequest(request: NextRequest) {
  return {
    token: request.cookies.get(EMPLOYEE_SESSION_COOKIE)?.value ?? null,
    expiresAt:
      request.cookies.get(EMPLOYEE_SESSION_EXPIRES_AT_COOKIE)?.value ?? null,
  };
}

export function hasActiveEmployeeSessionFromRequest(request: NextRequest) {
  const { token, expiresAt } = getEmployeeSessionFromRequest(request);
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

export function getEmployeeSessionExpiresAtFromCookie() {
  return readCookieValue(EMPLOYEE_SESSION_EXPIRES_AT_COOKIE);
}

export function hasActiveEmployeeSessionFromCookie() {
  return isIsoDateInFuture(getEmployeeSessionExpiresAtFromCookie());
}
