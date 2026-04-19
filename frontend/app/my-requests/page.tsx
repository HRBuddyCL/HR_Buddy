"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { SelectField, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  getMyRequests,
  type MyRequestItem,
  type Urgency,
  type RequestStatus,
  type RequestType,
} from "@/lib/api/my-requests";
import {
  getMyNotifications,
  type NotificationItem,
} from "@/lib/api/notifications";
import { clearSessionExpiresAt } from "@/lib/auth/session-expiry";
import { clearAuthToken } from "@/lib/auth/tokens";

// ─── Config ────────────────────────────────────────────────────────────────────

const requestTypeOptions: Array<{
  value: RequestType;
  label: string;
  icon: string;
}> = [
  { value: "BUILDING", label: "อาคาร", icon: "🏢" },
  { value: "VEHICLE", label: "รถยนต์", icon: "🚗" },
  { value: "MESSENGER", label: "เมสเซนเจอร์", icon: "📦" },
  { value: "DOCUMENT", label: "เอกสาร", icon: "📄" },
];

const requestStatusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: "NEW", label: "ใหม่" },
  { value: "APPROVED", label: "อนุมัติแล้ว" },
  { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
  { value: "IN_TRANSIT", label: "กำลังส่ง" },
  { value: "DONE", label: "เสร็จสิ้น" },
  { value: "REJECTED", label: "ถูกปฏิเสธ" },
  { value: "CANCELED", label: "ยกเลิก" },
];

/** Badge สี + label สำหรับแต่ละสถานะ */
const statusConfig: Record<
  RequestStatus,
  { color: string; label: string; dot: string }
> = {
  NEW: {
    color: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    dot: "bg-sky-500",
    label: "ใหม่",
  },
  APPROVED: {
    color: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    dot: "bg-indigo-500",
    label: "อนุมัติแล้ว",
  },
  IN_PROGRESS: {
    color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
    label: "กำลังดำเนินการ",
  },
  IN_TRANSIT: {
    color: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "bg-orange-500",
    label: "กำลังส่ง",
  },
  DONE: {
    color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    label: "เสร็จสิ้น",
  },
  REJECTED: {
    color: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
    label: "ถูกปฏิเสธ",
  },
  CANCELED: {
    color: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    label: "ยกเลิก",
  },
};

const urgencyConfig: Record<
  Urgency,
  { label: string; color: string; icon: string }
> = {
  NORMAL: { label: "ปกติ", color: "text-slate-500", icon: "○" },
  HIGH: { label: "สูง", color: "text-amber-600 font-semibold", icon: "▲" },
  CRITICAL: { label: "เร่งด่วน", color: "text-rose-600 font-bold", icon: "⚡" },
};

const typeIconMap: Record<RequestType, string> = {
  BUILDING: "🏢",
  VEHICLE: "🚗",
  MESSENGER: "📦",
  DOCUMENT: "📄",
};

const typeLabelMap: Record<RequestType, string> = {
  BUILDING: "อาคาร",
  VEHICLE: "รถยนต์",
  MESSENGER: "เมสเซนเจอร์",
  DOCUMENT: "เอกสาร",
};

