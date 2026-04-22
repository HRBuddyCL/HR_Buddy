"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  getAdminRequestSummary,
  type AdminRequestStatus,
  type AdminRequestSummaryResponse,
  type AdminRequestType,
} from "@/lib/api/admin-requests";
import {
  getAdminNotifications,
  markAdminNotificationRead,
  type AdminNotificationItem,
} from "@/lib/api/admin-notifications";
import {
  getDisplayNotificationMessage,
  getDisplayNotificationTitle,
} from "@/lib/notifications/display";

const statusOrder: AdminRequestStatus[] = [
  "NEW",
  "APPROVED",
  "IN_PROGRESS",
  "IN_TRANSIT",
  "DONE",
  "REJECTED",
  "CANCELED",
];
const pendingStatusOrder: AdminRequestStatus[] = [
  "NEW",
  "APPROVED",
  "IN_PROGRESS",
  "IN_TRANSIT",
];
const typeOrder: AdminRequestType[] = [
  "BUILDING",
  "VEHICLE",
  "MESSENGER",
  "DOCUMENT",
];
const DASHBOARD_NOTIFICATIONS_LIMIT = 5;

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function toThaiDashboardErrorMessage(error: ApiError, fallback: string) {
  const code = error.body?.code;
  if (code === "RATE_LIMIT_EXCEEDED")
    return "มีการเรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (error.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (error.status === 403) return "คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้";
  if (error.status === 429)
    return "มีการเรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  const normalizedMessage = error.message.toLowerCase();
  if (
    normalizedMessage.includes("request failed") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden")
  )
    return fallback;
  return error.message;
}

const statusLabelMap: Record<AdminRequestStatus, string> = {
  NEW: "ใหม่",
  APPROVED: "อนุมัติแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  IN_TRANSIT: "กำลังส่ง",
  DONE: "เสร็จสิ้น",
  REJECTED: "ถูกปฏิเสธ",
  CANCELED: "ยกเลิก",
};
const typeLabelMap: Record<AdminRequestType, string> = {
  BUILDING: "อาคาร",
  VEHICLE: "รถยนต์",
  MESSENGER: "เมสเซนเจอร์",
  DOCUMENT: "เอกสาร",
};

function getStatusStyle(status: AdminRequestStatus) {
  switch (status) {
    case "NEW":
      return {
        row: "bg-sky-50 border-sky-200",
        chip: "bg-sky-100 text-sky-700",
        bar: "bg-sky-500",
      };
    case "APPROVED":
      return {
        row: "bg-emerald-50 border-emerald-200",
        chip: "bg-emerald-100 text-emerald-700",
        bar: "bg-emerald-500",
      };
    case "IN_PROGRESS":
      return {
        row: "bg-amber-50 border-amber-200",
        chip: "bg-amber-100 text-amber-800",
        bar: "bg-amber-500",
      };
    case "IN_TRANSIT":
      return {
        row: "bg-purple-50 border-purple-200",
        chip: "bg-purple-100 text-purple-700",
        bar: "bg-purple-500",
      };
    case "DONE":
      return {
        row: "bg-green-50 border-green-200",
        chip: "bg-green-100 text-green-700",
        bar: "bg-green-600",
      };
    case "REJECTED":
      return {
        row: "bg-rose-50 border-rose-200",
        chip: "bg-rose-100 text-rose-700",
        bar: "bg-rose-500",
      };
    case "CANCELED":
      return {
        row: "bg-slate-50 border-slate-200",
        chip: "bg-slate-100 text-slate-600",
        bar: "bg-slate-400",
      };
  }
}

