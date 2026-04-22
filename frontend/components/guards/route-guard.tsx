"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api/client";
import { clearAuthToken, type TokenType } from "@/lib/auth/tokens";
import { hasActiveAdminSessionFromCookie } from "@/lib/auth/admin-session";
import {
  clearSessionExpiresAt,
  useSessionExpiresAt,
} from "@/lib/auth/session-expiry";
import { hasActiveEmployeeSessionFromCookie } from "@/lib/auth/employee-session";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type RouteGuardProps = {
  tokenType: TokenType;
  redirectTo: string;
  nextPathOverride?: string;
  children: ReactNode;
};

type SessionValidationConfig = {
  path: string;
  query?: Record<string, string | number | boolean>;
};

const SESSION_VALIDATION_BY_TOKEN: Partial<
  Record<TokenType, SessionValidationConfig>
> = {
  admin: {
    path: "/admin/auth/me",
  },
  employee: {
    path: "/requests/my",
    query: {
      page: 1,
      limit: 1,
    },
  },
};

const SESSION_VALIDATION_ERROR =
  "ไม่สามารถตรวจสอบเซสชันกับระบบได้ กรุณาตรวจสอบการเชื่อมต่อ API แล้วลองใหม่อีกครั้ง";

export function RouteGuard({
  tokenType,
  redirectTo,
  nextPathOverride,
  children,
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthToken(tokenType);
  const sessionExpiresAt = useSessionExpiresAt(tokenType);
  const hasEmployeeSessionCookie = hasActiveEmployeeSessionFromCookie();
  const hasAdminSessionCookie = hasActiveAdminSessionFromCookie();
  const hasSessionCredential =
    tokenType === "employee"
      ? hasEmployeeSessionCookie
      : tokenType === "admin"
        ? hasAdminSessionCookie
        : Boolean(token);
  const validationConfig = useMemo(
    () => SESSION_VALIDATION_BY_TOKEN[tokenType],
    [tokenType],
  );

  const [hasMounted, setHasMounted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [warningDismissedFor, setWarningDismissedFor] = useState<string | null>(
    null,
  );
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  const resolvedNextPath = useMemo(() => {
    if (nextPathOverride && nextPathOverride.startsWith("/")) {
      return nextPathOverride;
    }

    return pathname || "/";
  }, [nextPathOverride, pathname]);

  const buildAuthRedirectUrl = useCallback(() => {
    const separator = redirectTo.includes("?") ? "&" : "?";
    return `${redirectTo}${separator}next=${encodeURIComponent(resolvedNextPath)}`;
  }, [redirectTo, resolvedNextPath]);

  const clearEmployeeSessionCookie = useCallback(async () => {
    try {
      await fetch("/api/auth/employee/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      });
    } catch {
      // Best-effort cookie cleanup.
    }
  }, []);

  const clearAdminSessionCookie = useCallback(async () => {
    try {
      await fetch("/api/auth/admin/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      });
    } catch {
      // Best-effort cookie cleanup.
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (!hasSessionCredential) {
      if (tokenType === "employee") {
        void clearEmployeeSessionCookie();
      }

      if (tokenType === "admin") {
        void clearAdminSessionCookie();
      }

      setIsValidating(false);
      setIsValidated(false);
      setValidationError(null);
      router.replace(buildAuthRedirectUrl());
    }
  }, [
    hasMounted,
    hasSessionCredential,
    router,
    clearEmployeeSessionCookie,
    clearAdminSessionCookie,
    tokenType,
    buildAuthRedirectUrl,
  ]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    let active = true;

    async function enforceSingleRole() {
      if (tokenType === "admin" && hasEmployeeSessionCookie) {
        await clearEmployeeSessionCookie();
        if (!active) {
          return;
        }

        clearAuthToken("employee");
        clearSessionExpiresAt("employee");
        return;
      }

      if (tokenType === "employee" && hasAdminSessionCookie) {
        await clearAdminSessionCookie();

        if (!active) {
          return;
        }

        clearAuthToken("admin");
        clearSessionExpiresAt("admin");
      }
    }

    void enforceSingleRole();

    return () => {
      active = false;
    };
  }, [
    hasMounted,
    tokenType,
    hasEmployeeSessionCookie,
    hasAdminSessionCookie,
    clearEmployeeSessionCookie,
    clearAdminSessionCookie,
  ]);

  useEffect(() => {
    if (!hasSessionCredential || !sessionExpiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const expiresAt = new Date(sessionExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      const msLeft = expiresAt - Date.now();
      setRemainingSeconds(Math.max(0, Math.floor(msLeft / 1000)));
    };

    updateRemaining();

    const ticker = window.setInterval(updateRemaining, 1000);
    const logoutDelay = Math.max(0, expiresAt - Date.now());
    const logoutTimer = window.setTimeout(() => {
      if (tokenType === "employee") {
        void clearEmployeeSessionCookie();
      }

      if (tokenType === "admin") {
        void clearAdminSessionCookie();
      }

      clearAuthToken(tokenType);
      clearSessionExpiresAt(tokenType);
      setIsValidated(false);
      setValidationError(null);
      router.replace(buildAuthRedirectUrl());
    }, logoutDelay);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(logoutTimer);
    };
  }, [
    hasSessionCredential,
    tokenType,
    sessionExpiresAt,
    router,
    clearEmployeeSessionCookie,
    clearAdminSessionCookie,
    buildAuthRedirectUrl,
  ]);

  useEffect(() => {
    if (
      !hasSessionCredential ||
      !sessionExpiresAt ||
      remainingSeconds === null
    ) {
      setIsWarningOpen(false);
      return;
    }

    if (remainingSeconds <= 0) {
      setIsWarningOpen(false);
      return;
    }

    const shouldWarnNow = remainingSeconds <= 60;
    const isDismissedForCurrentSession =
      warningDismissedFor === sessionExpiresAt;

    if (shouldWarnNow && !isDismissedForCurrentSession) {
      setIsWarningOpen(true);
    }
  }, [
    hasSessionCredential,
    sessionExpiresAt,
    remainingSeconds,
    warningDismissedFor,
  ]);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      if (!hasSessionCredential) {
        return;
      }

      if (!validationConfig) {
        setIsValidating(false);
        setIsValidated(true);
        setValidationError(null);
        return;
      }

      setIsValidating(true);
      setIsValidated(false);
      setValidationError(null);

      try {
        await apiFetch<unknown>(validationConfig.path, {
          method: "GET",
          tokenType,
          query: validationConfig.query,
        });

        if (!active) {
          return;
        }

        setIsValidated(true);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          if (tokenType === "employee") {
            void clearEmployeeSessionCookie();
          }

          if (tokenType === "admin") {
            void clearAdminSessionCookie();
          }

          clearAuthToken(tokenType);
          clearSessionExpiresAt(tokenType);
          setIsValidated(false);
          setValidationError(null);
          router.replace(buildAuthRedirectUrl());
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          setIsValidated(false);
          setValidationError(null);
          router.replace(
            `/unauthorized?next=${encodeURIComponent(resolvedNextPath)}`,
          );
          return;
        }

        setIsValidated(false);
        setValidationError(SESSION_VALIDATION_ERROR);
      } finally {
        if (active) {
          setIsValidating(false);
        }
      }
    }

    void validateSession();

    return () => {
      active = false;
    };
  }, [
    hasSessionCredential,
    tokenType,
    validationConfig,
    router,
    validationAttempt,
    clearEmployeeSessionCookie,
    clearAdminSessionCookie,
    buildAuthRedirectUrl,
    resolvedNextPath,
  ]);

  if (
    !hasSessionCredential ||
    isValidating ||
    (!isValidated && !validationError)
  ) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            กำลังตรวจสอบเซสชัน...
          </p>
        </div>
      </main>
    );
  }

  if (validationError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <section className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
            ตรวจสอบเซสชันไม่สำเร็จ
          </p>
          <h1 className="mt-2 text-xl font-semibold text-rose-900">
            ไม่สามารถยืนยันสิทธิ์การเข้าใช้งานได้
          </h1>
          <p className="mt-2 text-sm text-rose-800">{validationError}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setValidationAttempt((prev) => prev + 1)}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
            >
              ลองตรวจสอบเซสชันอีกครั้ง
            </button>
            <button
              type="button"
              onClick={() => {
                clearAuthToken(tokenType);
                clearSessionExpiresAt(tokenType);
                router.replace(redirectTo);
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100"
            >
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {children}

      {isWarningOpen && remainingSeconds !== null && remainingSeconds > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <svg
                  className="h-5 w-5"
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
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  ใกล้หมดเวลา
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  เซสชันจะหมดอายุในไม่เกิน 1 นาที
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  กรุณาบันทึกงานที่กำลังทำอยู่ ระบบจะพากลับไปหน้ายืนยัน OTP
                  อัตโนมัติเมื่อหมดเวลา
                </p>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-amber-800">
                    เวลาคงเหลือ
                  </p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-amber-900">
                    {formatRemainingTime(remainingSeconds)}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setWarningDismissedFor(sessionExpiresAt);
                      setIsWarningOpen(false);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    รับทราบ
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function formatRemainingTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours} ชม. ${minutes} น. ${seconds} วิ.`;
}
