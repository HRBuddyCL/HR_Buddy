"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { ErrorToast } from "@/components/ui/error-toast";
import { adminLogout } from "@/lib/api/admin-auth";
import { sendOtp, verifyOtp } from "@/lib/api/auth-otp";
import {
  clearSessionExpiresAt,
  getSessionExpiresAt,
  setSessionExpiresAt,
} from "@/lib/auth/session-expiry";
import { hasActiveEmployeeSessionFromCookie } from "@/lib/auth/employee-session";
import {
  getEmployeeContact,
  setEmployeeContact,
} from "@/lib/auth/employee-contact";
import { clearAuthToken } from "@/lib/auth/tokens";
type Stage = "idle" | "code-sent";
type OtpToastTitle = "ส่ง OTP ไม่สำเร็จ" | "ยืนยัน OTP ไม่สำเร็จ";

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhoneDisplay(value: string) {
  const digits = extractPhoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isValidPhone(value: string) {
  return extractPhoneDigits(value).length === 10;
}

function normalizePositiveSeconds(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.ceil(value));
}

function deriveOtpTtlSeconds(expiresAtIso: string, fallbackSeconds: number) {
  const expiresAt = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt)) {
    return Math.max(0, fallbackSeconds);
  }

  const derived = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(0, derived);
}

function formatOtpTtlLabel(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return "ไม่กี่วินาที";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds} วินาที`;
  }

  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} นาที`;
}

function toThaiOtpErrorMessage(error: ApiError) {
  const code = error.body?.code;
  const retryAfterSeconds =
    typeof (error.body as { retryAfterSeconds?: unknown } | null)
      ?.retryAfterSeconds === "number"
      ? ((error.body as { retryAfterSeconds?: number }).retryAfterSeconds ?? 0)
      : 0;

  switch (code) {
    case "INVALID_OTP_CODE":
      return "รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง";
    case "OTP_EXPIRED":
      return "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่";
    case "OTP_ATTEMPTS_EXCEEDED":
      return "คุณกรอกรหัส OTP ผิดเกินจำนวนครั้งที่กำหนด กรุณาขอรหัสใหม่";
    case "OTP_TEMPORARILY_LOCKED": {
      const retryAfterSeconds =
        typeof (error.body as { retryAfterSeconds?: unknown } | null)
          ?.retryAfterSeconds === "number"
          ? ((error.body as { retryAfterSeconds?: number }).retryAfterSeconds ??
            0)
          : 0;

      return retryAfterSeconds > 0
        ? `คุณกรอกรหัส OTP ผิดครบ 5 ครั้ง ระบบล็อกชั่วคราว กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่`
        : "คุณกรอกรหัส OTP ผิดครบ 5 ครั้ง ระบบถูกล็อกชั่วคราว 5 นาที";
    }
    case "OTP_ALREADY_USED":
      return "รหัส OTP นี้ถูกใช้งานแล้ว กรุณาขอรหัสใหม่";
    case "OTP_SESSION_NOT_FOUND":
      return "ไม่พบรายการ OTP กรุณาขอรหัสใหม่อีกครั้ง";
    case "OTP_COOLDOWN_ACTIVE": {
      return retryAfterSeconds > 0
        ? `กรุณารอ ${retryAfterSeconds} วินาที แล้วลองส่ง OTP อีกครั้ง`
        : "เพิ่งมีการส่ง OTP ไปแล้ว กรุณารอสักครู่ก่อนลองใหม่";
    }
    case "RATE_LIMIT_EXCEEDED":
      return retryAfterSeconds > 0
        ? `ขอ OTP ถี่เกินไป กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่`
        : "ขอ OTP ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "OTP_RATE_LIMITED":
      return "ขอ OTP บ่อยเกินไป กรุณาลองใหม่ภายหลัง";
    default:
      break;
  }

  const normalized = error.message.toLowerCase();

  if (normalized.includes("invalid otp")) {
    return "รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง";
  }

  if (normalized.includes("expired")) {
    return "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่";
  }

  if (error.status === 429) {
    return retryAfterSeconds > 0
      ? `คำขอถูกจำกัดความถี่ กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่`
      : "คำขอถูกจำกัดความถี่ กรุณารอสักครู่แล้วลองใหม่";
  }

  return "ไม่สามารถดำเนินการ OTP ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
}

