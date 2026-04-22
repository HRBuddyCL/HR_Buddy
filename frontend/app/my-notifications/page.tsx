"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  getMyNotifications,
  markMyNotificationRead,
  markMyNotificationsReadAll,
  type NotificationListQuery,
  type NotificationItem,
} from "@/lib/api/notifications";
import {
  getDisplayNotificationMessage,
  getDisplayNotificationTitle,
} from "@/lib/notifications/display";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReadFilter = "all" | "unread" | "read";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** แปลง relative time เช่น "2 นาทีที่แล้ว" */
function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "เมื่อกี้";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return formatDateTime(iso);
}

// ─── Page Entry ────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyNotificationsContent />
    </RouteGuard>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function MyNotificationsContent() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>("unread");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const listQuery = useMemo<NotificationListQuery>(
    () => ({
      page,
      limit,
      isRead:
        readFilter === "all" ? undefined : readFilter === "read" ? true : false,
    }),
    [limit, page, readFilter],
  );

  const fetchNotifications = useCallback(
    async (query: NotificationListQuery) => {
      const [result, unreadResult] = await Promise.all([
        getMyNotifications(query),
        getMyNotifications({ page: 1, limit: 1, isRead: false }),
      ]);
      return { result, unreadTotal: unreadResult.total };
    },
    [],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const { result, unreadTotal: unreadTotalFromApi } =
          await fetchNotifications(listQuery);
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setUnreadTotal(unreadTotalFromApi);
        const nextTotalPages = Math.max(1, Math.ceil(result.total / limit));
        if (page > nextTotalPages) setPage(nextTotalPages);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "ไม่สามารถโหลดการแจ้งเตือนได้",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [fetchNotifications, limit, listQuery, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const refreshAfterMutation = useCallback(async () => {
    setErrorMessage(null);
    try {
      const { result, unreadTotal: unreadTotalFromApi } =
        await fetchNotifications(listQuery);
      setItems(result.items);
      setTotal(result.total);
      setUnreadTotal(unreadTotalFromApi);
      const nextTotalPages = Math.max(1, Math.ceil(result.total / limit));
      if (page > nextTotalPages) setPage(nextTotalPages);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถอัปเดตการแจ้งเตือนได้",
      );
    }
  }, [fetchNotifications, limit, listQuery, page]);

  const handleMarkAllRead = async () => {
    setMarkAllLoading(true);
    try {
      await markMyNotificationsReadAll();
      await refreshAfterMutation();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถอัปเดตการแจ้งเตือนได้",
      );
    } finally {
      setMarkAllLoading(false);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    setMarkingReadId(id);
    try {
      await markMyNotificationRead(id);
      await refreshAfterMutation();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถอัปเดตการแจ้งเตือนได้",
      );
    } finally {
      setMarkingReadId(null);
    }
  };

  // ─── Filter tab config ──────────────────────────────────────────────────────
  const filterTabs: { value: ReadFilter; label: string; icon: string }[] = [
    { value: "unread", label: "ยังไม่อ่าน", icon: "🔔" },
    { value: "read", label: "อ่านแล้ว", icon: "✓" },
    { value: "all", label: "ทั้งหมด", icon: "≡" },
  ];

  return (
    <div className="bg-[#f8fafc]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 md:px-8">
        {/* ── Hero Header ───────────────────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-2xl shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e2d4c] via-[#163d64] to-[#0e2d4c]" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#b62026] via-[#fed54f] to-[#b62026]" />
          {/* texture */}
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
                  HR Buddy
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                การแจ้งเตือน
              </h1>
              <p className="mt-1 text-sm text-white/65">
                รายการการแจ้งเตือนทั้งหมดของคุณ
              </p>
            </div>

            {/* Action zone: unread badge + buttons */}
            <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
              {/* badge จำนวนยังไม่อ่าน */}
              <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/30 bg-gradient-to-r from-white/20 via-white/15 to-white/10 px-4 py-2.5 shadow-[0_12px_24px_-16px_rgba(2,6,23,0.9)] backdrop-blur-sm">
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                <span
                  className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                    unreadTotal > 0
                      ? "bg-[#b62026] text-white shadow-[0_6px_16px_-8px_rgba(182,32,38,1)]"
                      : "bg-white/20 text-white/85 ring-1 ring-white/30"
                  }`}
                >
                  {unreadTotal > 99 ? "99+" : unreadTotal}
                </span>
                <span className="text-sm font-semibold tracking-wide text-white/95">
                  ยังไม่ได้อ่าน
                </span>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Link
                  href="/my-requests"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
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
                  กลับไปหน้าคำขอของฉัน
                </Link>

                {/* ปุ่ม mark all read */}
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={unreadTotal === 0 || markAllLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                >
                  {markAllLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      กำลังอัปเดต...
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
                          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                        />
                      </svg>
                      อ่านแล้วทั้งหมด
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Error Banner ──────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/30 bg-[#b62026]/5 px-4 py-3.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b62026] text-[10px] font-bold text-white">
              !
            </span>
            <p className="text-sm font-medium text-[#b62026]">{errorMessage}</p>
          </div>
        )}

        {/* ── Filter Tabs + List ────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Filter Tab Bar */}
          <div className="flex items-center gap-1 border-b border-slate-100 bg-[#f8fafc] px-4 pt-4 pb-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setPage(1);
                  setReadFilter(tab.value);
                }}
                className={`relative flex items-center gap-2 rounded-t-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  readFilter === tab.value
                    ? "bg-white text-[#0e2d4c] shadow-sm ring-1 ring-slate-200 ring-b-0"
                    : "text-slate-500 hover:text-[#0e2d4c]"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {/* dot เมื่อ active */}
                {readFilter === tab.value && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-[#0e2d4c]" />
                )}
                {/* badge จำนวน unread บน tab ยังไม่อ่าน */}
                {tab.value === "unread" && unreadTotal > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#b62026] px-1 text-[10px] font-bold text-white">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                )}
              </button>
            ))}

            {/* spacer + รายการทั้งหมด */}
            <div className="ml-auto pb-2 pr-1">
              {!loading && (
                <span className="rounded-full bg-[#0e2d4c]/8 px-2.5 py-1 text-xs font-semibold text-[#0e2d4c]">
                  {total} รายการ
                </span>
              )}
            </div>
          </div>

          <div className="p-5">
            {/* Loading */}
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0e2d4c]/20 border-t-[#0e2d4c]" />
                <p className="text-sm text-slate-500">
                  กำลังโหลดการแจ้งเตือน...
                </p>
              </div>
            ) : items.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                  🔔
                </div>
                <p className="font-semibold text-slate-700">
                  {readFilter === "unread"
                    ? "ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่าน"
                    : readFilter === "read"
                      ? "ไม่มีการแจ้งเตือนที่อ่านแล้ว"
                      : "ยังไม่มีการแจ้งเตือน"}
                </p>
                <p className="text-sm text-slate-400">
                  ระบบจะแจ้งเตือนเมื่อมีการอัปเดตคำขอของคุณ
                </p>
              </div>
            ) : (
              /* Notification List */
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    markingReadId={markingReadId}
                    markAllLoading={markAllLoading}
                    onMarkRead={handleMarkOneRead}
                  />
                ))}
              </ul>
            )}

            {/* Pagination */}
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

