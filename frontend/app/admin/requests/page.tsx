"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { ApiError } from "@/lib/api/client";
import { formatPhoneDisplay } from "@/lib/phone-format";
import {
  listAdminDepartments,
  type AdminDepartment,
} from "@/lib/api/admin-settings";
import {
  downloadAdminRequestsXlsx,
  getAdminRequests,
  type AdminRequestListItem,
  type AdminRequestStatus,
  type AdminRequestType,
  type AdminUrgency,
} from "@/lib/api/admin-requests";

const typeOptions: Array<{ value: AdminRequestType; label: string }> = [
  { value: "BUILDING", label: "ซ่อมอาคาร" },
  { value: "VEHICLE", label: "ซ่อมรถ" },
  { value: "MESSENGER", label: "ขนส่ง" },
  { value: "DOCUMENT", label: "เอกสาร" },
];

const statusOptions: Array<{ value: AdminRequestStatus; label: string }> = [
  { value: "NEW", label: "ใหม่" },
  { value: "APPROVED", label: "อนุมัติ" },
  { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
  { value: "IN_TRANSIT", label: "กำลังขนส่ง" },
  { value: "DONE", label: "เสร็จสิ้น" },
  { value: "REJECTED", label: "ไม่อนุมัติ" },
  { value: "CANCELED", label: "ยกเลิก" },
];

const urgencyOptions: Array<{ value: AdminUrgency; label: string }> = [
  { value: "NORMAL", label: "ปกติ" },
  { value: "HIGH", label: "สูง" },
  { value: "CRITICAL", label: "เร่งด่วน" },
];

const typeLabelMap: Record<AdminRequestType, string> = {
  BUILDING: "ซ่อมอาคาร",
  VEHICLE: "ซ่อมรถ",
  MESSENGER: "ขนส่ง",
  DOCUMENT: "เอกสาร",
};

// --- ไอคอนแต่ละประเภทคำขอ ---
const typeIconMap: Record<AdminRequestType, string> = {
  BUILDING:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  VEHICLE:
    "M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6",
  MESSENGER: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  DOCUMENT:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

// --- สีแต่ละประเภทคำขอ ---
const typeBadgeMap: Record<
  AdminRequestType,
  { bg: string; text: string; icon: string }
> = {
  BUILDING: {
    bg: "bg-blue-50",
    text: "text-[#0e2d4c]",
    icon: "text-[#0e2d4c]/70",
  },
  VEHICLE: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    icon: "text-amber-600",
  },
  MESSENGER: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    icon: "text-purple-600",
  },
  DOCUMENT: {
    bg: "bg-teal-50",
    text: "text-teal-800",
    icon: "text-teal-600",
  },
};

const statusLabelMap: Record<AdminRequestStatus, string> = {
  NEW: "ใหม่",
  APPROVED: "อนุมัติ",
  IN_PROGRESS: "กำลังดำเนินการ",
  IN_TRANSIT: "กำลังขนส่ง",
  DONE: "เสร็จสิ้น",
  REJECTED: "ไม่อนุมัติ",
  CANCELED: "ยกเลิก",
};

const statusColorClass: Record<
  AdminRequestStatus,
  { dot: string; badge: string }
> = {
  NEW: {
    dot: "bg-sky-400",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  },
  APPROVED: {
    dot: "bg-indigo-400",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  },
  IN_PROGRESS: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  IN_TRANSIT: {
    dot: "bg-orange-400",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  },
  DONE: {
    dot: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  REJECTED: {
    dot: "bg-[#b62026]",
    badge: "bg-rose-50 text-[#b62026] ring-1 ring-rose-200",
  },
  CANCELED: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  },
};

const urgencyConfig: Record<
  AdminUrgency,
  { label: string; color: string; icon: string }
