import { ApiError, type ApiErrorBody, apiFetch } from "@/lib/api/client";

export type SendOtpPayload = {
  phone: string;
  email: string;
};

export type SendOtpResponse = {
  expiresAt: string;
  devOtp?: string;
};

export type VerifyOtpPayload = {
  phone: string;
  email: string;
  otpCode: string;
};

export type VerifyOtpResponse = {
  expiresAt: string;
};

export async function sendOtp(payload: SendOtpPayload) {
  return apiFetch<SendOtpResponse>("/auth-otp/send", {
    method: "POST",
    body: payload,
  });
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const response = await fetch("/api/auth/employee/verify-otp", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
  });

  const json = (await response.json().catch(() => null)) as
    | ApiErrorBody
    | VerifyOtpResponse
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      json as ApiErrorBody | null,
      `Request failed: ${response.status}`,
    );
  }

  return (json ?? ({} as VerifyOtpResponse)) as VerifyOtpResponse;
}
