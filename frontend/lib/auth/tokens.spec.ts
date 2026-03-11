import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth token storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE;
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("stores tokens in session mode", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "session";
    const { setAuthToken, getAuthToken, getTokenStorageKey } = await import("@/lib/auth/tokens");

    setAuthToken("admin", "token-123");

    const key = getTokenStorageKey("admin");
    expect(getAuthToken("admin")).toBe("token-123");
    expect(window.sessionStorage.getItem(key)).toBe("token-123");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("supports optional memory mode", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "memory";
    const { setAuthToken, getAuthToken, getTokenStorageKey } = await import("@/lib/auth/tokens");

    setAuthToken("employee", "memory-token");

    const key = getTokenStorageKey("employee");
    expect(getAuthToken("employee")).toBe("memory-token");
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("supports optional session persistence mode", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "session";
    const { setAuthToken, getAuthToken, clearAuthToken, getTokenStorageKey } = await import("@/lib/auth/tokens");

    setAuthToken("employee", "persisted-token");
    expect(window.sessionStorage.getItem(getTokenStorageKey("employee"))).toBe("persisted-token");
    expect(getAuthToken("employee")).toBe("persisted-token");

    clearAuthToken("employee");
    expect(window.sessionStorage.getItem(getTokenStorageKey("employee"))).toBeNull();
  });

  it("migrates legacy localStorage token to sessionStorage", async () => {
    const { getAuthToken, getTokenStorageKey } = await import("@/lib/auth/tokens");
    const key = getTokenStorageKey("admin");

    window.localStorage.setItem(key, "legacy-admin-token");

    expect(getAuthToken("admin")).toBe("legacy-admin-token");
    expect(window.sessionStorage.getItem(key)).toBe("legacy-admin-token");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("emits token changed event on set and clear", async () => {
    const { setAuthToken, clearAuthToken, getTokenChangedEventName } = await import("@/lib/auth/tokens");

    const listener = vi.fn();
    window.addEventListener(getTokenChangedEventName(), listener);

    setAuthToken("employee", "abc");
    clearAuthToken("employee");

    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(getTokenChangedEventName(), listener);
  });

  it("returns null when token does not exist", async () => {
    const { getAuthToken } = await import("@/lib/auth/tokens");
    expect(getAuthToken("messenger")).toBeNull();
  });
});
