"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { adminLogin, adminMe } from "@/lib/api/admin-auth";
import { clearSessionExpiresAt } from "@/lib/auth/session-expiry";
import { clearAuthToken } from "@/lib/auth/tokens";

function toThaiAdminLoginErrorMessage(error: ApiError) {
  const code = error.body?.code;
  const retryAfterSeconds =
    typeof (error.body as { retryAfterSeconds?: unknown } | null)
      ?.retryAfterSeconds === "number"
      ? ((error.body as { retryAfterSeconds?: number }).retryAfterSeconds ?? 0)
      : 0;

  switch (code) {
    case "INVALID_ADMIN_CREDENTIALS":
      return "ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลไม่ถูกต้อง";
    case "RATE_LIMIT_EXCEEDED":
      return retryAfterSeconds > 0
        ? `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่`
        : "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง";
    default:
      break;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (normalizedMessage.includes("invalid admin credentials")) {
    return "ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลไม่ถูกต้อง";
  }

  if (error.status === 429 || normalizedMessage.includes("too many")) {
    return retryAfterSeconds > 0
      ? `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${retryAfterSeconds} วินาที แล้วลองใหม่`
      : "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง";
  }

  return "ไม่สามารถเข้าสู่ระบบผู้ดูแลได้ กรุณาลองใหม่อีกครั้ง";
}

export default function Page() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const nextPath = "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearEmployeeSessionForRoleSwitch = async () => {
    try {
      await fetch("/api/auth/employee/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      });
    } catch {
      // Best-effort employee logout.
    } finally {
      clearAuthToken("employee");
      clearSessionExpiresAt("employee");
    }
  };

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      try {
        await adminMe();
        await clearEmployeeSessionForRoleSwitch();
        if (active) router.replace(nextPath);
      } catch {
        clearAuthToken("admin");
        clearSessionExpiresAt("admin");
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void checkExistingSession();
    return () => {
      active = false;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!username.trim() || !password.trim()) {
      setErrorMessage("ต้องระบุชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setSubmitting(true);
    try {
      await adminLogin({
        username: username.trim(),
        password,
        rememberMe,
      });

      await clearEmployeeSessionForRoleSwitch();
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(toThaiAdminLoginErrorMessage(error));
      } else setErrorMessage("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#e8edf2]">
        <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-400">
            กำลังตรวจสอบเซสชัน...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ── Left Panel ── */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0b2946] via-[#123a62] to-[#0a2540] px-8 py-12 md:w-[45%] md:py-0">
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#fed54f] to-[#b62026]" />

        {/* subtle texture / light */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.25) 0, transparent 22%), radial-gradient(circle at 75% 75%, rgba(254,213,79,0.18) 0, transparent 24%), radial-gradient(circle at 85% 28%, rgba(255,255,255,0.14) 0, transparent 20%)",
          }}
        />
        <div className="pointer-events-none absolute -left-12 top-16 h-36 w-36 rounded-full bg-white/8 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-[#fed54f]/10 blur-3xl" />

        {/* Desktop wave */}
        <div className="absolute bottom-0 right-0 top-0 hidden w-[80px] md:block">
          <svg
            viewBox="0 0 80 900"
            preserveAspectRatio="none"
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,0 C35,150 -8,300 28,450 C64,600 12,750 0,900 L80,900 L80,0 Z"
              fill="white"
            />
            <path
              d="M0,0 C45,180 2,330 35,480 C68,630 20,780 8,900 L80,900 L80,0 Z"
              fill="white"
              opacity="0.06"
            />
          </svg>
        </div>

        {/* Mobile bottom wave */}
        <div className="absolute bottom-0 left-0 right-0 h-12 md:hidden">
          <svg
            viewBox="0 0 375 48"
            preserveAspectRatio="none"
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,48 C80,10 180,40 280,15 C330,4 360,30 375,20 L375,48 Z"
              fill="white"
            />
          </svg>
        </div>

        <div className="relative z-10 text-center">
          <div className="mx-auto mb-6 w-fit">
            <div className="relative overflow-hidden rounded-[24px]">
              <span className="pointer-events-none absolute -inset-3 rounded-full bg-white/10 blur-xl" />
              <Image
                src="/company-logo-navbar.jpg"
                alt="Construction Lines logo"
                width={108}
                height={108}
                className="relative h-[108px] w-[108px] rounded-[24px] object-contain drop-shadow-[0_10px_22px_rgba(3,12,24,0.45)]"
                priority
              />
            </div>
          </div>

          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#fed54f]/85">
            Construction Lines
          </p>
          <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">
            HR <span className="text-[#fed54f]">Buddy</span>
          </h1>
          <p className="mt-1 text-sm text-white/60 md:mb-8">
            ระบบจัดการภายในองค์กร
          </p>

          {/* Features — desktop only */}
          <div className="mt-6 hidden space-y-3 text-left md:block">
            {[
              "จัดการคำขอและอนุมัติได้รวดเร็ว",
              "ดูแลข้อมูลพนักงานทั้งหมด",
              "รายงานและสถิติแบบ real-time",
            ].map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#fed54f]" />
                <p className="text-sm leading-relaxed text-white/70">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-4 left-0 right-0 hidden text-center text-xs tracking-[0.12em] text-white/20 md:block">
          © 2026 Construction Lines. All rights reserved.
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 md:px-14">
        <div className="w-full max-w-[420px]">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#b62026]">
            Admin Portal
          </p>
          <h2 className="mt-1.5 text-[28px] font-black tracking-tight text-[#0e2d4c]">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            สำหรับเจ้าหน้าที่ภายในบริษัทเท่านั้น
          </p>

          {/* Notice */}
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-[#fed54f]/50 bg-[#fef9ec] px-3.5 py-2.5">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-[#d4a800]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m0-6v.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <p className="text-sm font-semibold text-[#92650a]">
              เข้าถึงได้เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต
            </p>
          </div>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-[#0e2d4c]"
              >
                ชื่อผู้ใช้
              </label>
              <div className="flex items-center gap-2.5 border-b-2 border-slate-200 pb-2.5 transition-colors focus-within:border-[#0e2d4c]">
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={120}
                  autoComplete="username"
                  placeholder="กรอกชื่อผู้ใช้"
                  className="flex-1 border-none bg-transparent text-base text-[#0e2d4c] placeholder:text-slate-300 focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-[#0e2d4c]"
              >
                รหัสผ่าน
              </label>
              <div className="flex items-center gap-2.5 border-b-2 border-slate-200 pb-2.5 transition-colors focus-within:border-[#0e2d4c]">
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={200}
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  className="flex-1 border-none bg-transparent text-base text-[#0e2d4c] placeholder:text-slate-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-slate-300 transition-colors hover:text-slate-500"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    {showPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    ) : (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0e2d4c] focus:ring-[#0e2d4c]/30"
                />
                <span className="font-medium">
                  จดจำการเข้าสู่ระบบบนอุปกรณ์นี้
                </span>
              </label>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <svg
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm font-semibold text-rose-600">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#b62026] py-[14px] text-base font-black tracking-wide text-white transition hover:bg-[#0e2d4c] active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#0e2d4c]"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              กลับสู่หน้าแรก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8edf2]">
      <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-400">กำลังโหลด...</p>
      </div>
    </main>
  );
}
