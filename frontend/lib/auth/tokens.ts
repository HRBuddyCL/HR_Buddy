export type TokenType = "employee" | "admin" | "messenger";

const TOKEN_KEYS: Record<TokenType, string> = {
  employee: "hrbuddy.employee.sessionToken",
  admin: "hrbuddy.admin.sessionToken",
  messenger: "hrbuddy.messenger.sessionToken",
};

const TOKEN_CHANGED_EVENT = "hrbuddy:auth-token-changed";

type TokenStorageMode = "memory" | "session";

const configuredStorageMode =
  (process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE?.toLowerCase() as TokenStorageMode | undefined) ?? "session";

const tokenCache: Partial<Record<TokenType, string>> = {};

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getStorageMode(): TokenStorageMode {
  return configuredStorageMode === "memory" ? "memory" : "session";
}

function resolveTokenStorage() {
  if (!canUseBrowserStorage() || getStorageMode() !== "session") {
    return null;
  }

  return window.sessionStorage;
}

function readPersistedToken(type: TokenType): string | null {
  const storage = resolveTokenStorage();
  if (!storage) {
    return null;
  }

  const key = TOKEN_KEYS[type];
  const persisted = storage.getItem(key);
  if (persisted) {
    return persisted;
  }

  // Backward compatibility: migrate old localStorage token to sessionStorage once.
  const legacy = window.localStorage.getItem(key);
  if (legacy) {
    storage.setItem(key, legacy);
    window.localStorage.removeItem(key);
  }

  return legacy;
}

function emitTokenChanged(type: TokenType) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TOKEN_CHANGED_EVENT, {
      detail: { type },
    }),
  );
}

export function getTokenChangedEventName() {
  return TOKEN_CHANGED_EVENT;
}

export function getTokenStorageKey(type: TokenType) {
  return TOKEN_KEYS[type];
}

export function getAuthToken(type: TokenType): string | null {
  const fromCache = tokenCache[type];
  if (fromCache) {
    return fromCache;
  }

  const persisted = readPersistedToken(type);
  if (persisted) {
    tokenCache[type] = persisted;
  }

  return persisted;
}

export function setAuthToken(type: TokenType, token: string) {
  tokenCache[type] = token;

  const storage = resolveTokenStorage();
  if (storage) {
    storage.setItem(TOKEN_KEYS[type], token);
  }

  emitTokenChanged(type);
}

export function clearAuthToken(type: TokenType) {
  delete tokenCache[type];

  const key = TOKEN_KEYS[type];

  const storage = resolveTokenStorage();
  if (storage) {
    storage.removeItem(key);
  }

  // Cleanup old storage format if present.
  if (canUseBrowserStorage()) {
    window.localStorage.removeItem(key);
  }

  emitTokenChanged(type);
}
