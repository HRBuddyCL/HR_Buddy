"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  getMyRequests,
  type MyRequestItem,
  type Urgency,
  type RequestStatus,
  type RequestType,
} from "@/lib/api/my-requests";
import { clearAuthToken } from "@/lib/auth/tokens";

const requestTypeOptions: Array<{ value: RequestType; label: string }> = [
  { value: "BUILDING", label: "อาคาร" },
  { value: "VEHICLE", label: "รถยนต์" },
  { value: "MESSENGER", label: "ส่งเอกสาร" },
  { value: "DOCUMENT", label: "เอกสาร" },
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

const statusColorClass: Record<RequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-800",
  APPROVED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DONE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELED: "bg-slate-200 text-slate-800",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatIsoToDateInputValue(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInputToThaiBuddhist(dateInput: string) {
  if (!dateInput) {
    return "";
  }

  const [yearText, monthText, dayText] = dateInput.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return "";
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year + 543}`;
}

const urgencyLabelMap: Record<Urgency, string> = {
  NORMAL: "ปกติ",
  HIGH: "สูง",
  CRITICAL: "เร่งด่วน",
};

type RequestViewMode = "in-progress" | "completed" | "all";

type CompletedStatus = "DONE" | "REJECTED" | "CANCELED";

const COMPLETED_STATUSES: CompletedStatus[] = ["DONE", "REJECTED", "CANCELED"];
const IN_PROGRESS_STATUSES: RequestStatus[] = [
  "NEW",
  "APPROVED",
  "IN_PROGRESS",
  "IN_TRANSIT",
];

const completedGroupLabels: Record<CompletedStatus, string> = {
  DONE: "เสร็จสิ้น",
  REJECTED: "ถูกปฏิเสธ",
  CANCELED: "ยกเลิก",
};

export default function Page() {
  return (
    <RouteGuard tokenType="employee" redirectTo="/auth/otp">
      <MyRequestsContent />
    </RouteGuard>
  );
}

function MyRequestsContent() {
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<MyRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | RequestType>("");
  const [status, setStatus] = useState<"" | RequestStatus>("");
  const [selectedDate, setSelectedDate] = useState("");
  const [viewMode, setViewMode] = useState<RequestViewMode>("in-progress");
  const effectiveStatus = viewMode === "all" ? status : "";

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const requestsResult = await getMyRequests({
          page,
          limit,
          q: search.trim() || undefined,
          type: type || undefined,
          status: effectiveStatus || undefined,
          sortBy: "latestActivityAt",
          sortOrder: "desc",
        });

        if (!active) {
          return;
        }

        setItems(requestsResult.items);
        setTotal(requestsResult.total);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load my requests");
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
  }, [effectiveStatus, limit, page, search, type]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filteredItems = useMemo(() => {
    if (!selectedDate) {
      return items;
    }

    return items.filter(
      (item) => formatIsoToDateInputValue(item.createdAt) === selectedDate,
    );
  }, [items, selectedDate]);

  const inProgressItems = useMemo(
    () =>
      filteredItems.filter((item) =>
        IN_PROGRESS_STATUSES.includes(item.status),
      ),
    [filteredItems],
  );

  const completedGroups = useMemo<Record<CompletedStatus, MyRequestItem[]>>(
    () => ({
      DONE: filteredItems.filter((item) => item.status === "DONE"),
      REJECTED: filteredItems.filter((item) => item.status === "REJECTED"),
      CANCELED: filteredItems.filter((item) => item.status === "CANCELED"),
    }),
    [filteredItems],
  );

  const completedTotalCount =
    completedGroups.DONE.length +
    completedGroups.REJECTED.length +
    completedGroups.CANCELED.length;

  const renderRequestCard = (item: MyRequestItem) => (
    <article
      key={item.id}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.type}
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            {item.requestNo}
          </h3>
          <p className="text-sm text-slate-700">
            กิจกรรมล่าสุด: {formatDateTime(item.latestActivityAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorClass[item.status]}`}
        >
          {item.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          ความเร่งด่วน: {urgencyLabelMap[item.urgency]}
        </p>
        <Link
          href={`/my-requests/${item.id}`}
          className="text-sm font-medium text-slate-900 underline underline-offset-4"
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );

  const handleLogout = () => {
    clearAuthToken("employee");
    void fetch("/api/auth/employee/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    }).finally(() => {
      window.location.href = "/auth/otp";
    });
  };

  const handleOpenDatePicker = () => {
    const picker = datePickerRef.current;
    if (!picker) {
      return;
    }

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.focus();
    picker.click();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              คำขอของฉัน
            </h1>
            <p className="mt-2 text-slate-700">
              ติดตามคำขอทั้งหมดของคุณที่นี่ คุณสามารถดูสถานะ ค้นหา
              และจัดการคำขอของคุณได้อย่างง่ายดาย
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={handleLogout}
            >
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          className={`grid gap-4 ${viewMode === "all" ? "md:grid-cols-5" : "md:grid-cols-4"}`}
        >
          <TextField
            id="q"
            label="ค้นหา"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="หมายเลขคำขอหรือชื่อ"
          />

          <SelectField
            id="type"
            label="ประเภท"
            value={type}
            onChange={(event) => {
              setPage(1);
              setType(event.target.value as "" | RequestType);
            }}
          >
            <option value="">ทั้งหมด</option>
            {requestTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <div className="space-y-2">
            <label
              htmlFor="requestDatePicker"
              className="block text-sm font-medium text-slate-800"
            >
              วันที่สร้างคำขอ
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={handleOpenDatePicker}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-left text-sm text-slate-900 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {formatDateInputToThaiBuddhist(selectedDate) || "วว/ดด/ปปปป"}
              </button>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
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
                    d="M8 7V3m8 4V3m-9 8h10m2 10H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              <input
                ref={datePickerRef}
                id="requestDatePicker"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setPage(1);
                  setSelectedDate(event.target.value);
                }}
                aria-label="เลือกวันที่สร้างคำขอ"
                className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
              />
            </div>
          </div>

          {viewMode === "all" ? (
            <SelectField
              id="status"
              label="สถานะ"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as "" | RequestStatus);
              }}
            >
              <option value="">ทั้งหมด</option>
              {requestStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          ) : null}

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() => {
                setSearch("");
                setType("");
                setStatus("");
                setSelectedDate("");
                setPage(1);
              }}
            >
              รีเซ็ตตัวกรอง
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className={
              viewMode === "in-progress"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            }
            onClick={() => setViewMode("in-progress")}
          >
            ยังดำเนินการไม่เสร็จ ({inProgressItems.length})
          </Button>
          <Button
            type="button"
            className={
              viewMode === "completed"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            }
            onClick={() => setViewMode("completed")}
          >
            เสร็จสิ้นแล้ว ({completedTotalCount})
          </Button>
          <Button
            type="button"
            className={
              viewMode === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            }
            onClick={() => setViewMode("all")}
          >
            ทั้งหมด ({filteredItems.length})
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">กำลังโหลดคำขอ...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-slate-600">ไม่พบคำขอ</p>
        ) : (
          <>
            {viewMode === "in-progress" ? (
              inProgressItems.length === 0 ? (
                <p className="text-sm text-slate-600">
                  ไม่มีคำขอที่ยังดำเนินการไม่เสร็จ
                </p>
              ) : (
                <div className="space-y-3">
                  {inProgressItems.map(renderRequestCard)}
                </div>
              )
            ) : null}

            {viewMode === "completed" ? (
              completedTotalCount === 0 ? (
                <p className="text-sm text-slate-600">
                  ไม่มีคำขอที่เสร็จสิ้นแล้ว
                </p>
              ) : (
                <div className="space-y-5">
                  {COMPLETED_STATUSES.map((groupStatus) => {
                    const groupItems = completedGroups[groupStatus];

                    if (groupItems.length === 0) {
                      return null;
                    }

                    return (
                      <div key={groupStatus} className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-800">
                          {completedGroupLabels[groupStatus]} (
                          {groupItems.length})
                        </h3>
                        <div className="space-y-3">
                          {groupItems.map(renderRequestCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}

            {viewMode === "all" ? (
              <div className="space-y-3">
                {filteredItems.map(renderRequestCard)}
              </div>
            ) : null}
          </>
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
