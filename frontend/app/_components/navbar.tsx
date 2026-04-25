"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EMPLOYEE_NOTIFICATIONS_REFRESH_EVENT,
  getMyNotifications,
  markMyNotificationRead,
  type NotificationItem,
} from "@/lib/api/notifications";
import {
  getDisplayNotificationMessage,
  getDisplayNotificationTitle,
} from "@/lib/notifications/display";
import { useSessionExpiresAt } from "@/lib/auth/session-expiry";

const navItems = [
  {
    href: "/",
    label: "หน้าหลัก",
    iconPath:
      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    href: "/my-requests",
    label: "คำขอของฉัน",
    iconPath:
      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatNotificationTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pathname = usePathname();
  const isAuthPath = pathname === "/auth/otp" || pathname.startsWith("/auth/");
  const adminSessionExpiresAt = useSessionExpiresAt("admin");
  const employeeSessionExpiresAt = useSessionExpiresAt("employee");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const isAdminSignedIn = useMemo(() => {
    if (!adminSessionExpiresAt) {
      return false;
    }

    const expiresAt = new Date(adminSessionExpiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > nowTs;
  }, [adminSessionExpiresAt, nowTs]);

  const employeeSessionExpiresAtMs = useMemo(() => {
    if (!employeeSessionExpiresAt) {
      return null;
    }

    const expiresAt = new Date(employeeSessionExpiresAt).getTime();
    return Number.isFinite(expiresAt) ? expiresAt : null;
  }, [employeeSessionExpiresAt]);

  useEffect(() => {
    if (!employeeSessionExpiresAtMs) {
      return;
    }

    const syncNowTs = () => {
      setNowTs(Date.now());
    };

    const rafId = window.requestAnimationFrame(syncNowTs);
    const timer = window.setInterval(() => {
      syncNowTs();
    }, 1000);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(timer);
    };
  }, [employeeSessionExpiresAtMs]);

  const remainingSeconds = useMemo(() => {
    if (!employeeSessionExpiresAtMs) {
      return null;
    }

    const msLeft = employeeSessionExpiresAtMs - nowTs;
    return Math.max(0, Math.floor(msLeft / 1000));
  }, [employeeSessionExpiresAtMs, nowTs]);

  const isEmployeeSessionActive =
    remainingSeconds !== null && remainingSeconds > 0;

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!isEmployeeSessionActive) {
        if (active) {
          setNotifications([]);
          setUnreadTotal(0);
        }
        return;
      }

      try {
        const [latestResult, unreadResult] = await Promise.all([
          getMyNotifications({
            limit: 5,
            page: 1,
          }),
          getMyNotifications({
            limit: 1,
            page: 1,
            isRead: false,
          }),
        ]);

        if (!active) {
          return;
        }

        setNotifications(latestResult.items);
        setUnreadTotal(unreadResult.total);
      } catch {
        if (active) {
          setNotifications([]);
          setUnreadTotal(0);
        }
      }
    }

    void loadNotifications();

    if (!isEmployeeSessionActive) {
      return () => {
        active = false;
      };
    }

    const onRefresh = () => {
      void loadNotifications();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications();
      }
    };

    const poller = window.setInterval(() => {
      void loadNotifications();
    }, 5000);

    window.addEventListener("focus", onRefresh);
    window.addEventListener(
      EMPLOYEE_NOTIFICATIONS_REFRESH_EVENT,
      onRefresh as EventListener,
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(poller);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(
        EMPLOYEE_NOTIFICATIONS_REFRESH_EVENT,
        onRefresh as EventListener,
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isEmployeeSessionActive]);

  const unreadCountLabel = useMemo(() => {
    if (unreadTotal > 99) return "99+";
    return String(unreadTotal);
  }, [unreadTotal]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (item.isRead) {
      return;
    }

    setUnreadTotal((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? { ...current, isRead: true, readAt: new Date().toISOString() }
          : current,
      ),
    );

    try {
      await markMyNotificationRead(item.id);
    } catch {
      setUnreadTotal((prev) => prev + 1);
      setNotifications((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, isRead: false, readAt: null }
            : current,
        ),
      );
    }
  };

  const sessionTimeLabel = useMemo(() => {
    if (remainingSeconds === null) {
      return null;
    }

    const hours = Math.floor(remainingSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((remainingSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${hours} ชม. ${minutes} น. ${seconds} วิ.`;
  }, [remainingSeconds]);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 [font-family:var(--font-content)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />

      <div className="border-b border-[#0e2d4c]/10 bg-white/95 backdrop-blur-xl shadow-[0_6px_26px_-10px_rgba(14,45,76,0.14)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[76px] items-center justify-between">
            <Link href="/" className="group flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#0e2d4c] to-[#b62026] opacity-0 blur transition duration-300 group-hover:opacity-30" />
                <div className="relative rounded-xl border border-[#0e2d4c]/12 bg-white p-2 shadow-sm">
                  <Image
                    src="/company-logo-navbar.jpg"
                    alt="Construction Lines"
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-lg object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="[font-family:var(--font-headline)] text-[14px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/60 transition duration-300 group-hover:text-[#0e2d4c]/80">
                  Construction Lines
                </span>
                <span
                  className="[font-family:var(--font-headline)] text-[24px] font-bold leading-none tracking-tight text-[#0e2d4c] transition duration-300 group-hover:text-[#b62026]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  HR{" "}
                  <span className="text-[#b62026] transition duration-300 group-hover:text-[#0e2d4c]">
                    Buddy
                  </span>
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-1.5 md:flex">
              {!isAuthPath && sessionTimeLabel && (
                <div className="mr-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  <span>เซสชันจะหมดอายุใน</span>
                  <span className="font-mono text-sm font-bold tracking-wide text-amber-900">
                    {sessionTimeLabel}
                  </span>
                </div>
              )}

              {isEmployeeSessionActive && (
                <div className="relative mr-1">
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                    aria-label="เปิดการแจ้งเตือน"
                    className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2 ${
                      isNotificationsOpen
                        ? "border-[#0e2d4c]/20 bg-[#0e2d4c] text-white shadow-md shadow-[#0e2d4c]/25"
                        : "border-[#0e2d4c]/12 bg-white text-[#0e2d4c]/80 hover:-translate-y-px hover:border-[#0e2d4c]/30 hover:bg-gradient-to-r hover:from-[#f7faff] hover:to-[#fff4f5] hover:text-[#0e2d4c] hover:shadow-md"
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-all duration-500 group-hover:translate-x-full group-hover:opacity-100" />
                    <svg
                      className="relative h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {unreadTotal > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-[2.5px] border-white bg-[#c71f2d] px-1 text-[13px] font-extrabold leading-none text-white shadow-[0_6px_14px_-6px_rgba(199,31,45,0.78)]">
                        {unreadCountLabel}
                      </span>
                    ) : null}
                  </button>

                  {isNotificationsOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                      <p className="px-1 text-sm font-semibold text-slate-900">
                        การแจ้งเตือนล่าสุด
                      </p>

                      <ul className="mt-2 max-h-72 space-y-2 overflow-auto">
                        {notifications.length === 0 ? (
                          <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            ไม่มีการแจ้งเตือน
                          </li>
                        ) : (
                          notifications.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleNotificationClick(item)
                                }
                                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                  item.isRead
                                    ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
                                    : "border-amber-200 bg-amber-50 hover:bg-amber-100"
                                }`}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {getDisplayNotificationTitle(item.title)}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-700 line-clamp-2">
                                  {getDisplayNotificationMessage(item.message)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {formatNotificationTime(item.createdAt)}
                                </p>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>

                      <Link
                        href="/my-notifications"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        การแจ้งเตือนทั้งหมด
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {navItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setIsNotificationsOpen(false)}
                    className={`
                      group/link relative inline-flex items-center gap-2
                      rounded-xl overflow-hidden px-[18px] py-[11px]
                      text-[14px] font-semibold
                      transition-all duration-200
                      focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                      ${
                        isActive
                          ? "bg-[#0e2d4c] text-white shadow-md shadow-[#0e2d4c]/20 ring-1 ring-white/10"
                          : "text-[#0e2d4c]/70 hover:bg-[#0e2d4c]/6 hover:text-[#0e2d4c]"
                      }
                    `}
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
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
                    {item.label}

                    {isActive && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#fed54f]/90" />
                    )}
                  </Link>
                );
              })}

              <div className="mx-3.5 h-8 w-px bg-gradient-to-b from-transparent via-[#0e2d4c]/15 to-transparent" />

              <Link
                href={isAdminSignedIn ? "/admin" : "/admin/login"}
                className="
                  group/btn relative inline-flex items-center gap-2.5 overflow-hidden
                  rounded-xl bg-[#b62026] px-[22px] py-[11px]
                  text-[14px] font-bold text-white
                  shadow-md shadow-[#b62026]/25
                  transition-all duration-300
                  hover:-translate-y-px hover:shadow-lg hover:shadow-[#b62026]/35
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                "
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover/btn:translate-x-full" />

                <svg
                  className="relative h-[17px] w-[17px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span className="relative">
                  {isAdminSignedIn ? "กลับสู่ Dashboard" : "เข้าสู่ระบบ Admin"}
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {isEmployeeSessionActive ? (
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen((prev) => !prev)}
                  aria-label="เปิดการแจ้งเตือน"
                  aria-expanded={isNotificationsOpen}
                  className="
                    relative inline-flex h-11 w-11 items-center justify-center
                    rounded-xl border border-[#0e2d4c]/12 bg-white
                    text-[#0e2d4c] shadow-sm
                    transition-all duration-200
                    hover:border-[#b62026]/40 hover:text-[#b62026] hover:shadow-md
                    focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-[#fed54f]
                  "
                >
                  <svg
                    className="h-[19px] w-[19px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>

                  {unreadTotal > 0 ? (
                    <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-[2.5px] border-white bg-[#c71f2d] px-1 text-[13px] font-extrabold leading-none text-white shadow-[0_6px_14px_-6px_rgba(199,31,45,0.78)]">
                      {unreadCountLabel}
                    </span>
                  ) : null}
                </button>
              ) : null}

              <button
                onClick={() => {
                  setIsNotificationsOpen(false);
                  setMobileMenuOpen((p) => !p);
                }}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                className="
                  relative inline-flex h-11 w-11 items-center justify-center
                  rounded-xl border border-[#0e2d4c]/12 bg-white
                  text-[#0e2d4c] shadow-sm
                  transition-all duration-200
                  hover:border-[#b62026]/40 hover:text-[#b62026] hover:shadow-md
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-[#fed54f]
                "
              >
                <span
                  className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "rotate-45" : "-translate-y-[6px]"}`}
                />
                <span
                  className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "scale-x-0 opacity-0" : ""}`}
                />
                <span
                  className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${mobileMenuOpen ? "-rotate-45" : "translate-y-[6px]"}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isEmployeeSessionActive && isNotificationsOpen ? (
        <div className="md:hidden border-b border-[#0e2d4c]/10 bg-white/98 px-4 pb-4 pt-2 shadow-xl backdrop-blur-xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-1 text-sm font-semibold text-slate-900">
              การแจ้งเตือนล่าสุด
            </p>

            <ul className="mt-2 max-h-72 space-y-2 overflow-auto">
              {notifications.length === 0 ? (
                <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  ไม่มีการแจ้งเตือน
                </li>
              ) : (
                notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(item)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        item.isRead
                          ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
                          : "border-amber-200 bg-amber-50 hover:bg-amber-100"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {getDisplayNotificationTitle(item.title)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-700 line-clamp-2">
                        {getDisplayNotificationMessage(item.message)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatNotificationTime(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <Link
              href="/my-notifications"
              onClick={() => setIsNotificationsOpen(false)}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              การแจ้งเตือนทั้งหมด
            </Link>
          </div>
        </div>
      ) : null}

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${mobileMenuOpen ? "max-h-[420px] opacity-100" : "pointer-events-none max-h-0 opacity-0"}`}
      >
        <div className="border-b border-[#0e2d4c]/10 bg-white/98 px-4 pb-6 pt-3 shadow-xl backdrop-blur-xl">
          {!isAuthPath && sessionTimeLabel && (
            <div className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              <span>เซสชันจะหมดอายุใน</span>
              <span className="font-mono text-sm font-bold tracking-wide text-amber-900">
                {sessionTimeLabel}
              </span>
            </div>
          )}

          <div className="space-y-1 rounded-2xl border border-[#0e2d4c]/8 bg-[#f8f9fc] p-2">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-xl px-4 py-3
                    text-[14px] font-semibold
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-[#0e2d4c] text-white shadow-sm"
                        : "text-[#0e2d4c]/70 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                    }
                  `}
                >
                  <span
                    className={`h-5 w-[3px] rounded-full transition-all ${isActive ? "bg-[#fed54f]" : "bg-transparent"}`}
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
                  {item.label}
                </Link>
              );
            })}

            <div className="mx-2 my-2 h-px bg-[#0e2d4c]/8" />

            <Link
              href={isAdminSignedIn ? "/admin" : "/admin/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="
                group/mbtn relative flex items-center justify-center gap-2.5 overflow-hidden
                rounded-xl bg-[#b62026] px-4 py-3.5
                text-[14px] font-bold text-white
                shadow-md shadow-[#b62026]/20
                transition-all duration-300 hover:shadow-lg
              "
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover/mbtn:translate-x-full" />
              <svg
                className="relative h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span className="relative">
                {isAdminSignedIn ? "กลับสู่ Dashboard" : "เข้าสู่ระบบ Admin"}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