// ─── Notification Card ─────────────────────────────────────────────────────────

function NotificationCard({
  item,
  markingReadId,
  markAllLoading,
  onMarkRead,
}: {
  item: NotificationItem;
  markingReadId: string | null;
  markAllLoading: boolean;
  onMarkRead: (id: string) => void;
}) {
  const isMarking = markingReadId === item.id;

  return (
    <li
      className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
        item.isRead
          ? "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
          : "border-[#0e2d4c]/20 bg-[#0e2d4c]/3 hover:border-[#0e2d4c]/30 hover:shadow-sm"
      }`}
    >
      {/* แถบซ้าย: สีแดงถ้ายังไม่อ่าน */}
      <span
        className={`absolute inset-y-0 left-0 w-1 rounded-l-xl transition-all ${
          item.isRead ? "bg-slate-200" : "bg-[#b62026]"
        }`}
      />

      <div className="pl-5 pr-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* ซ้าย: ไอคอน + เนื้อหา */}
          <div className="flex items-start gap-3">
            {/* ไอคอนกระดิ่ง */}
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                item.isRead ? "bg-slate-100" : "bg-[#b62026]/10"
              }`}
            >
              <svg
                className={`h-4.5 w-4.5 ${item.isRead ? "text-slate-400" : "text-[#b62026]"}`}
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

            <div className="flex-1">
              {/* dot ยังไม่อ่าน */}
              <div className="flex items-center gap-2">
                {!item.isRead && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#b62026]" />
                )}
                <p
                  className={`text-sm font-bold ${item.isRead ? "text-slate-700" : "text-[#0e2d4c]"}`}
                >
                  {getDisplayNotificationTitle(item.title)}
                </p>
              </div>

              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {getDisplayNotificationMessage(item.message)}
              </p>

              {/* เวลา */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
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
                <span title={formatDateTime(item.createdAt)}>
                  {formatRelativeTime(item.createdAt)}
                </span>
                <span className="text-slate-300">·</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* ขวา: ปุ่ม action */}
          <div className="flex shrink-0 items-center gap-2">
            {/* ปุ่มดูคำขอ */}
            {item.requestId && (
              <Link
                href={`/my-requests/${item.requestId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c] active:scale-95"
              >
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                ดูคำขอ
              </Link>
            )}

            {/* ปุ่ม mark อ่านแล้ว */}
            {!item.isRead && (
              <button
                type="button"
                onClick={() => onMarkRead(item.id)}
                disabled={isMarking || markAllLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0e2d4c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#163d64] disabled:opacity-50 active:scale-95"
              >
                {isMarking ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                    กำลังอัปเดต...
                  </>
                ) : (
                  <>
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    อ่านแล้ว
                  </>
                )}
              </button>
            )}

            {/* badge อ่านแล้ว */}
            {item.isRead && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-400">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                อ่านแล้ว
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
