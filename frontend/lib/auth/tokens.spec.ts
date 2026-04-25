import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth token storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE;
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("stores admin token in memory even when session mode is configured", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "session";
    const { setAuthToken, getAuthToken, getTokenStorageKey } =
      await import("@/lib/auth/tokens");

    setAuthToken("admin", "token-123");

    const key = getTokenStorageKey("admin");
    expect(getAuthToken("admin")).toBe("token-123");
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("supports optional memory mode", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "memory";
    const { setAuthToken, getAuthToken, getTokenStorageKey } =
      await import("@/lib/auth/tokens");

    setAuthToken("employee", "memory-token");

    const key = getTokenStorageKey("employee");
    expect(getAuthToken("employee")).toBe("memory-token");
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("supports optional session persistence mode for messenger token", async () => {
    process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE = "session";
    const { setAuthToken, getAuthToken, clearAuthToken, getTokenStorageKey } =
      await import("@/lib/auth/tokens");

    setAuthToken("messenger", "persisted-token");
    expect(window.sessionStorage.getItem(getTokenStorageKey("messenger"))).toBe(
      "persisted-token",
    );
    expect(getAuthToken("messenger")).toBe("persisted-token");

    clearAuthToken("messenger");
    expect(
      window.sessionStorage.getItem(getTokenStorageKey("messenger")),
    ).toBeNull();
  });

  it("migrates legacy localStorage token to sessionStorage for messenger", async () => {
    const { getAuthToken, getTokenStorageKey } =
      await import("@/lib/auth/tokens");
    const key = getTokenStorageKey("messenger");

    window.localStorage.setItem(key, "legacy-messenger-token");

    expect(getAuthToken("messenger")).toBe("legacy-messenger-token");
    expect(window.sessionStorage.getItem(key)).toBe("legacy-messenger-token");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("emits token changed event on set and clear", async () => {
    const { setAuthToken, clearAuthToken, getTokenChangedEventName } =
      await import("@/lib/auth/tokens");

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
