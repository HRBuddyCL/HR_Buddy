import { apiFetch } from "@/lib/api/client";

export type AdminLoginPayload = {
  username: string;
  password: string;
};

export type AdminLoginResponse = {
  sessionToken: string;
  expiresAt: string;
};

export type AdminSessionMe = {
  username: string;
  expiresAt: string;
};

export async function adminLogin(payload: AdminLoginPayload) {
  return apiFetch<AdminLoginResponse>("/admin/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function adminMe() {
  return apiFetch<AdminSessionMe>("/admin/auth/me", {
    method: "GET",
    tokenType: "admin",
  });
}

export async function adminLogout() {
  return apiFetch<{ ok: boolean }>("/admin/auth/logout", {
    method: "POST",
    tokenType: "admin",
  });
}
