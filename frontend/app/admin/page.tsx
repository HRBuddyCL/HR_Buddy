"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import { adminLogout, adminMe, type AdminSessionMe } from "@/lib/api/admin-auth";
import {
  getAdminRequestSummary,
  type AdminRequestStatus,
  type AdminRequestSummaryResponse,
  type AdminRequestType,
} from "@/lib/api/admin-requests";
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAdminNotificationsReadAll,
  type AdminNotificationItem,
} from "@/lib/api/admin-notifications";
import { clearAuthToken } from "@/lib/auth/tokens";

const statusOrder: AdminRequestStatus[] = [
  "NEW",
  "APPROVED",
  "IN_PROGRESS",
  "IN_TRANSIT",
  "DONE",
  "REJECTED",
  "CANCELED",
];

const typeOrder: AdminRequestType[] = ["BUILDING", "VEHICLE", "MESSENGER", "DOCUMENT"];

function formatDateTime(iso?: string | null) {
  if (!iso) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminDashboardContent />
    </RouteGuard>
  );
}

function AdminDashboardContent() {
  const [session, setSession] = useState<AdminSessionMe | null>(null);
  const [summary, setSummary] = useState<AdminRequestSummaryResponse | null>(null);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [sessionResult, summaryResult, notificationResult] = await Promise.all([
          adminMe(),
          getAdminRequestSummary(),
          getAdminNotifications(20),
        ]);

        if (!active) {
          return;
        }

        setSession(sessionResult);
        setSummary(summaryResult);
        setNotifications(notificationResult.items);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load admin dashboard");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } catch {
      // ignore and clear local token anyway
    } finally {
      clearAuthToken("admin");
      window.location.href = "/admin/login";
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAdminNotificationsReadAll();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      }
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAdminNotificationRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 5 - Admin Core</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="mt-2 text-slate-700">Overview of request volume, status distribution, and recent admin notifications.</p>
            {session ? (
              <p className="mt-2 text-sm text-slate-600">
                Signed in as <span className="font-semibold">{session.username}</span> (expires {formatDateTime(session.expiresAt)})
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/requests" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Open requests table
            </Link>
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-700">Loading dashboard...</p> : null}

      {!loading && summary ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Snapshot</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total requests</p>
                <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
              </div>
              {statusOrder.slice(0, 3).map((status) => (
                <div key={status} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{status}</p>
                  <p className="text-2xl font-semibold text-slate-900">{summary.byStatus[status] ?? 0}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">By status</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {statusOrder.map((status) => (
                  <li key={status} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <span>{status}</span>
                    <span className="font-semibold text-slate-900">{summary.byStatus[status] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">By type</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {typeOrder.map((type) => (
                  <li key={type} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <span>{type}</span>
                    <span className="font-semibold text-slate-900">{summary.byType[type] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Admin notifications</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Unread: {unreadCount}</span>
            <Button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No notifications.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p>{item.message}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {!item.isRead ? (
                    <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100" onClick={() => void handleMarkRead(item.id)}>
                      Mark read
                    </Button>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Read</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}
    </main>
  );
}
