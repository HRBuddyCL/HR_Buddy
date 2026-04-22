import { useSyncExternalStore } from "react";
import type { TokenType } from "@/lib/auth/tokens";
import {
  ADMIN_SESSION_EXPIRES_AT_COOKIE,
  getAdminSessionExpiresAtFromCookie,
} from "@/lib/auth/admin-session";
import {
  EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
  getEmployeeSessionExpiresAtFromCookie,
} from "@/lib/auth/employee-session";

const SESSION_EXPIRY_KEYS: Record<TokenType, string> = {
  employee: "hrbuddy.employee.sessionExpiresAt",
  admin: "hrbuddy.admin.sessionExpiresAt",
  messenger: "hrbuddy.messenger.sessionExpiresAt",
};

const SESSION_EXPIRY_CHANGED_EVENT = "hrbuddy:auth-session-expiry-changed";

const noop = () => {};

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getStorage() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.sessionStorage;
}

function setCookieValue(name: string, value: string, expiresAtIso: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const expiresAt = new Date(expiresAtIso);
  if (!Number.isFinite(expiresAt.getTime())) {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expiresAt.toUTCString()}; SameSite=Lax`;
}

function clearCookieValue(name: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function emitSessionExpiryChanged(type: TokenType) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRY_CHANGED_EVENT, {
      detail: { type },
    }),
  );
}

export function getSessionExpiresAt(type: TokenType): string | null {
  if (type === "employee") {
    return getEmployeeSessionExpiresAtFromCookie();
  }

  if (type === "admin") {
    return getAdminSessionExpiresAtFromCookie();
  }

  const storage = getStorage();
  if (!storage) {
    return null;
  }

  return storage.getItem(SESSION_EXPIRY_KEYS[type]);
}

export function setSessionExpiresAt(type: TokenType, expiresAtIso: string) {
  if (type === "employee") {
    setCookieValue(
      EMPLOYEE_SESSION_EXPIRES_AT_COOKIE,
      expiresAtIso,
      expiresAtIso,
    );
    emitSessionExpiryChanged(type);
    return;
  }

  if (type === "admin") {
    setCookieValue(ADMIN_SESSION_EXPIRES_AT_COOKIE, expiresAtIso, expiresAtIso);
    emitSessionExpiryChanged(type);
    return;
  }

  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SESSION_EXPIRY_KEYS[type], expiresAtIso);
  emitSessionExpiryChanged(type);
}

export function clearSessionExpiresAt(type: TokenType) {
  if (type === "employee") {
    clearCookieValue(EMPLOYEE_SESSION_EXPIRES_AT_COOKIE);
    emitSessionExpiryChanged(type);
    return;
  }

  if (type === "admin") {
    clearCookieValue(ADMIN_SESSION_EXPIRES_AT_COOKIE);
    emitSessionExpiryChanged(type);
    return;
  }

  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(SESSION_EXPIRY_KEYS[type]);
  emitSessionExpiryChanged(type);
}

function subscribe(listener: () => void) {
  if (!canUseBrowserStorage()) {
    return noop;
  }

  const onStorage = () => listener();
  const onSessionExpiryChanged = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_EXPIRY_CHANGED_EVENT, onSessionExpiryChanged);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      SESSION_EXPIRY_CHANGED_EVENT,
      onSessionExpiryChanged,
    );
  };
}

export function useSessionExpiresAt(type: TokenType) {
  return useSyncExternalStore(
    subscribe,
    () => getSessionExpiresAt(type),
    () => null,
  );
}