export default function Page() {
  return (
    <Suspense fallback={<OtpPageLoading />}>
      <OtpPageContent />
    </Suspense>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ stage }: { stage: Stage }) {
  const steps = [
    { id: 1, label: "กรอกข้อมูล" },
    { id: 2, label: "รับรหัส OTP" },
    { id: 3, label: "ยืนยันตัวตน" },
  ];

  const currentStep = stage === "idle" ? 1 : 2;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} className="flex items-center">
              {/* Circle */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                  flex h-10 w-10 items-center justify-center rounded-full
                  text-sm font-bold transition-all duration-300
                  ${
                    isCompleted
                      ? "bg-[#0e2d4c] text-white shadow-lg shadow-[#0e2d4c]/25"
                      : isActive
                        ? "bg-[#b62026] text-white shadow-lg shadow-[#b62026]/30 ring-4 ring-[#b62026]/15"
                        : "border-2 border-slate-300 bg-slate-50 text-slate-400"
                  }
                `}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-wide transition-colors ${
                    isActive
                      ? "text-[#b62026]"
                      : isCompleted
                        ? "text-[#0e2d4c]"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                  mx-2 mb-6 h-[2px] w-16 rounded-full transition-all duration-500
                  ${isCompleted ? "bg-[#0e2d4c]" : "bg-slate-300"}
                `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
function OtpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") || "/my-requests";
  const nextPath = nextRaw.startsWith("/") ? nextRaw : "/my-requests";

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [submittingSend, setSubmittingSend] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<OtpToastTitle>(
    "ยืนยัน OTP ไม่สำเร็จ",
  );
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [otpTtlSeconds, setOtpTtlSeconds] = useState(300);
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  const showSendOtpError = (message: string) => {
    setErrorTitle("ส่ง OTP ไม่สำเร็จ");
    setErrorMessage(message);
  };

  const showVerifyOtpError = (message: string) => {
    setErrorTitle("ยืนยัน OTP ไม่สำเร็จ");
    setErrorMessage(message);
  };

  useEffect(() => {
    const saved = getEmployeeContact();
    if (saved) {
      setPhone(formatPhoneDisplay(saved.phone || ""));
      setEmail(saved.email || "");
    }
  }, []);

  useEffect(() => {
    const expiresAtIso = getSessionExpiresAt("employee");

    if (hasActiveEmployeeSessionFromCookie() && expiresAtIso) {
      const expiresAt = new Date(expiresAtIso).getTime();
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        router.replace(nextPath);
        return;
      }
    }

    setIsSessionChecked(true);
  }, [nextPath, router]);

  // Countdown timer สำหรับปุ่มส่ง OTP อีกครั้ง
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const phoneDigits = useMemo(() => extractPhoneDigits(phone), [phone]);

  const canSend = useMemo(() => {
    return (
      isValidPhone(phone) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
  }, [phone, email]);

  const canVerify = useMemo(() => {
    return /^\d{6}$/.test(otpCode.trim()) && canSend;
  }, [otpCode, canSend]);

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setOtpHint(null);

    if (!canSend) {
      showSendOtpError("กรุณากรอกเบอร์โทรศัพท์และอีเมลให้ถูกต้องก่อนขอ OTP");
      return;
    }

    setSubmittingSend(true);

    try {
      const result = await sendOtp({
        phone: phoneDigits,
        email: email.trim(),
      });

      const resendAfterSeconds =
        normalizePositiveSeconds(result.resendAfterSeconds) ?? 60;
      const ttlFromResponse = normalizePositiveSeconds(result.otpTtlSeconds);
      const effectiveOtpTtlSeconds =
        ttlFromResponse ?? deriveOtpTtlSeconds(result.expiresAt, 300);

      setStage("code-sent");
      setCountdown(resendAfterSeconds);
      setOtpTtlSeconds(effectiveOtpTtlSeconds);

      if (result.devOtp) {
        setOtpHint(`OTP สำหรับทดสอบ: ${result.devOtp}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        showSendOtpError(toThaiOtpErrorMessage(error));
      } else {
        showSendOtpError("ส่ง OTP ไม่สำเร็จ");
      }
    } finally {
      setSubmittingSend(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!canVerify) {
      showVerifyOtpError("รหัส OTP ต้องมี 6 หลัก");
      return;
    }

    setSubmittingVerify(true);

    try {
      const result = await verifyOtp({
        phone: phoneDigits,
        email: email.trim(),
        otpCode: otpCode.trim(),
      });

      try {
        await adminLogout();
      } catch {
        // Best-effort admin logout when switching to employee role.
      } finally {
        clearAuthToken("admin");
        clearSessionExpiresAt("admin");
      }

      setSessionExpiresAt("employee", result.expiresAt);
      setEmployeeContact({ phone: phoneDigits, email: email.trim() });

      // Force a full navigation so HttpOnly session cookie is guaranteed for the next protected route.
      window.location.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        showVerifyOtpError(toThaiOtpErrorMessage(error));
      } else {
        showVerifyOtpError("ยืนยัน OTP ไม่สำเร็จ");
      }
    } finally {
      setSubmittingVerify(false);
    }
  };

  if (!isSessionChecked) {
    return <OtpPageLoading />;
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-16 pt-12 sm:px-6 sm:pt-14">
        <ErrorToast
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
          title={errorTitle}
          durationMs={10000}
          variant="large"
        />

        {/* ── Hero Header ─────────────────────────────────────────────── */}
        <section className="relative mb-7 overflow-hidden rounded-3xl bg-[#0e2d4c] px-5 py-7 text-center shadow-xl shadow-[#0e2d4c]/20 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#b62026]/18 blur-3xl" />
            <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-[#fed54f]/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              ยืนยันตัวตนด้วย <span className="text-[#fed54f]">OTP</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              ระบุเบอร์โทรศัพท์และอีเมล เพื่อรับรหัส OTP
            </p>
          </div>
        </section>

        {/* ── Step Indicator ─────────────────────────────────────────── */}
        <div className="mb-8">
          <StepIndicator stage={stage} />
        </div>

        {/* ── Card: ข้อมูลติดต่อ ──────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/70 ring-1 ring-white/80">
          {/* Card Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#0e2d4c] to-[#1a4a7a] px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                กรอกข้อมูลเพื่อรับรหัส OTP
              </h2>
            </div>
          </div>

          {/* Card Body */}
          <form className="p-6" onSubmit={handleSendOtp}>
            <div className="space-y-5">
              {/* Phone Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="phone"
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#0e2d4c]"
                >
                  <svg
                    className="h-3.5 w-3.5 text-[#b62026]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  เบอร์โทรศัพท์
                  <span className="text-[#b62026]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) =>
                      setPhone(formatPhoneDisplay(e.target.value))
                    }
                    placeholder="081-234-5678"
                    maxLength={12}
                    inputMode="numeric"
                    autoComplete="tel"
                    className="
                    w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3
                    text-[#0e2d4c] placeholder-slate-400
                    transition-all duration-200
                    focus:border-[#0e2d4c] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0e2d4c]/10
                    hover:border-slate-300
                  "
                  />
                  {/* Validation indicator */}
                  {phone.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidPhone(phone) ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                          <svg
                            className="h-3 w-3 text-emerald-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
                          <svg
                            className="h-3 w-3 text-amber-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M12 9v4m0 4h.01"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  กรอกให้ตรงกับข้อมูลคำขอที่เคยบันทึกไว้
                </p>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#0e2d4c]"
                >
                  <svg
                    className="h-3.5 w-3.5 text-[#b62026]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  อีเมล
                  <span className="text-[#b62026]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="somchai@gmail.com"
                    maxLength={120}
                    className="
                    w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3
                    text-[#0e2d4c] placeholder-slate-400
                    transition-all duration-200
                    focus:border-[#0e2d4c] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0e2d4c]/10
                    hover:border-slate-300
                  "
                  />
                  {/* Validation indicator */}
                  {email.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                          <svg
                            className="h-3 w-3 text-emerald-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
                          <svg
                            className="h-3 w-3 text-amber-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M12 9v4m0 4h.01"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingSend || !canSend || countdown > 0}
                className="
                group relative w-full overflow-hidden rounded-xl
                bg-gradient-to-r from-[#0e2d4c] to-[#1a4a7a]
                px-6 py-3.5 text-sm font-bold text-white
                shadow-md shadow-[#0e2d4c]/20
                transition-all duration-300
                hover:-translate-y-px hover:shadow-lg hover:shadow-[#0e2d4c]/30
                disabled:cursor-not-allowed disabled:opacity-50
                disabled:hover:translate-y-0 disabled:hover:shadow-md
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
              "
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <span className="relative flex items-center justify-center gap-2">
                  {submittingSend ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      กำลังส่ง OTP...
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      ส่ง OTP อีกครั้งใน {countdown} วินาที
                    </>
                  ) : stage === "code-sent" ? (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      ส่ง OTP อีกครั้ง
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      ส่ง OTP
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* ── Card: กรอกรหัส OTP ──────────────────────────────────────── */}
        {stage === "code-sent" && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/80 ring-1 ring-white/80">
            {/* Card Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#b62026] to-[#d73037] px-5 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white">
                  กรอกรหัส OTP
                </h2>
                <p className="text-[12px] text-white/80">
                  ส่งไปยังอีเมล {email.trim()}
                </p>
              </div>

              {/* Success badge */}
              <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fed54f] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#fed54f]" />
                </span>
                <span className="text-[11px] font-semibold text-white">
                  ส่งแล้ว
                </span>
              </div>
            </div>

            {/* Info Banner */}
            <div className="mx-6 mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[12px] leading-relaxed text-amber-900/90">
                รหัส OTP ถูกส่งไปยังอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย
                (หรือโฟลเดอร์ Spam) และกรอกรหัส <strong>6 หลัก</strong> ด้านล่าง
                รหัสมีอายุ <strong>{formatOtpTtlLabel(otpTtlSeconds)}</strong>
              </p>
            </div>

            {/* OTP Form */}
            <form className="p-6 pt-4" onSubmit={handleVerifyOtp}>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="otpCode"
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#0e2d4c]"
                  >
                    <svg
                      className="h-3.5 w-3.5 text-[#b62026]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                    รหัส OTP
                    <span className="text-[#b62026]">*</span>
                  </label>
                  <input
                    id="otpCode"
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="• • • • • •"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="
                    w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-4
                    text-center font-mono text-3xl font-bold tracking-[0.55em] text-[#0e2d4c]
                    placeholder-slate-300/90
                    transition-all duration-200
                    focus:border-[#b62026] focus:outline-none focus:ring-4 focus:ring-[#b62026]/10
                    hover:border-slate-300
                  "
                  />
                  <div className="flex justify-center gap-2 pt-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                          i < otpCode.length
                            ? "scale-125 bg-[#b62026]"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={submittingVerify || !canVerify}
                  className="
                  group relative w-full overflow-hidden rounded-xl
                  bg-gradient-to-r from-[#b62026] to-[#d42d34]
                  px-6 py-3.5 text-sm font-bold text-white
                  shadow-md shadow-[#b62026]/25
                  transition-all duration-300
                  hover:-translate-y-px hover:shadow-lg hover:shadow-[#b62026]/35
                  disabled:cursor-not-allowed disabled:from-slate-500 disabled:to-slate-600 disabled:opacity-75
                  disabled:hover:translate-y-0 disabled:hover:shadow-md
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                "
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                  <span className="relative flex items-center justify-center gap-2">
                    {submittingVerify ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        กำลังยืนยัน...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        ยืนยันและดำเนินการต่อ
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Dev OTP Hint ─────────────────────────────────────────────── */}
        {otpHint && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#fed54f]/60 bg-[#fed54f]/15 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fed54f]/40">
              <svg
                className="h-4 w-4 text-[#0e2d4c]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0e2d4c]/60">
                ?????????
              </p>
              <p className="text-sm font-bold text-[#0e2d4c]">{otpHint}</p>
            </div>
          </div>
        )}

        {/* ── Back Link ─────────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/"
            className="
            group inline-flex items-center gap-3 rounded-2xl border border-slate-200/90
            bg-white px-7 py-3 text-sm font-semibold text-[#0e2d4c]
            shadow-sm shadow-slate-200/70 ring-1 ring-white/80
            transition-all duration-300
            hover:-translate-y-0.5 hover:border-[#0e2d4c]/35 hover:bg-[#0e2d4c]/[0.03]
            hover:shadow-md hover:shadow-slate-300/80
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2d4c]/25
          "
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0e2d4c]/10 to-[#b62026]/10 text-[#0e2d4c] transition-all duration-300 group-hover:from-[#0e2d4c]/15 group-hover:to-[#b62026]/15">
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:scale-105"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 11.5L12 4l9 7.5M5 10.5V20h14v-9.5M9.5 20v-5.5h5V20"
                />
              </svg>
            </span>
            <span className="tracking-wide">กลับหน้าหลัก</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

// ── Loading State ─────────────────────────────────────────────────────────────
function OtpPageLoading() {
  return (
    <div className="min-h-screen w-full bg-[#f8fafc]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e2d4c] to-[#1a4a7a]">
              <svg
                className="h-7 w-7 animate-pulse text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              กำลังโหลดหน้ายืนยันตัวตน...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
