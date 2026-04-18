"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  getMyNotifications,
  markMyNotificationRead,
  markMyNotificationsReadAll,
  type NotificationListQuery,
  type NotificationItem,
} from "@/lib/api/notifications";

type ReadFilter = "all" | "unread" | "read";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyNotificationsContent />
    </RouteGuard>
  );
}

function MyNotificationsContent() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>("unread");
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const query: NotificationListQuery = {
          page,
          limit,
          isRead:
            readFilter === "all"
              ? undefined
              : readFilter === "read"
                ? true
                : false,
        };

        const result = await getMyNotifications({
          ...query,
        });

        if (!active) {
          return;
        }

        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดการแจ้งเตือนได้");
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
  }, [limit, page, readFilter]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleMarkAllRead = async () => {
    try {
      await markMyNotificationsReadAll();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถอัปเดตการแจ้งเตือนได้");
      }
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await markMyNotificationRead(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถอัปเดตการแจ้งเตือนได้");
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          การแจ้งเตือนทั้งหมด
        </h1>
        <p className="mt-2 text-slate-700">รายการการแจ้งเตือนทั้งหมดของคุณ</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            ยังไม่ได้อ่าน: {unreadCount}
          </span>

          <Button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
          </Button>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">ประเภทการอ่าน</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              className={
                readFilter === "unread"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              }
              onClick={() => {
                setPage(1);
                setReadFilter("unread");
              }}
            >
              ยังไม่อ่าน
            </Button>
            <Button
              type="button"
              className={
                readFilter === "read"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              }
              onClick={() => {
                setPage(1);
                setReadFilter("read");
              }}
            >
              อ่านแล้ว
            </Button>
            <Button
              type="button"
              className={
                readFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              }
              onClick={() => {
                setPage(1);
                setReadFilter("all");
              }}
            >
              ทั้งหมด
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">
            กำลังโหลดการแจ้งเตือน...
          </p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.isRead
                    ? "border-slate-200 bg-slate-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.requestId ? (
                      <Link
                        href={`/my-requests/${item.requestId}`}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
                      >
                        ดูคำขอ
                      </Link>
                    ) : null}

                    {!item.isRead ? (
                      <Button
                        type="button"
                        onClick={() => void handleMarkOneRead(item.id)}
                        className="bg-slate-900 text-xs text-white hover:bg-slate-700"
                      >
                        อ่านแล้ว
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            หน้า {page} / {totalPages} ({total} รายการ)
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              ก่อนหน้า
            </Button>
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}
    </main>
  );
}