function getTypeStyle(type: AdminRequestType) {
  switch (type) {
    case "BUILDING":
      return {
        wrap: "border-blue-200 bg-blue-50",
        chip: "bg-blue-100 text-blue-700",
        iconBox: "border border-blue-200 bg-white",
        icon: "text-blue-600",
        label: "text-blue-700",
        count: "text-blue-900",
        pct: "text-blue-500",
      };
    case "VEHICLE":
      return {
        wrap: "border-cyan-200 bg-cyan-50",
        chip: "bg-cyan-100 text-cyan-700",
        iconBox: "border border-cyan-200 bg-white",
        icon: "text-cyan-600",
        label: "text-cyan-700",
        count: "text-cyan-900",
        pct: "text-cyan-500",
      };
    case "MESSENGER":
      return {
        wrap: "border-orange-200 bg-orange-50",
        chip: "bg-orange-100 text-orange-700",
        iconBox: "border border-orange-200 bg-white",
        icon: "text-orange-600",
        label: "text-orange-700",
        count: "text-orange-900",
        pct: "text-orange-500",
      };
    case "DOCUMENT":
      return {
        wrap: "border-violet-200 bg-violet-50",
        chip: "bg-violet-100 text-violet-700",
        iconBox: "border border-violet-200 bg-white",
        icon: "text-violet-600",
        label: "text-violet-700",
        count: "text-violet-900",
        pct: "text-violet-500",
      };
  }
}

const typeIconPaths: Record<AdminRequestType, string> = {
  BUILDING:
    "M3 21h18M5 21V7a2 2 0 012-2h4a2 2 0 012 2v14M9 21V11h6v10M15 7h2a2 2 0 012 2v12M7 10h.01M7 14h.01M17 12h.01M17 16h.01",
  VEHICLE:
    "M3 13l2-5a2 2 0 011.9-1.3h10.2A2 2 0 0119 8l2 5v5a1 1 0 01-1 1h-1a2 2 0 11-4 0H9a2 2 0 11-4 0H4a1 1 0 01-1-1v-5zm2.5 0h13",
  MESSENGER:
    "M3 11l2-5a2 2 0 011.9-1.3h8.2A2 2 0 0117 6l2 5v6a1 1 0 01-1 1h-1a2 2 0 11-4 0H9a2 2 0 11-4 0H4a1 1 0 01-1-1v-6zm2.5 0h11M19 8h2v4h-2M8 17h6",
  DOCUMENT:
    "M7 3h6l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2zm6 1v4h4M9 13h6M9 17h6",
};

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminDashboardContent />
    </RouteGuard>
  );
}

