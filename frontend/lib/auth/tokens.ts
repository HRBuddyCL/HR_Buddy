export type TokenType = "employee" | "admin" | "messenger";

const TOKEN_KEYS: Record<TokenType, string> = {
  employee: "hrbuddy.employee.sessionToken",
  admin: "hrbuddy.admin.sessionToken",
  messenger: "hrbuddy.messenger.sessionToken",
};

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function getTokenStorageKey(type: TokenType) {
  return TOKEN_KEYS[type];
}

export function getAuthToken(type: TokenType): string | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEYS[type]);
}

export function setAuthToken(type: TokenType, token: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEYS[type], token);
}

export function clearAuthToken(type: TokenType) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEYS[type]);
}
