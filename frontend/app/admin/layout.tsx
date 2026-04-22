"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/lib/api/admin-auth";
import { getAdminNotifications } from "@/lib/api/admin-notifications";
import {
  clearSessionExpiresAt,
  useSessionExpiresAt,
} from "@/lib/auth/session-expiry";
import { clearAuthToken } from "@/lib/auth/tokens";

const adminMenuItems = [
  {
    href: "/admin",
    label: "แดชบอร์ด",
    iconPath:
      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    href: "/admin/requests",
    label: "จัดการคำขอ",
    iconPath:
      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z",
  },
  {
    href: "/admin/notifications",
    label: "การแจ้งเตือนผู้ดูแล",
    iconPath:
      "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    href: "/admin/settings",
    label: "ตั้งค่า",
    iconPath:
      "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.08a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.08a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.08a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  },
  {
    href: "/admin/audit",
    label: "บันทึกการใช้งาน",
    iconPath:
      "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function toTwoDigits(value: number) {
  return value.toString().padStart(2, "0");
}

function getAdminSessionTone(remainingSeconds: number | null) {
  if (remainingSeconds !== null && remainingSeconds <= 900) {
    return {
      container:
        "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-50/70",
      title: "text-rose-800",
      badge: "bg-rose-100 text-rose-700 ring-rose-200",
      unitBox: "border-rose-200/80 bg-white/90",
      unitLabel: "text-rose-700/90",
      statusLabel: "ใกล้หมดเวลา",
    };
  }

  if (remainingSeconds !== null && remainingSeconds <= 3600) {
    return {
      container:
        "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/70",
      title: "text-amber-900",
      badge: "bg-amber-100 text-amber-700 ring-amber-200",
      unitBox: "border-amber-200/80 bg-white/90",
      unitLabel: "text-amber-700/90",
      statusLabel: "ควรเตรียมต่ออายุ",
    };
  }

  return {
    container:
      "border-[#0e2d4c]/20 bg-gradient-to-br from-[#eef4ff] via-white to-[#f7faff]",
    title: "text-[#0e2d4c]",
    badge: "bg-[#0e2d4c]/10 text-[#0e2d4c] ring-[#0e2d4c]/20",
    unitBox: "border-[#0e2d4c]/12 bg-white/90",
    unitLabel: "text-[#0e2d4c]/75",
    statusLabel: "ใช้งานปกติ",
  };
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const adminSessionExpiresAt = useSessionExpiresAt("admin");
  const [nowTs, setNowTs] = useState(() => Date.now());

  const adminSessionExpiresAtMs = useMemo(() => {
    if (!adminSessionExpiresAt) {
      return null;
    }

    const expiresAtMs = new Date(adminSessionExpiresAt).getTime();
    return Number.isFinite(expiresAtMs) ? expiresAtMs : null;
  }, [adminSessionExpiresAt]);

  useEffect(() => {
    if (!adminSessionExpiresAtMs) {
      return;
    }

    const syncNowTs = () => {
      setNowTs(Date.now());
    };

    const rafId = window.requestAnimationFrame(syncNowTs);
    const ticker = window.setInterval(syncNowTs, 1000);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(ticker);
    };
  }, [adminSessionExpiresAtMs]);

  const adminRemainingSeconds = useMemo(() => {
    if (!adminSessionExpiresAtMs) {
      return null;
    }

    const msLeft = adminSessionExpiresAtMs - nowTs;
    return Math.max(0, Math.floor(msLeft / 1000));
  }, [adminSessionExpiresAtMs, nowTs]);

  const adminSessionTimeLabel = useMemo(() => {
    if (adminRemainingSeconds === null) {
      return null;
    }

    const hours = toTwoDigits(Math.floor(adminRemainingSeconds / 3600));
    const minutes = toTwoDigits(
      Math.floor((adminRemainingSeconds % 3600) / 60),
    );
    const seconds = toTwoDigits(adminRemainingSeconds % 60);

    return {
      hours,
      minutes,
      seconds,
    };
  }, [adminRemainingSeconds]);

  const adminSessionTone = useMemo(
    () => getAdminSessionTone(adminRemainingSeconds),
    [adminRemainingSeconds],
  );

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAdminUnreadCount(0);
      return;
    }

    let active = true;

    async function loadUnreadCount() {
      try {
        const result = await getAdminNotifications({
          page: 1,
          limit: 1,
          isRead: false,
        });

        if (active) {
          setAdminUnreadCount(result.total);
        }
      } catch {
        if (active) {
          setAdminUnreadCount(0);
        }
      }
    }

    const onRefresh = () => {
      void loadUnreadCount();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadUnreadCount();
      }
    };

    void loadUnreadCount();

    const poller = window.setInterval(() => {
      void loadUnreadCount();
    }, 10000);

    window.addEventListener("focus", onRefresh);
    window.addEventListener(
      "admin-notifications:refresh",
      onRefresh as EventListener,
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(poller);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(
        "admin-notifications:refresh",
        onRefresh as EventListener,
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  if (pathname === "/admin/login") {
    return <div className="-mt-20">{children}</div>;
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setMobileMenuOpen(false);
    setIsLoggingOut(true);

    try {
      await adminLogout();
    } catch {
      // ignore and clear local token anyway
    } finally {
      clearAuthToken("admin");
      clearSessionExpiresAt("admin");
      router.replace("/admin/login");
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="-mt-20 min-h-screen bg-[#f8fafc]">
      <div className="grid min-h-screen w-full items-stretch lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="relative hidden min-h-screen flex-col overflow-hidden border-r border-[#0e2d4c]/12 bg-[#f8fafc] shadow-[0_22px_55px_-28px_rgba(14,45,76,0.34)] lg:flex">
          <div className="pointer-events-none absolute -right-16 top-20 h-52 w-52 rounded-full bg-[#0e2d4c]/6 blur-3xl" />
          <div className="pointer-events-none absolute -left-14 bottom-24 h-40 w-40 rounded-full bg-[#b62026]/8 blur-3xl" />

          <div className="relative border-b border-[#0e2d4c]/10 bg-[#f8fafc] px-5 py-6">
            <div className="rounded-2xl border border-[#0e2d4c]/10 bg-white/90 p-3 shadow-[0_10px_24px_-16px_rgba(14,45,76,0.45)] backdrop-blur-sm">
              <Image
                src="/company-logo-sidebar.png"
                alt="Construction Lines"
                width={560}
                height={560}
                className="h-auto w-full rounded-xl object-contain"
                priority
              />
            </div>
            <p className="[font-family:var(--font-headline)] mt-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/65">
              Construction Lines
            </p>
            <h2 className="[font-family:var(--font-headline)] mt-1 text-2xl font-bold text-[#0e2d4c]">
              HR <span className="text-[#b62026]">Buddy</span>{" "}
              <span className="text-[#fed54f]">Admin</span>
            </h2>
          </div>

          <nav className="relative flex flex-1 flex-col p-4">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0e2d4c]/50">
              เมนูผู้ดูแล
            </p>

            <ul className="space-y-2">
              {adminMenuItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                const isNotificationItem = item.href === "/admin/notifications";

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                        isActive
                          ? "border-[#0e2d4c]/20 bg-[#0e2d4c] text-white shadow-[0_12px_28px_-14px_rgba(14,45,76,0.8)]"
                          : "border-transparent bg-white/70 text-[#0e2d4c]/82 hover:-translate-y-[1px] hover:border-[#0e2d4c]/15 hover:bg-white hover:shadow-[0_10px_22px_-16px_rgba(14,45,76,0.42)]"
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-gradient-to-br from-white/35 to-white/10 text-white ring-1 ring-white/35 shadow-inner"
                            : "bg-gradient-to-br from-[#0e2d4c]/10 to-[#0e2d4c]/5 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/10 group-hover:from-[#0e2d4c]/15 group-hover:to-[#b62026]/10"
                        }`}
                      >
                        <svg
                          className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={item.iconPath}
                          />
                        </svg>
                      </span>

                      <span className="block flex-1 text-sm font-semibold">
                        {item.label}
                      </span>

                      {isNotificationItem && adminUnreadCount > 0 ? (
                        <span
                          className={`relative inline-flex min-w-[1.55rem] items-center justify-center overflow-hidden rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tracking-tight ring-1 transition-all duration-300 ${
                            isActive
                              ? "bg-white/15 text-white ring-white/35 shadow-[0_8px_16px_-10px_rgba(255,255,255,0.85)]"
                              : "bg-gradient-to-r from-[#b62026] to-[#d43a41] text-white ring-white/55 shadow-[0_10px_18px_-10px_rgba(182,32,38,0.9)]"
                          }`}
                        >
                          {!isActive ? (
                            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#b62026]/35" />
                          ) : null}
                          <span className="relative z-10">
                            {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                          </span>
                        </span>
                      ) : null}

                      {isActive ? (
                        <span className="pointer-events-none absolute inset-y-3 right-2 w-[3px] rounded-full bg-[#fed54f]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto space-y-2 pt-4">
              {adminSessionTimeLabel && (
                <div
                  className={`relative overflow-hidden rounded-2xl border px-3.5 py-3 ${adminSessionTone.container}`}
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-white/55 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div>
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${adminSessionTone.title}`}
                      >
                        Admin Session
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-medium ${adminSessionTone.title}`}
                      >
                        เซสชันแอดมินจะหมดอายุใน
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${adminSessionTone.badge}`}
                    >
                      {adminSessionTone.statusLabel}
                    </span>
                  </div>

                  <div className="relative mt-3 grid grid-cols-3 gap-2">
                    <div
                      className={`rounded-xl border px-2 py-2 text-center ${adminSessionTone.unitBox}`}
                    >
                      <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
                        {adminSessionTimeLabel.hours}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                      >
                        ชั่วโมง
                      </p>
                    </div>
                    <div
                      className={`rounded-xl border px-2 py-2 text-center ${adminSessionTone.unitBox}`}
                    >
                      <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
                        {adminSessionTimeLabel.minutes}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                      >
                        นาที
                      </p>
                    </div>
                    <div
                      className={`rounded-xl border px-2 py-2 text-center ${adminSessionTone.unitBox}`}
                    >
                      <p className="font-mono text-lg font-bold tracking-wide text-slate-900">
                        {adminSessionTimeLabel.seconds}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                      >
                        วินาที
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Link
                href="/"
                className="group relative flex items-center gap-3 rounded-2xl border border-transparent bg-white/70 px-3 py-3 text-[#0e2d4c]/82 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#0e2d4c]/15 hover:bg-white hover:shadow-[0_10px_22px_-16px_rgba(14,45,76,0.42)]"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0e2d4c]/10 to-[#0e2d4c]/5 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/10 transition-all duration-200 group-hover:from-[#0e2d4c]/15 group-hover:to-[#b62026]/10">
                  <svg
                    className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
                    />
                  </svg>
                </span>
                <span className="block text-sm font-semibold">
                  กลับหน้าหลัก
                </span>
              </Link>

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="group relative flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[#fff1f2] px-3 py-3 text-left text-[#991b1b] transition-all duration-200 hover:border-[#fecdd3] hover:bg-[#ffe4e6] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffd8dd] to-[#fecdd3] text-[#b62026] ring-1 ring-[#fecdd3] transition-all duration-200 group-hover:from-[#ffc2cc] group-hover:to-[#fda4af]">
                  <svg
                    className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </span>
                <span className="block text-sm font-semibold">
                  {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
                </span>
              </button>
            </div>
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="relative sticky top-0 z-40 lg:hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />

            <div className="border-b border-[#0e2d4c]/10 bg-white/95 backdrop-blur-xl shadow-[0_6px_26px_-10px_rgba(14,45,76,0.14)]">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-[76px] items-center justify-between">
                  <Link href="/admin" className="group flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#0e2d4c] to-[#b62026] opacity-0 blur transition duration-300 group-hover:opacity-30" />
                      <div className="relative rounded-xl border border-[#0e2d4c]/12 bg-white p-2 shadow-sm">
                        <Image
                          src="/company-logo-navbar.jpg"
                          alt="Construction Lines"
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-lg object-contain"
                          priority
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="[font-family:var(--font-headline)] text-[14px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/60 transition duration-300 group-hover:text-[#0e2d4c]/80">
                        Construction Lines
                      </span>
                      <span
                        className="[font-family:var(--font-headline)] text-[24px] font-bold leading-none tracking-tight text-[#0e2d4c] transition duration-300"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        HR{" "}
                        <span className="text-[#b62026] transition duration-300">
                          Buddy
                        </span>{" "}
                        <span className="text-[#fed54f] transition duration-300">
                          Admin
                        </span>
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    aria-label="Toggle admin menu"
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#0e2d4c]/12 bg-white text-[#0e2d4c] shadow-sm transition-all duration-200 hover:border-[#b62026]/40 hover:text-[#b62026] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f]"
                  >
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "rotate-45" : "-translate-y-[6px]"
                      }`}
                    />
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "scale-x-0 opacity-0" : ""
                      }`}
                    />
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "-rotate-45" : "translate-y-[6px]"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`absolute inset-x-0 top-full origin-top transition-all duration-200 ease-out ${
                mobileMenuOpen
                  ? "pointer-events-auto scale-y-100 opacity-100"
                  : "pointer-events-none scale-y-95 opacity-0"
              }`}
            >
              <div className="border-b border-[#0e2d4c]/10 bg-white/98 px-4 pb-6 pt-3 shadow-xl backdrop-blur-xl">
                <div className="space-y-1 rounded-2xl border border-[#0e2d4c]/8 bg-[#f8f9fc] p-2">
                  {adminSessionTimeLabel ? (
                    <div
                      className={`mx-2 mb-2 rounded-xl border px-3 py-2 ${adminSessionTone.container}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[11px] font-semibold ${adminSessionTone.title}`}
                        >
                          เซสชันแอดมินจะหมดอายุใน
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${adminSessionTone.badge}`}
                        >
                          {adminSessionTone.statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div
                          className={`rounded-lg border px-2 py-1.5 ${adminSessionTone.unitBox}`}
                        >
                          <p className="font-mono text-sm font-bold tracking-wide text-slate-900">
                            {adminSessionTimeLabel.hours}
                          </p>
                          <p
                            className={`text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                          >
                            ชม.
                          </p>
                        </div>
                        <div
                          className={`rounded-lg border px-2 py-1.5 ${adminSessionTone.unitBox}`}
                        >
                          <p className="font-mono text-sm font-bold tracking-wide text-slate-900">
                            {adminSessionTimeLabel.minutes}
                          </p>
                          <p
                            className={`text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                          >
                            น.
                          </p>
                        </div>
                        <div
                          className={`rounded-lg border px-2 py-1.5 ${adminSessionTone.unitBox}`}
                        >
                          <p className="font-mono text-sm font-bold tracking-wide text-slate-900">
                            {adminSessionTimeLabel.seconds}
                          </p>
                          <p
                            className={`text-[10px] font-semibold ${adminSessionTone.unitLabel}`}
                          >
                            วิ.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {adminMenuItems.map((item) => {
                    const isActive = isActivePath(pathname, item.href);
                    const isNotificationItem =
                      item.href === "/admin/notifications";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-[#0e2d4c] text-white shadow-sm"
                            : "text-[#0e2d4c]/70 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                        }`}
                      >
                        <span
                          className={`h-5 w-[3px] rounded-full ${isActive ? "bg-[#fed54f]" : "bg-transparent"}`}
                        />
                        <svg
                          className="h-[17px] w-[17px] shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={item.iconPath}
                          />
                        </svg>
                        <span className="flex-1">{item.label}</span>
                        {isNotificationItem && adminUnreadCount > 0 ? (
                          <span className="relative inline-flex min-w-[1.55rem] items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#b62026] to-[#d43a41] px-1.5 py-0.5 text-[10px] font-extrabold tracking-tight text-white ring-1 ring-white/65 shadow-[0_10px_18px_-10px_rgba(182,32,38,0.9)]">
                            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#b62026]/35" />
                            <span className="relative z-10">
                              {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                            </span>
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}

                  <div className="mx-2 my-2 h-px bg-[#0e2d4c]/8" />

                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#0e2d4c]/70 transition-all duration-200 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                  >
                    <span className="h-5 w-[3px] rounded-full bg-transparent" />
                    <svg
                      className="h-[17px] w-[17px] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
                      />
                    </svg>
                    กลับหน้าหลัก
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#b62026] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-[#b62026]/20 transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>
                      {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-4 md:px-6 lg:px-8 lg:py-8 [&>main]:mx-0 [&>main]:max-w-none [&>main]:min-h-0 [&>main]:px-0 [&>main]:py-0">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