function AdminDashboardContent() {
  const [summary, setSummary] = useState<AdminRequestSummaryResponse | null>(
    null,
  );
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(
    [],
  );
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const notifyAdminNotificationRefresh = useCallback(() => {
    window.dispatchEvent(new Event("admin-notifications:refresh"));
  }, []);

  const loadDashboard = useCallback(async () => {
    const [summaryResult, notificationResult, unreadResult] = await Promise.all(
      [
        getAdminRequestSummary(),
        getAdminNotifications({
          page: 1,
          limit: DASHBOARD_NOTIFICATIONS_LIMIT,
        }),
        getAdminNotifications({ page: 1, limit: 1, isRead: false }),
      ],
    );
    return {
      summaryResult,
      notificationResult,
      unreadTotal: unreadResult.total,
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const {
          summaryResult,
          notificationResult,
          unreadTotal: unreadTotalFromApi,
        } = await loadDashboard();
        if (!active) return;
        setSummary(summaryResult);
        setNotifications(notificationResult.items);
        setUnreadTotal(unreadTotalFromApi);
        notifyAdminNotificationRefresh();
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError)
          setErrorMessage(
            toThaiDashboardErrorMessage(
              error,
              "ไม่สามารถโหลดแดชบอร์ดผู้ดูแลระบบได้",
            ),
          );
        else setErrorMessage("ไม่สามารถโหลดแดชบอร์ดผู้ดูแลระบบได้");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadDashboard, notifyAdminNotificationRefresh]);

  const refreshNotifications = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [notificationResult, unreadResult] = await Promise.all([
        getAdminNotifications({
          page: 1,
          limit: DASHBOARD_NOTIFICATIONS_LIMIT,
        }),
        getAdminNotifications({ page: 1, limit: 1, isRead: false }),
      ]);
      setNotifications(notificationResult.items);
      setUnreadTotal(unreadResult.total);
      notifyAdminNotificationRefresh();
    } catch (error) {
      if (error instanceof ApiError)
        setErrorMessage(
          toThaiDashboardErrorMessage(
            error,
            "ไม่สามารถอัปเดตรายการแจ้งเตือนได้",
          ),
        );
      else setErrorMessage("ไม่สามารถอัปเดตรายการแจ้งเตือนได้");
    }
  }, [notifyAdminNotificationRefresh]);

  const handleMarkRead = async (id: string) => {
    setMarkingReadId(id);
    try {
      await markAdminNotificationRead(id);
      await refreshNotifications();
    } catch (error) {
      if (error instanceof ApiError)
        setErrorMessage(
          toThaiDashboardErrorMessage(
            error,
            "ไม่สามารถอัปเดตรายการแจ้งเตือนได้",
          ),
        );
    } finally {
      setMarkingReadId(null);
    }
  };

  const total = summary?.total ?? 0;
  const pendingTotal = summary
    ? pendingStatusOrder.reduce(
        (sum, status) => sum + (summary.byStatus[status] ?? 0),
        0,
      )
    : 0;

  return (
    <main className="flex min-h-screen flex-col gap-5 bg-[#f8fafc] p-5 md:p-7">
      {/* ── Header ── */}
      <header className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e2d4c] via-[#163d64] to-[#0e2d4c]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#b62026] via-[#fed54f] to-[#b62026]" />
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
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fed54f]" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                HR Buddy Admin
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              แดชบอร์ดผู้ดูแลระบบ
            </h1>
            <p className="mt-1 text-sm text-white/65">
              ภาพรวมปริมาณคำขอ สถานะงาน และการแจ้งเตือนล่าสุด
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/30 bg-gradient-to-r from-white/20 via-white/15 to-white/10 px-4 py-2.5 shadow-[0_12px_24px_-16px_rgba(2,6,23,0.9)] backdrop-blur-sm">
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#fed54f] px-1.5 text-[11px] font-extrabold text-[#0e2d4c] shadow-[0_6px_16px_-8px_rgba(254,213,79,1)]">
                {pendingTotal > 99 ? "99+" : pendingTotal}
              </span>
              <span className="text-sm font-semibold tracking-wide text-white/95">
                คำขอที่ยังไม่เสร็จสิ้น
              </span>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#b62026]" />
                ยังไม่อ่าน {unreadTotal > 99 ? "99+" : unreadTotal}
              </div>
              <Link
                href="/admin/notifications"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                ไปที่การแจ้งเตือน
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
              </Link>
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <div className="rounded-2xl border border-[#0e2d4c]/10 bg-white px-6 py-5">
          <p className="text-sm font-medium text-slate-500">
            กำลังโหลดแดชบอร์ด...
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
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
          <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
        </div>
      )}

      {!loading && summary && (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Total */}
            <div className="relative overflow-hidden rounded-2xl bg-[#0e2d4c] p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#fed54f]/20">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="#fed54f"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">
                คำขอทั้งหมด
              </p>
              <p className="mt-1.5 text-[30px] font-black leading-none text-white">
                {total}
              </p>
            </div>
            {/* Pending */}
            <div className="rounded-2xl border border-orange-100 bg-white p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="#f97316"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                รอดำเนินการ
              </p>
              <p className="mt-1.5 text-[30px] font-black leading-none text-orange-500">
                {pendingTotal}
              </p>
            </div>
            {/* Done */}
            <div className="rounded-2xl border border-green-100 bg-white p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-green-50">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="#16a34a"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                เสร็จสิ้น
              </p>
              <p className="mt-1.5 text-[30px] font-black leading-none text-green-600">
                {summary.byStatus["DONE"] ?? 0}
              </p>
            </div>
            {/* Rejected */}
            <div className="rounded-2xl border border-rose-100 bg-white p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="#b62026"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                ปฏิเสธ/ยกเลิก
              </p>
              <p className="mt-1.5 text-[30px] font-black leading-none text-[#b62026]">
                {(summary.byStatus["REJECTED"] ?? 0) +
                  (summary.byStatus["CANCELED"] ?? 0)}
              </p>
            </div>
          </div>

          {/* ── Notifications + Status ── */}
          <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Notifications */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#0e2d4c]">
                    การแจ้งเตือนผู้ดูแล
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    ล่าสุด 5 รายการ
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadTotal > 0 && (
                    <span className="rounded-full bg-[#b62026] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                      ยังไม่อ่าน {unreadTotal}
                    </span>
                  )}
                  <Link
                    href="/admin/notifications"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#0e2d4c]/15 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0e2d4c] transition hover:bg-slate-50"
                  >
                    ดูทั้งหมด
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-slate-400">
                  ไม่มีการแจ้งเตือน
                </p>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                        item.isRead
                          ? "border-slate-100 bg-slate-50"
                          : "border-[#0e2d4c]/10 bg-[#f6f9ff]"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-slate-300" : "bg-[#b62026]"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[13px] font-bold leading-snug ${item.isRead ? "text-slate-500" : "text-[#0e2d4c]"}`}
                        >
                          {getDisplayNotificationTitle(item.title)}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                          {getDisplayNotificationMessage(item.message)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      {item.isRead ? (
                        <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700">
                          อ่านแล้ว
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={markingReadId === item.id}
                          onClick={() => void handleMarkRead(item.id)}
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                        >
                          {markingReadId === item.id ? "..." : "อ่านแล้ว"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Status breakdown */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <h2 className="mb-4 text-[15px] font-extrabold text-[#0e2d4c]">
                แยกตามสถานะ
              </h2>
              <ul className="space-y-2">
                {statusOrder.map((status) => {
                  const count = summary.byStatus[status] ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const s = getStatusStyle(status);
                  return (
                    <li
                      key={status}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${s.row}`}
                    >
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.chip}`}
                      >
                        {statusLabelMap[status]}
                      </span>
                      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/8">
                        <div
                          className={`h-full rounded-full transition-all ${s.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[14px] font-extrabold text-[#0e2d4c]">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* ── Type breakdown ── */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-extrabold text-[#0e2d4c]">
                  แยกตามประเภทคำขอ
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  สัดส่วนคำขอแต่ละประเภทในระบบ
                </p>
              </div>
              <Link
                href="/admin/requests"
                className="inline-flex items-center gap-1 rounded-lg border border-[#0e2d4c]/15 bg-white px-3 py-1.5 text-[11px] font-bold text-[#0e2d4c] transition hover:bg-slate-50"
              >
                จัดการคำขอ
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {typeOrder.map((type) => {
                const count = summary.byType[type] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const t = getTypeStyle(type);
                return (
                  <div
                    key={type}
                    className={`rounded-xl border p-4 text-center ${t.wrap}`}
                  >
                    <div
                      className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${t.iconBox}`}
                    >
                      <svg
                        className={`h-5 w-5 ${t.icon}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={typeIconPaths[type]}
                        />
                      </svg>
                    </div>
                    <p
                      className={`text-[10px] font-extrabold uppercase tracking-[0.1em] ${t.label}`}
                    >
                      {typeLabelMap[type]}
                    </p>
                    <p
                      className={`mt-1 text-[28px] font-black leading-none ${t.count}`}
                    >
                      {count}
                    </p>
                    <p className={`mt-1 text-[11px] font-semibold ${t.pct}`}>
                      {pct}% ของทั้งหมด
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
