const DIRECT_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

export const BROWSER_API_BASE_PATH = "/api/backend";

export function resolveApiBaseUrl() {
  if (typeof window === "undefined") {
    return DIRECT_API_BASE_URL;
  }

  return BROWSER_API_BASE_PATH;
}