const LOGOUT_REQUEST_TIMEOUT_MS = 5000;

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// ─── Page Entry ────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyRequestsContent />
    </RouteGuard>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function MyRequestsContent() {
  const [items, setItems] = useState<MyRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | RequestType>("");
  const [status, setStatus] = useState<"" | RequestStatus>("");
  const [notifOpen, setNotifOpen] = useState(true);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [requestsResult, notificationsResult] = await Promise.all([
          getMyRequests({
            page,
            limit,
            q: search.trim() || undefined,
            type: type || undefined,
            status: status || undefined,
            sortBy: "latestActivityAt",
            sortOrder: "desc",
          }),
          getMyNotifications(20),
        ]);
        if (!active) return;
        setItems(requestsResult.items);
        setTotal(requestsResult.total);
        setNotifications(notificationsResult.items);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError ? error.message : "ไม่สามารถโหลดข้อมูลได้",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [limit, page, search, status, type]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilter = search !== "" || type !== "" || status !== "";

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      const requestLogout = async () => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, LOGOUT_REQUEST_TIMEOUT_MS);

        try {
          return await fetch("/api/auth/employee/logout", {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            keepalive: true,
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      let response = await requestLogout();
      if (!response.ok) {
        response = await requestLogout();
      }
    } catch {
      // Best effort: continue with local cleanup and redirect.
    } finally {
      clearSessionExpiresAt("employee");
      clearAuthToken("employee");
      window.location.href = "/auth/otp";
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 md:px-8">
        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-2xl shadow-lg">
          {/* พื้นหลัง gradient สีบริษัท */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e2d4c] via-[#163d64] to-[#0e2d4c]" />
          {/* accent bar ด้านล่าง */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#b62026] via-[#fed54f] to-[#b62026]" />
          {/* ลาย texture อ่อนๆ */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #fed54f 1px, transparent 1px), radial-gradient(circle at 80% 20%, #b62026 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-7 md:px-8">
            <div>
              {/* ป้ายเล็กบน */}
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#fed54f]" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                  HR Buddy
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                คำขอของฉัน
              </h1>
              <p className="mt-1 text-sm text-white/65">
                ติดตามสถานะคำขอล่าสุดของคุณ พร้อมดูการแจ้งเตือนสำคัญ
              </p>
            </div>

            {/* ปุ่มออกจากระบบ */}
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-white/25 bg-gradient-to-r from-[#b62026] via-[#c6282f] to-[#8f1a1f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(182,32,38,0.85)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-14px_rgba(182,32,38,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e2d4c] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="relative">
                {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
              </span>
            </button>
          </div>
        </header>

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/30 bg-[#b62026]/5 px-4 py-3.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b62026] text-[10px] font-bold text-white">
              !
            </span>
            <p className="text-sm font-medium text-[#b62026]">{errorMessage}</p>
          </div>
        )}

        {/* ── Notifications Panel ───────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header แถบแจ้งเตือน */}
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {/* ไอคอนกระดิ่ง */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e2d4c]/8">
                <svg
                  className="h-4.5 w-4.5 text-[#0e2d4c]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#0e2d4c]">
                  การแจ้งเตือน
                </p>
                <p className="text-xs text-slate-500">แสดง 5 รายการล่าสุด</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#b62026] px-1.5 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
              {/* ลูกศร toggle */}
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${notifOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          {/* รายการแจ้งเตือน */}
          <div
            className={`transition-all duration-300 ${notifOpen ? "max-h-[600px] opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}
          >
            <div className="border-t border-slate-100 px-5 pb-5 pt-3">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <span className="text-3xl">🔔</span>
                  <p className="text-sm text-slate-500">ยังไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notifications.slice(0, 5).map((item) => (
                    <li
                      key={item.id}
                      className={`relative overflow-hidden rounded-xl border px-4 py-3 transition ${
                        !item.isRead
                          ? "border-[#0e2d4c]/20 bg-[#0e2d4c]/4"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      {/* แถบสีซ้ายถ้ายังไม่ได้อ่าน */}
                      {!item.isRead && (
                        <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-[#b62026]" />
                      )}
                      <p
                        className={`text-sm font-semibold ${!item.isRead ? "text-[#0e2d4c]" : "text-slate-700"}`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {item.message}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {/* ปุ่มดูทั้งหมด */}
              <div className="mt-4 flex justify-end">
                <Link
                  href="/my-notifications"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0e2d4c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#163d64] active:scale-95"
                >
                  ดูการแจ้งเตือนทั้งหมด
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Filter Panel ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-[#0e2d4c]/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-[#0e2d4c]">ตัวกรอง</h2>
            {/* badge แสดงว่ากำลังกรองอยู่ */}
            {hasActiveFilter && (
              <span className="rounded-full bg-[#fed54f] px-2 py-0.5 text-[10px] font-bold text-[#0e2d4c]">
                กำลังกรอง
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              id="q"
              label="ค้นหา"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="หมายเลขคำขอหรือชื่อ"
            />
            <SelectField
              id="type"
              label="ประเภท"
              value={type}
              onChange={(e) => {
                setPage(1);
                setType(e.target.value as "" | RequestType);
              }}
            >
              <option value="">ทั้งหมด</option>
              {requestTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.icon} {o.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="status"
              label="สถานะ"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as "" | RequestStatus);
              }}
            >
              <option value="">ทั้งหมด</option>
              {requestStatusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>

            <div className="flex items-end">
              <button
                type="button"
                disabled={!hasActiveFilter}
                onClick={() => {
                  setSearch("");
                  setType("");
                  setStatus("");
                  setPage(1);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-[#b62026]/40 hover:bg-[#b62026]/5 hover:text-[#b62026] disabled:cursor-not-allowed disabled:opacity-40"
              >
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
                รีเซ็ตตัวกรอง
              </button>
            </div>
          </div>
        </section>

        {/* ── Request List ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header ของ section */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-[#0e2d4c]/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h2 className="text-sm font-semibold text-[#0e2d4c]">
                รายการคำขอ
              </h2>
            </div>
            {!loading && (
              <span className="rounded-full bg-[#0e2d4c]/8 px-2.5 py-1 text-xs font-semibold text-[#0e2d4c]">
                ทั้งหมด {total} รายการ
              </span>
            )}
          </div>

          <div className="p-5">
            {/* Loading State */}
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0e2d4c]/20 border-t-[#0e2d4c]" />
                <p className="text-sm text-slate-500">กำลังโหลดข้อมูล...</p>
              </div>
            ) : items.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                  📋
                </div>
                <p className="font-semibold text-slate-700">ไม่พบรายการคำขอ</p>
                <p className="text-sm text-slate-500">
                  ลองปรับตัวกรองเพื่อดูผลลัพธ์อื่น
                </p>
              </div>
            ) : (
              /* Request Cards */
              <div className="space-y-4">
                {items.map((item) => {
                  const sc = statusConfig[item.status];
                  const uc = urgencyConfig[item.urgency];
                  return (
                    <Link
                      key={item.id}
                      href={`/my-requests/${item.id}`}
                      aria-label={`ดูรายละเอียดคำขอ ${item.requestNo}`}
                      className="group relative block overflow-hidden rounded-3xl border border-[#0e2d4c]/10 bg-gradient-to-br from-white to-slate-50/40 shadow-[0_8px_24px_-24px_rgba(14,45,76,0.45)] transition duration-300 hover:-translate-y-0.5 hover:border-[#0e2d4c]/22 hover:shadow-[0_14px_30px_-26px_rgba(14,45,76,0.55)]"
                    >
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#0e2d4c]/15 to-transparent" />

                      {/* แถบสีด้านซ้ายตาม urgency */}
                      <span
                        className={`absolute inset-y-0 left-0 w-1.5 rounded-l-3xl ${
                          item.urgency === "CRITICAL"
                            ? "bg-gradient-to-b from-[#b62026] to-[#7e1419]"
                            : item.urgency === "HIGH"
                              ? "bg-gradient-to-b from-[#fed54f] to-[#f6c52d]"
                              : "bg-gradient-to-b from-[#0e2d4c]/45 to-[#0e2d4c]/22"
                        }`}
                      />

                      <div className="pl-5 pr-5 py-5 md:px-6 md:py-6">
                        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 md:p-5">
                          {/* ซ้าย: ประเภท + หมายเลข */}
                          <div className="flex items-center gap-3">
                            {/* ไอคอนประเภท */}
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#0e2d4c]/10 bg-[#0e2d4c]/5 text-xl">
                              {typeIconMap[item.type]}
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {typeLabelMap[item.type]}
                              </p>
                              <h3 className="text-lg font-bold leading-tight text-[#0e2d4c]">
                                {item.requestNo}
                              </h3>
                            </div>
                          </div>

                          {/* ขวา: badge สถานะ */}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${sc.color}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${sc.dot}`}
                            />
                            {sc.label}
                          </span>
                        </div>

                        {/* แถวล่าง: กิจกรรมล่าสุด + ความเร่งด่วน + ปุ่มดูรายละเอียด */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 md:px-5">
                          <div className="flex flex-wrap items-center gap-4">
                            {/* วันที่กิจกรรมล่าสุด */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <svg
                                className="h-3.5 w-3.5"
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
                              {formatDateTime(item.latestActivityAt)}
                            </div>
                            {/* ความเร่งด่วน */}
                            <div
                              className={`flex items-center gap-1 text-xs ${uc.color}`}
                            >
                              <span>{uc.icon}</span>
                              <span>{uc.label}</span>
                            </div>
                          </div>

                          {/* ปุ่มดูรายละเอียด */}
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0e2d4c]">
                            <span className="rounded-lg bg-[#0e2d4c] px-3.5 py-1.5 text-white transition group-hover:bg-[#163d64]">
                              ดูรายละเอียด
                            </span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0e2d4c]/20 bg-white text-[#0e2d4c] transition group-hover:translate-x-0.5 group-hover:border-[#0e2d4c]/35">
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ── Pagination ──────────────────────────────────────────────── */}
            {!loading && items.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-sm text-slate-500">
                  หน้า{" "}
                  <span className="font-semibold text-[#0e2d4c]">{page}</span>{" "}
                  จาก{" "}
                  <span className="font-semibold text-[#0e2d4c]">
                    {totalPages}
                  </span>
                  <span className="ml-2 text-slate-400">({total} รายการ)</span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c] disabled:cursor-not-allowed disabled:opacity-40"
                  >
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
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    ก่อนหน้า
                  </button>

                  {/* หน้าปัจจุบัน */}
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e2d4c] text-sm font-bold text-white">
                    {page}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ถัดไป
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