> = {
  NORMAL: {
    label: "ปกติ",
    color: "text-slate-500",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  HIGH: {
    label: "สูง",
    color: "text-amber-600",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  CRITICAL: {
    label: "เร่งด่วน",
    color: "text-[#b62026]",
    icon: "M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatThaiDateInputValue(isoDate: string) {
  if (!isoDate) return "";
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year + 543}`;
}

function parseThaiDateInputToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const thaiDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!thaiDateMatch) return null;
  const day = Number(thaiDateMatch[1]);
  const month = Number(thaiDateMatch[2]);
  let year = Number(thaiDateMatch[3]);
  if (year >= 2400) year -= 543;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function openNativeDatePicker(
  pickerRef: { current: HTMLInputElement | null },
  isoDate: string,
) {
  const picker = pickerRef.current;
  if (!picker) return;
  picker.value = isoDate || "";
  if (typeof picker.showPicker === "function") {
    picker.showPicker();
    return;
  }
  picker.focus();
  picker.click();
}

// --- Sub-component: DateRangeField ---
function DateRangeField({
  fromId,
  toId,
  fromLabel,
  toLabel,
  fromInput,
  toInput,
  onFromChange,
  onToChange,
  onFromBlur,
  onToBlur,
  fromIso,
  toIso,
  fromPickerRef,
  toPickerRef,
  onFromPickerChange,
  onToPickerChange,
}: {
  fromId: string;
  toId: string;
  fromLabel: string;
  toLabel: string;
  fromInput: string;
  toInput: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onFromBlur: () => void;
  onToBlur: () => void;
  fromIso: string;
  toIso: string;
  fromPickerRef: React.RefObject<HTMLInputElement | null>;
  toPickerRef: React.RefObject<HTMLInputElement | null>;
  onFromPickerChange: (iso: string) => void;
  onToPickerChange: (iso: string) => void;
}) {
  const calendarIcon = (
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
        d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
      />
    </svg>
  );

  return (
    <div className="space-y-3">
      {/* From */}
      <div className="space-y-1.5">
        <label
          htmlFor={fromId}
          className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
        >
          {fromLabel}
        </label>
        <div className="relative">
          <input
            id={fromId}
            type="text"
            inputMode="numeric"
            placeholder="วว/ดด/ปปปป"
            value={fromInput}
            onChange={(e) => onFromChange(e.target.value)}
            onBlur={onFromBlur}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
          />
          <button
            type="button"
            onClick={() => openNativeDatePicker(fromPickerRef, fromIso)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#0e2d4c]/40 transition hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c]"
            aria-label={`เลือก${fromLabel}`}
          >
            {calendarIcon}
          </button>
          <input
            ref={fromPickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            value={fromIso}
            onChange={(e) => onFromPickerChange(e.target.value)}
          />
        </div>
      </div>

      {/* To */}
      <div className="space-y-1.5">
        <label
          htmlFor={toId}
          className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
        >
          {toLabel}
        </label>
        <div className="relative">
          <input
            id={toId}
            type="text"
            inputMode="numeric"
            placeholder="วว/ดด/ปปปป"
            value={toInput}
            onChange={(e) => onToChange(e.target.value)}
            onBlur={onToBlur}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
          />
          <button
            type="button"
            onClick={() => openNativeDatePicker(toPickerRef, toIso)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#0e2d4c]/40 transition hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c]"
            aria-label={`เลือก${toLabel}`}
          >
            {calendarIcon}
          </button>
          <input
            ref={toPickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            value={toIso}
            onChange={(e) => onToPickerChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminRequestsPageContent />
    </RouteGuard>
  );
}

function AdminRequestsPageContent() {
  const [items, setItems] = useState<AdminRequestListItem[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | AdminRequestType>("");
  const [status, setStatus] = useState<"" | AdminRequestStatus>("");
  const [urgency, setUrgency] = useState<"" | AdminUrgency>("");
  const [departmentId, setDepartmentId] = useState("");
  const [createdDateFrom, setCreatedDateFrom] = useState("");
  const [createdDateTo, setCreatedDateTo] = useState("");
  const [closedDateFrom, setClosedDateFrom] = useState("");
  const [closedDateTo, setClosedDateTo] = useState("");
  const [createdDateFromInput, setCreatedDateFromInput] = useState("");
  const [createdDateToInput, setCreatedDateToInput] = useState("");
  const [closedDateFromInput, setClosedDateFromInput] = useState("");
  const [closedDateToInput, setClosedDateToInput] = useState("");

  const createdDateFromPickerRef = useRef<HTMLInputElement | null>(null);
  const createdDateToPickerRef = useRef<HTMLInputElement | null>(null);
  const closedDateFromPickerRef = useRef<HTMLInputElement | null>(null);
  const closedDateToPickerRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Count active filters ---
  const activeFilterCount = [
    query.trim(),
    type,
    status,
    urgency,
    departmentId,
    createdDateFrom,
    createdDateTo,
    closedDateFrom,
    closedDateTo,
  ].filter(Boolean).length;

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const result = await listAdminDepartments({ isActive: true });
        if (active) {
          setDepartments(result.items);
        }
      } catch {
        // keep page usable even if department lookup fails
      }
    }

    void loadDepartments();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await getAdminRequests({
          page,
          limit,
          q: query.trim() || undefined,
          type: type || undefined,
          status: status || undefined,
          urgency: urgency || undefined,
          departmentId: departmentId || undefined,
          createdDateFrom: createdDateFrom || undefined,
          createdDateTo: createdDateTo || undefined,
          closedDateFrom: closedDateFrom || undefined,
          closedDateTo: closedDateTo || undefined,
        });
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดรายการคำขอได้");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [
    closedDateFrom,
    closedDateTo,
    createdDateFrom,
    createdDateTo,
    departmentId,
    limit,
    page,
    query,
    status,
    type,
    urgency,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [limit, total],
  );

  const handleClearFilters = () => {
    setQuery("");
    setType("");
    setStatus("");
    setUrgency("");
    setDepartmentId("");
    setCreatedDateFrom("");
    setCreatedDateTo("");
    setClosedDateFrom("");
    setClosedDateTo("");
    setCreatedDateFromInput("");
    setCreatedDateToInput("");
    setClosedDateFromInput("");
    setClosedDateToInput("");
    setPage(1);
  };

  const handleExportXlsx = async () => {
    setExporting(true);
    setErrorMessage(null);
    try {
      const result = await downloadAdminRequestsXlsx({
        q: query.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
        urgency: urgency || undefined,
        departmentId: departmentId || undefined,
        createdDateFrom: createdDateFrom || undefined,
        createdDateTo: createdDateTo || undefined,
        closedDateFrom: closedDateFrom || undefined,
        closedDateTo: closedDateTo || undefined,
        limit: 1000,
      });
      const xlsxPayload = Uint8Array.from(result.xlsxBytes);
      const blob = new Blob([xlsxPayload], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถส่งออกไฟล์ xlsx ได้");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 bg-slate-50/80 px-4 py-6 md:px-6 lg:px-8">
      {/* ===== HEADER ===== */}
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
              {
                "\u0e15\u0e32\u0e23\u0e32\u0e07\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e04\u0e33\u0e02\u0e2d\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e23\u0e30\u0e1a\u0e1a"
              }
            </h1>
            <p className="mt-1 text-sm text-white/65">
              {
                "\u0e04\u0e49\u0e19\u0e2b\u0e32 \u0e01\u0e23\u0e2d\u0e07 \u0e41\u0e25\u0e30\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e04\u0e34\u0e27\u0e04\u0e33\u0e02\u0e2d\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e43\u0e19\u0e23\u0e30\u0e1a\u0e1a"
              }
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/30 bg-gradient-to-r from-white/20 via-white/15 to-white/10 px-4 py-2.5 shadow-[0_12px_24px_-16px_rgba(2,6,23,0.9)] backdrop-blur-sm">
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#fed54f] px-1.5 text-[11px] font-extrabold text-[#0e2d4c] shadow-[0_6px_16px_-8px_rgba(254,213,79,1)]">
                {loading
                  ? "-"
                  : total > 99
                    ? "99+"
                    : total.toLocaleString("th-TH")}
              </span>
              <span className="text-sm font-semibold tracking-wide text-white/95">
                {
                  "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e04\u0e33\u0e02\u0e2d\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14"
                }
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {
                    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e48\u0e07\u0e2d\u0e2d\u0e01..."
                  }
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {"\u0e2a\u0e48\u0e07\u0e2d\u0e2d\u0e01 Excel"}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ===== ERROR BANNER ===== */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/20 bg-[#b62026]/5 px-4 py-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-[#b62026]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-sm font-medium text-[#b62026]">{errorMessage}</p>
        </div>
      )}

      {/* ===== FILTER PANEL ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e2d4c]/8">
              <svg
                className="h-4 w-4 text-[#0e2d4c]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-[#0e2d4c]">ตัวกรองค้นหา</h2>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#b62026] px-2 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#b62026] transition hover:bg-[#b62026]/8"
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
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              ล้างทั้งหมด
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Row 1: Search + Type + Status */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {/* Search */}
            <div className="space-y-1.5">
              <label
                htmlFor="q"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
              >
                ค้นหา
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  id="q"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setPage(1);
                    setQuery(e.target.value);
                  }}
                  placeholder="เลขคำขอ / ชื่อพนักงาน / เบอร์โทร"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
                />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label
                htmlFor="type"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
              >
                ประเภทคำขอ
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => {
                  setPage(1);
                  setType(e.target.value as "" | AdminRequestType);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
              >
                <option value="">ทุกประเภท</option>
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label
                htmlFor="status"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
              >
                สถานะ
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as "" | AdminRequestStatus);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
              >
                <option value="">ทุกสถานะ</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label
                htmlFor="departmentId"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
              >
                แผนก
              </label>
              <select
                id="departmentId"
                value={departmentId}
                onChange={(e) => {
                  setPage(1);
                  setDepartmentId(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
              >
                <option value="">ทุกแผนก</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency */}
            <div className="space-y-1.5">
              <label
                htmlFor="urgency"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
              >
                ระดับความเร่งด่วน
              </label>
              <select
                id="urgency"
                value={urgency}
                onChange={(e) => {
                  setPage(1);
                  setUrgency(e.target.value as "" | AdminUrgency);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
              >
                <option value="">ทุกระดับ</option>
                {urgencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date ranges */}
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {/* วันที่สร้าง */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#0e2d4c]" />
                <p className="text-xs font-bold uppercase tracking-wide text-[#0e2d4c]">
                  ช่วงวันที่สร้างคำขอ
                </p>
              </div>
              <DateRangeField
                fromId="createdDateFrom"
                toId="createdDateTo"
                fromLabel="เริ่มต้น"
                toLabel="สิ้นสุด"
                fromInput={createdDateFromInput}
                toInput={createdDateToInput}
                fromIso={createdDateFrom}
                toIso={createdDateTo}
                fromPickerRef={createdDateFromPickerRef}
                toPickerRef={createdDateToPickerRef}
                onFromChange={(v) => {
                  setCreatedDateFromInput(v);
                  const parsed = parseThaiDateInputToIso(v);
                  if (parsed !== null) {
                    setPage(1);
                    setCreatedDateFrom(parsed);
                  }
                }}
                onToChange={(v) => {
                  setCreatedDateToInput(v);
                  const parsed = parseThaiDateInputToIso(v);
                  if (parsed !== null) {
                    setPage(1);
                    setCreatedDateTo(parsed);
                  }
                }}
                onFromBlur={() =>
                  setCreatedDateFromInput(
                    formatThaiDateInputValue(createdDateFrom),
                  )
                }
                onToBlur={() =>
                  setCreatedDateToInput(formatThaiDateInputValue(createdDateTo))
                }
                onFromPickerChange={(iso) => {
                  setPage(1);
                  setCreatedDateFrom(iso);
                  setCreatedDateFromInput(formatThaiDateInputValue(iso));
                }}
                onToPickerChange={(iso) => {
                  setPage(1);
                  setCreatedDateTo(iso);
                  setCreatedDateToInput(formatThaiDateInputValue(iso));
                }}
              />
            </div>

            {/* วันที่ปิด */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#b62026]" />
                <p className="text-xs font-bold uppercase tracking-wide text-[#0e2d4c]">
                  ช่วงวันที่ปิดคำขอ
                </p>
              </div>
              <DateRangeField
                fromId="closedDateFrom"
                toId="closedDateTo"
                fromLabel="เริ่มต้น"
                toLabel="สิ้นสุด"
                fromInput={closedDateFromInput}
                toInput={closedDateToInput}
                fromIso={closedDateFrom}
                toIso={closedDateTo}
                fromPickerRef={closedDateFromPickerRef}
                toPickerRef={closedDateToPickerRef}
                onFromChange={(v) => {
                  setClosedDateFromInput(v);
                  const parsed = parseThaiDateInputToIso(v);
                  if (parsed !== null) {
                    setPage(1);
                    setClosedDateFrom(parsed);
                  }
                }}
                onToChange={(v) => {
                  setClosedDateToInput(v);
                  const parsed = parseThaiDateInputToIso(v);
                  if (parsed !== null) {
                    setPage(1);
                    setClosedDateTo(parsed);
                  }
                }}
                onFromBlur={() =>
                  setClosedDateFromInput(
                    formatThaiDateInputValue(closedDateFrom),
                  )
                }
                onToBlur={() =>
                  setClosedDateToInput(formatThaiDateInputValue(closedDateTo))
                }
                onFromPickerChange={(iso) => {
                  setPage(1);
                  setClosedDateFrom(iso);
                  setClosedDateFromInput(formatThaiDateInputValue(iso));
                }}
                onToPickerChange={(iso) => {
                  setPage(1);
                  setClosedDateTo(iso);
                  setClosedDateToInput(formatThaiDateInputValue(iso));
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== TABLE SECTION ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Table header bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e2d4c]/8">
              <svg
                className="h-4 w-4 text-[#0e2d4c]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-[#0e2d4c]">รายการคำขอ</h2>
          </div>

          {!loading && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {items.length} / {total} รายการ
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-[#0e2d4c] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              กำลังโหลดข้อมูล...
            </p>
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg
                className="h-8 w-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                ไม่พบรายการคำขอ
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ลองปรับเงื่อนไขการค้นหาหรือ ล้างตัวกรอง
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    เลขคำขอ
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    ประเภท
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    พนักงาน
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    ความเร่งด่วน
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    สถานะ
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    กิจกรรมล่าสุด
                  </th>
                  <th className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50">
                    การทำงาน
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const typeStyle = typeBadgeMap[item.type];
                  const statusStyle = statusColorClass[item.status];
                  const urgency = urgencyConfig[item.urgency];

                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors duration-150 hover:bg-[#0e2d4c]/[0.02]"
                    >
                      {/* เลขคำขอ */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#0e2d4c]/10 bg-[#0e2d4c]/5 px-2.5 py-1 font-mono text-xs font-bold text-[#0e2d4c]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#fed54f]" />
                          {item.requestNo}
                        </span>
                      </td>

                      {/* ประเภท */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          <svg
                            className={`h-3.5 w-3.5 ${typeStyle.icon}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={typeIconMap[item.type]}
                            />
                          </svg>
                          {typeLabelMap[item.type]}
                        </span>
                      </td>

                      {/* พนักงาน */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-xs font-bold text-[#fed54f]">
                            {item.employeeName?.charAt(0) ?? "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0e2d4c]">
                              {item.employeeName}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
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
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {formatPhoneDisplay(item.phone)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ความเร่งด่วน */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${urgency.color}`}
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
                              d={urgency.icon}
                            />
                          </svg>
                          {urgency.label}
                        </span>
                      </td>

                      {/* สถานะ */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.badge}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
                          />
                          {statusLabelMap[item.status]}
                        </span>
                      </td>

                      {/* กิจกรรมล่าสุด */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <svg
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
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
                      </td>

                      {/* การทำงาน */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <Link
                          href={`/admin/requests/${item.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#0e2d4c]/15 bg-[#0e2d4c]/5 px-3 py-1.5 text-xs font-semibold text-[#0e2d4c] transition-all hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white hover:shadow-md hover:shadow-[#0e2d4c]/20"
                        >
                          ดูรายละเอียด
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== PAGINATION ===== */}
        {!loading && items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            {/* Page info */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <span>
                หน้า <span className="font-bold text-[#0e2d4c]">{page}</span>{" "}
                จาก{" "}
                <span className="font-bold text-[#0e2d4c]">{totalPages}</span>{" "}
                <span className="text-slate-400">
                  (ทั้งหมด {total.toLocaleString("th-TH")} รายการ)
                </span>
              </span>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-2">
              {/* First page */}
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500"
                aria-label="หน้าแรก"
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
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Previous */}
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                ก่อนหน้า
              </button>

              {/* Page number pills */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 5) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - page) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0) {
                      const prev = arr[idx - 1];
                      if (typeof prev === "number" && p - prev > 1) {
                        acc.push("...");
                      }
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1 text-xs text-slate-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                          page === p
                            ? "bg-[#0e2d4c] text-white shadow-md shadow-[#0e2d4c]/25"
                            : "border border-slate-200 bg-white text-slate-600 hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/5"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
              </div>

              {/* Next */}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600"
              >
                ถัดไป
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
              </button>

              {/* Last page */}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500"
                aria-label="หน้าสุดท้าย"
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
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
