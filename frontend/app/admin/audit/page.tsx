"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  downloadAdminAuditXlsx,
  getAdminAuditLogs,
  type AdminUrgency,
  type AdminRequestStatus,
  type AdminRequestType,
  type AdminAuditLogItem,
  type AuditAction,
  type AuditActorRole,
} from "@/lib/api/admin-audit";
import {
  listAdminDepartments,
  listAdminOperators,
  type AdminDepartment,
  type AdminOperator,
} from "@/lib/api/admin-settings";

const SEARCH_DEBOUNCE_MS = 400;

const actionOptions: AuditAction[] = [
  "CREATE",
  "APPROVE",
  "REJECT",
  "STATUS_CHANGE",
  "CANCEL",
  "UPLOAD_ATTACHMENT",
  "REPORT_PROBLEM",
  "MESSENGER_PICKUP_EVENT",
];

const actorRoleOptions: AuditActorRole[] = ["EMPLOYEE", "ADMIN", "MESSENGER"];
const requestTypeOptions: Array<{ value: AdminRequestType; label: string }> = [
  { value: "BUILDING", label: "ซ่อมอาคาร" },
  { value: "VEHICLE", label: "ซ่อมรถ" },
  { value: "MESSENGER", label: "ขนส่ง" },
  { value: "DOCUMENT", label: "เอกสาร" },
];

const requestStatusOptions: Array<{
  value: AdminRequestStatus;
  label: string;
}> = [
  { value: "NEW", label: "ใหม่" },
  { value: "APPROVED", label: "อนุมัติ" },
  { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
  { value: "IN_TRANSIT", label: "กำลังขนส่ง" },
  { value: "DONE", label: "เสร็จสิ้น" },
  { value: "REJECTED", label: "ไม่อนุมัติ" },
  { value: "CANCELED", label: "ยกเลิก" },
];
const requestUrgencyOptions: Array<{ value: AdminUrgency; label: string }> = [
  { value: "NORMAL", label: "ปกติ" },
  { value: "HIGH", label: "สูง" },
  { value: "CRITICAL", label: "เร่งด่วน" },
];

const actionLabelMap: Record<AuditAction, string> = {
  CREATE: "สร้างคำขอ",
  APPROVE: "อนุมัติ",
  REJECT: "ไม่อนุมัติ",
  STATUS_CHANGE: "เปลี่ยนสถานะ",
  CANCEL: "ยกเลิกคำขอ",
  UPLOAD_ATTACHMENT: "อัปโหลดไฟล์",
  REPORT_PROBLEM: "รายงานปัญหา",
  MESSENGER_PICKUP_EVENT: "อัปเดตงานขนส่ง",
};

const actorRoleLabelMap: Record<AuditActorRole, string> = {
  EMPLOYEE: "พนักงาน",
  ADMIN: "ผู้ดูแล",
  MESSENGER: "แมสเซนเจอร์",
};

const requestTypeLabelMap: Record<AdminRequestType, string> = {
  BUILDING: "ซ่อมอาคาร",
  VEHICLE: "ซ่อมรถ",
  MESSENGER: "ขนส่ง",
  DOCUMENT: "เอกสาร",
};

const requestStatusLabelMap: Record<AdminRequestStatus, string> = {
  NEW: "ใหม่",
  APPROVED: "อนุมัติ",
  IN_PROGRESS: "กำลังดำเนินการ",
  IN_TRANSIT: "กำลังขนส่ง",
  DONE: "เสร็จสิ้น",
  REJECTED: "ไม่อนุมัติ",
  CANCELED: "ยกเลิก",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function getUrgencyBadge(urgency: string | null | undefined) {
  if (urgency === "CRITICAL") {
    return {
      label: "เร่งด่วน",
      className: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/20",
      dot: "bg-[#b62026]",
    };
  }
  if (urgency === "HIGH") {
    return {
      label: "สูง",
      className: "bg-[#fed54f]/30 text-[#7a5e00] ring-1 ring-[#fed54f]/60",
      dot: "bg-[#fed54f]",
    };
  }
  return {
    label: "ปกติ",
    className: "bg-[#0e2d4c]/8 text-[#0e2d4c]/70 ring-1 ring-[#0e2d4c]/15",
    dot: "bg-[#0e2d4c]/40",
  };
}

function getActionBadge(action: AuditAction) {
  // Keep badges aligned with brand palette for internal readability/consistency.
  const map: Partial<Record<AuditAction, string>> = {
    CREATE: "bg-[#0e2d4c]/10 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/20",
    APPROVE: "bg-[#fed54f]/30 text-[#0e2d4c] ring-1 ring-[#fed54f]/70",
    REJECT: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/20",
    STATUS_CHANGE: "bg-[#0e2d4c]/10 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/20",
    CANCEL: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/20",
    UPLOAD_ATTACHMENT: "bg-[#fed54f]/25 text-[#0e2d4c] ring-1 ring-[#fed54f]/60",
    REPORT_PROBLEM: "bg-[#fed54f]/30 text-[#7a5e00] ring-1 ring-[#fed54f]/60",
    MESSENGER_PICKUP_EVENT:
      "bg-[#0e2d4c]/10 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/20",
  };
  return (
    map[action] ?? "bg-[#0e2d4c]/10 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/20"
  );
}

function getSourceLabel(item: AdminAuditLogItem) {
  if (item.actorRole === "MESSENGER") return "Magic Link";
  if (item.actorRole === "ADMIN") return "แผงผู้ดูแล";
  return "พอร์ทัลพนักงาน";
}

function getOutcomeLabel(item: AdminAuditLogItem) {
  if (item.action === "REJECT") return "ไม่อนุมัติ";
  if (item.action === "CANCEL") return "ยกเลิก";
  return "สำเร็จ";
}

function getActorPrimaryName(item: AdminAuditLogItem) {
  if (item.actorRole === "ADMIN" && item.operatorName?.trim()) {
    return item.operatorName.trim();
  }
  return item.actorLabel;
}

function getActorSecondaryLine(item: AdminAuditLogItem) {
  const roleLabel = actorRoleLabelMap[item.actorRole] ?? item.actorRole;
  if (item.actorRole === "ADMIN" || item.actorRole === "MESSENGER") {
    return roleLabel;
  }
  return item.departmentName ? `${roleLabel} · ${item.departmentName}` : roleLabel;
}

function getChangeSummary(item: AdminAuditLogItem) {
  const fromLabel = item.fromStatus
    ? (requestStatusLabelMap[item.fromStatus as AdminRequestStatus] ??
      item.fromStatus)
    : null;
  const toLabel = item.toStatus
    ? (requestStatusLabelMap[item.toStatus as AdminRequestStatus] ??
      item.toStatus)
    : null;

  if (fromLabel || toLabel) {
    return `${fromLabel ?? "-"} → ${toLabel ?? "-"}`;
  }
  if (item.note?.trim()) return item.note.trim();
  return "-";
}

function validateDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด";
  }
  return null;
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
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

// ─── Reusable field components ──────────────────────────────────────────────

function FilterLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0e2d4c]/55"
    >
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#0e2d4c]/15 bg-white/80 px-3 py-2.5 text-sm text-[#0e2d4c] placeholder-[#0e2d4c]/35 shadow-[0_1px_3px_rgba(14,45,76,0.06)] outline-none transition focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10 hover:border-[#0e2d4c]/25";

const selectClass =
  "w-full rounded-xl border border-[#0e2d4c]/15 bg-white/80 px-3 py-2.5 text-sm text-[#0e2d4c] shadow-[0_1px_3px_rgba(14,45,76,0.06)] outline-none transition focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10 hover:border-[#0e2d4c]/25 appearance-none cursor-pointer";

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0e2d4c]/40">
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
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

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
  fromPickerRef: { current: HTMLInputElement | null };
  toPickerRef: { current: HTMLInputElement | null };
  onFromPickerChange: (iso: string) => void;
  onToPickerChange: (iso: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <FilterLabel htmlFor={fromId}>{fromLabel}</FilterLabel>
        <div className="relative">
          <input
            id={fromId}
            type="text"
            inputMode="numeric"
            placeholder="วัน/เดือน/ปี พ.ศ."
            value={fromInput}
            onChange={(e) => onFromChange(e.target.value)}
            onBlur={onFromBlur}
            className={inputClass + " pr-10"}
          />
          <button
            type="button"
            onClick={() => openNativeDatePicker(fromPickerRef, fromIso)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#0e2d4c]/40 transition hover:text-[#0e2d4c]"
            aria-label={`เลือก${fromLabel}`}
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
                d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
              />
            </svg>
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

      <div>
        <FilterLabel htmlFor={toId}>{toLabel}</FilterLabel>
        <div className="relative">
          <input
            id={toId}
            type="text"
            inputMode="numeric"
            placeholder="วัน/เดือน/ปี พ.ศ."
            value={toInput}
            onChange={(e) => onToChange(e.target.value)}
            onBlur={onToBlur}
            className={inputClass + " pr-10"}
          />
          <button
            type="button"
            onClick={() => openNativeDatePicker(toPickerRef, toIso)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#0e2d4c]/40 transition hover:text-[#0e2d4c]"
            aria-label={`เลือก${toLabel}`}
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
                d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z"
              />
            </svg>
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

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    IN_PROGRESS: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    IN_TRANSIT: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200",
    DONE: "bg-[#0e2d4c]/8 text-[#0e2d4c] ring-1 ring-[#0e2d4c]/15",
    REJECTED: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/20",
    CANCELED: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-slate-50 text-slate-600"}`}
    >
      {requestStatusLabelMap[status as AdminRequestStatus] ?? status}
    </span>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminAuditContent />
    </RouteGuard>
  );
}

function AdminAuditContent() {
  const [items, setItems] = useState<AdminAuditLogItem[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [requestNo, setRequestNo] = useState("");
  const [requestType, setRequestType] = useState<"" | AdminRequestType>("");
  const [requestStatus, setRequestStatus] = useState<"" | AdminRequestStatus>(
    "",
  );
  const [requestUrgency, setRequestUrgency] = useState<"" | AdminUrgency>("");
  const [action, setAction] = useState<"" | AuditAction>("");
  const [actorRole, setActorRole] = useState<"" | AuditActorRole>("");
  const [departmentId, setDepartmentId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");

  const dateFromPickerRef = useRef<HTMLInputElement | null>(null);
  const dateToPickerRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AdminAuditLogItem | null>(
    null,
  );

  // Active filter count
  const activeFilterCount = [
    q,
    requestType,
    requestStatus,
    requestUrgency,
    action,
    actorRole,
    departmentId,
    operatorId,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = q.trim();
      setDebouncedQ((prev) => {
        if (prev === normalized) return prev;
        setPage(1);
        return normalized;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let active = true;
    async function loadOperators() {
      try {
        const [departmentResult, operatorResult] = await Promise.all([
          listAdminDepartments({ isActive: true }),
          listAdminOperators(),
        ]);
        if (active) {
          setDepartments(departmentResult.items);
          setOperators(operatorResult.items);
        }
      } catch {
        /* keep usable */
      }
    }
    void loadOperators();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLogs() {
      setLoading(true);
      setErrorMessage(null);
      const dateRangeError = validateDateRange(dateFrom, dateTo);
      if (dateRangeError) {
        setLoading(false);
        setErrorMessage(dateRangeError);
        return;
      }
      try {
        const result = await getAdminAuditLogs({
          page,
          limit,
          q: debouncedQ || undefined,
          requestNo: requestNo.trim() || undefined,
          requestType: requestType || undefined,
          requestStatus: requestStatus || undefined,
          requestUrgency: requestUrgency || undefined,
          action: action || undefined,
          actorRole: actorRole || undefined,
          departmentId: departmentId || undefined,
          operatorId: operatorId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "ไม่สามารถโหลดบันทึกการใช้งานได้",
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadLogs();
    return () => {
      active = false;
    };
  }, [
    action,
    actorRole,
    departmentId,
    dateFrom,
    dateTo,
    debouncedQ,
    limit,
    operatorId,
    page,
    requestNo,
    requestStatus,
    requestType,
    requestUrgency,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [limit, total],
  );

  const applyDatePreset = (daysBack: number) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - daysBack);
    const fromIso = toIsoDateLocal(from);
    const toIso = toIsoDateLocal(today);
    setPage(1);
    setDateFrom(fromIso);
    setDateTo(toIso);
    setDateFromInput(formatThaiDateInputValue(fromIso));
    setDateToInput(formatThaiDateInputValue(toIso));
  };

  const applyMonthPreset = (target: "current" | "previous") => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (target === "previous") {
      firstDay.setMonth(firstDay.getMonth() - 1);
      lastDay.setMonth(lastDay.getMonth() - 1);
    }
    const fromIso = toIsoDateLocal(firstDay);
    const toIso = toIsoDateLocal(lastDay);
    setPage(1);
    setDateFrom(fromIso);
    setDateTo(toIso);
    setDateFromInput(formatThaiDateInputValue(fromIso));
    setDateToInput(formatThaiDateInputValue(toIso));
  };

  const handleClearFilters = () => {
    setQ("");
    setDebouncedQ("");
    setRequestNo("");
    setRequestType("");
    setRequestStatus("");
    setRequestUrgency("");
    setAction("");
    setActorRole("");
    setDepartmentId("");
    setOperatorId("");
    setDateFrom("");
    setDateTo("");
    setDateFromInput("");
    setDateToInput("");
    setPage(1);
  };

  const handleExportXlsx = async () => {
    const dateRangeError = validateDateRange(dateFrom, dateTo);
    if (dateRangeError) {
      setErrorMessage(dateRangeError);
      return;
    }
    setExporting(true);
    setErrorMessage(null);
    try {
      const result = await downloadAdminAuditXlsx({
        q: debouncedQ || undefined,
        requestNo: requestNo.trim() || undefined,
        requestType: requestType || undefined,
        requestStatus: requestStatus || undefined,
        requestUrgency: requestUrgency || undefined,
        action: action || undefined,
        actorRole: actorRole || undefined,
        departmentId: departmentId || undefined,
        operatorId: operatorId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 5000,
      });
      const xlsxBytes = new Uint8Array(result.xlsxBytes);
      const blob = new Blob([xlsxBytes], {
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
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถส่งออกไฟล์ Excel ได้",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 bg-slate-50/80 px-4 py-6 md:px-6 lg:px-8">
      {/* ===== HEADER (เหมือนแดชบอร์ด/requests) ===== */}
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
              บันทึกการใช้งาน
            </h1>
            <p className="mt-1 text-sm text-white/65">
              ประวัติการดำเนินการและกิจกรรมในระบบโดยผู้ดูแลและผู้ใช้
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
                รายการบันทึก
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
                  กำลังส่งออก...
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
                  ส่งออก Excel
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── FILTER PANEL ── */}
      <section className="rounded-2xl border border-[#0e2d4c]/10 bg-white/80 shadow-[0_4px_16px_-6px_rgba(14,45,76,0.1)] backdrop-blur-sm">
        {/* Filter header */}
        <div className="flex items-center justify-between border-b border-[#0e2d4c]/8 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0e2d4c]/8">
              <svg
                className="h-3.5 w-3.5 text-[#0e2d4c]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#0e2d4c]">
              ตัวกรองข้อมูล
            </span>
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#b62026] px-1.5 text-[10px] font-bold text-white">
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
          {/* Row 1: search + type + status + urgency + action */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <FilterLabel htmlFor="q">ค้นหา</FilterLabel>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0e2d4c]/35"
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
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="เลขคำขอ / ชื่อ / เบอร์โทร"
                  className={inputClass + " pl-9"}
                />
              </div>
            </div>

            <div>
              <FilterLabel htmlFor="requestType">ประเภทคำขอ</FilterLabel>
              <SelectWrapper>
                <select
                  id="requestType"
                  value={requestType}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setRequestType(e.target.value as "" | AdminRequestType);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {requestTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <FilterLabel htmlFor="requestStatus">สถานะคำขอ</FilterLabel>
              <SelectWrapper>
                <select
                  id="requestStatus"
                  value={requestStatus}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setRequestStatus(e.target.value as "" | AdminRequestStatus);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {requestStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <FilterLabel htmlFor="requestUrgency">
                ระดับความเร่งด่วน
              </FilterLabel>
              <SelectWrapper>
                <select
                  id="requestUrgency"
                  value={requestUrgency}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setRequestUrgency(e.target.value as "" | AdminUrgency);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {requestUrgencyOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <FilterLabel htmlFor="action">การกระทำ</FilterLabel>
              <SelectWrapper>
                <select
                  id="action"
                  value={action}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setAction(e.target.value as "" | AuditAction);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {actionOptions.map((item) => (
                    <option key={item} value={item}>
                      {actionLabelMap[item]}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>

          {/* Row 2: role + dept + operator */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FilterLabel htmlFor="actorRole">บทบาทผู้ทำรายการ</FilterLabel>
              <SelectWrapper>
                <select
                  id="actorRole"
                  value={actorRole}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setActorRole(e.target.value as "" | AuditActorRole);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {actorRoleOptions.map((item) => (
                    <option key={item} value={item}>
                      {actorRoleLabelMap[item]}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <FilterLabel htmlFor="departmentId">แผนก</FilterLabel>
              <SelectWrapper>
                <select
                  id="departmentId"
                  value={departmentId}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setDepartmentId(e.target.value);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>

            <div>
              <FilterLabel htmlFor="operatorId">ผู้รับผิดชอบ</FilterLabel>
              <SelectWrapper>
                <select
                  id="operatorId"
                  value={operatorId}
                  className={selectClass}
                  onChange={(e) => {
                    setPage(1);
                    setOperatorId(e.target.value);
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </div>
          </div>

          {/* Row 3: date range */}
          <div className="mt-3">
            <DateRangeField
              fromId="dateFrom"
              toId="dateTo"
              fromLabel="วันที่เริ่มต้น"
              toLabel="วันที่สิ้นสุด"
              fromInput={dateFromInput}
              toInput={dateToInput}
              fromIso={dateFrom}
              toIso={dateTo}
              fromPickerRef={dateFromPickerRef}
              toPickerRef={dateToPickerRef}
              onFromChange={(v) => {
                setDateFromInput(v);
                const p = parseThaiDateInputToIso(v);
                if (p !== null) {
                  setPage(1);
                  setDateFrom(p);
                }
              }}
              onToChange={(v) => {
                setDateToInput(v);
                const p = parseThaiDateInputToIso(v);
                if (p !== null) {
                  setPage(1);
                  setDateTo(p);
                }
              }}
              onFromBlur={() =>
                setDateFromInput(formatThaiDateInputValue(dateFrom))
              }
              onToBlur={() => setDateToInput(formatThaiDateInputValue(dateTo))}
              onFromPickerChange={(iso) => {
                setPage(1);
                setDateFrom(iso);
                setDateFromInput(formatThaiDateInputValue(iso));
              }}
              onToPickerChange={(iso) => {
                setPage(1);
                setDateTo(iso);
                setDateToInput(formatThaiDateInputValue(iso));
              }}
            />

            {/* Date presets */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { label: "วันนี้", action: () => applyDatePreset(0) },
                { label: "7 วันล่าสุด", action: () => applyDatePreset(6) },
                { label: "30 วันล่าสุด", action: () => applyDatePreset(29) },
                {
                  label: "เดือนนี้",
                  action: () => applyMonthPreset("current"),
                },
                {
                  label: "เดือนที่แล้ว",
                  action: () => applyMonthPreset("previous"),
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={preset.action}
                  className="rounded-lg border border-[#0e2d4c]/15 bg-[#0e2d4c]/5 px-3 py-1.5 text-xs font-semibold text-[#0e2d4c]/70 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c] hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ERROR ── */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-[#b62026]/25 bg-[#b62026]/8 px-4 py-3.5 text-sm font-medium text-[#b62026]">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {errorMessage}
        </div>
      )}

      {/* ===== TABLE SECTION ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
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
                  d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h2 className="text-sm font-bold text-[#0e2d4c]">
              บันทึกการใช้งานระบบ
            </h2>
          </div>

          {!loading && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {items.length} / {total} รายการ
            </span>
          )}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-[#0e2d4c] border-t-transparent animate-spin" />
            </div>

            <p className="text-sm font-medium text-slate-500">
              กำลังโหลดบันทึกการใช้งาน...
            </p>
          </div>
        ) : items.length === 0 ? (
          /* Empty */
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
                  d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                ไม่พบบันทึกการใช้งาน
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ลองเปลี่ยนเงื่อนไขการค้นหา
              </p>
            </div>
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  {[
                    "วันเวลา",
                    "คำขอ",
                    "การกระทำ",
                    "ระดับ",
                    "ผู้ทำรายการ",
                    "การทำงาน",
                  ].map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#0e2d4c]/50"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const urgency = getUrgencyBadge(item.requestUrgency);

                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors duration-150 hover:bg-[#0e2d4c]/[0.02]"
                    >
                      {/* วันเวลา */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <svg
                            className="h-3.5 w-3.5 text-slate-400"
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
                          {formatDateTime(item.createdAt)}
                        </div>
                      </td>

                      {/* คำขอ */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#0e2d4c]/10 bg-[#0e2d4c]/5 px-2.5 py-1 font-mono text-xs font-bold text-[#0e2d4c]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#fed54f]" />
                          {item.requestNo}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md bg-[#0e2d4c]/8 px-1.5 py-0.5 text-[10px] font-medium text-[#0e2d4c]/70">
                            {requestTypeLabelMap[
                              item.requestType as AdminRequestType
                            ] ?? item.requestType}
                          </span>

                          <StatusBadge status={item.requestStatus} />

                          <span className="sr-only">
                            {(requestTypeLabelMap[
                              item.requestType as AdminRequestType
                            ] ?? item.requestType) +
                              " | " +
                              (requestStatusLabelMap[
                                item.requestStatus as AdminRequestStatus
                              ] ?? item.requestStatus)}
                          </span>
                        </div>
                      </td>

                      {/* การกระทำ */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getActionBadge(
                            item.action,
                          )}`}
                        >
                          {actionLabelMap[item.action] ?? item.action}
                        </span>

                        {(item.fromStatus || item.toStatus) && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {getChangeSummary(item)}
                          </p>
                        )}
                      </td>

                      {/* ระดับ */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${urgency.className}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`}
                          />
                          {urgency.label}
                        </span>
                      </td>

                      {/* ผู้ทำรายการ */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-xs font-bold text-[#fed54f]">
                            {getActorPrimaryName(item).charAt(0) || "?"}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-[#0e2d4c]">
                              {getActorPrimaryName(item)}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {getActorSecondaryLine(item)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* การทำงาน */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
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
                        </button>
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

              {/* Page numbers */}
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

      {/* ── DETAIL MODAL ── */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0e2d4c]/40 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-16px_rgba(14,45,76,0.45)] sm:max-h-[82vh] sm:flex sm:flex-col">
            {/* Brand accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[#0e2d4c]/8 bg-[#0e2d4c]/[0.03] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e2d4c]/10">
                  <svg
                    className="h-[18px] w-[18px] text-[#0e2d4c]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0e2d4c]">
                    รายละเอียดบันทึกการใช้งาน
                  </h2>
                  <p className="font-mono text-[10px] text-[#0e2d4c]/40">
                    {selectedItem.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#0e2d4c]/15 text-[#0e2d4c]/50 transition hover:border-[#0e2d4c]/30 hover:text-[#0e2d4c]"
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
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-y-4 gap-x-6 text-sm sm:grid-cols-2">
                {[
                  {
                    label: "วันเวลา",
                    value: formatDateTime(selectedItem.createdAt),
                  },
                  { label: "เลขคำขอ", value: selectedItem.requestNo },
                  {
                    label: "ประเภทคำขอ",
                    value:
                      requestTypeLabelMap[
                        selectedItem.requestType as AdminRequestType
                      ] ?? selectedItem.requestType,
                  },
                  {
                    label: "สถานะคำขอ",
                    value: <StatusBadge status={selectedItem.requestStatus} />,
                  },
                  { label: "ที่มา", value: getSourceLabel(selectedItem) },
                  {
                    label: "แผนก",
                    value:
                      selectedItem.actorRole === "MESSENGER"
                        ? "-"
                        : (selectedItem.departmentName ?? "-"),
                  },
                  {
                    label: "การกระทำ",
                    value: (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getActionBadge(selectedItem.action)}`}
                      >
                        {actionLabelMap[selectedItem.action] ??
                          selectedItem.action}
                      </span>
                    ),
                  },
                  { label: "ผลลัพธ์", value: getOutcomeLabel(selectedItem) },
                  {
                    label: "ระดับความเร่งด่วน",
                    value: (() => {
                      const r = getUrgencyBadge(selectedItem.requestUrgency);
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${r.className}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${r.dot}`}
                          />
                          {r.label}
                        </span>
                      );
                    })(),
                  },
                  {
                    label: "บทบาทผู้ทำรายการ",
                    value:
                      actorRoleLabelMap[selectedItem.actorRole] ??
                      selectedItem.actorRole,
                  },
                  { label: "ชื่อผู้ทำรายการ", value: selectedItem.actorLabel },
                  {
                    label: "สถานะก่อน → หลัง",
                    value: getChangeSummary(selectedItem),
                    full: true,
                  },
                  {
                    label: "ผู้รับผิดชอบ",
                    value: selectedItem.operatorName
                      ? `${selectedItem.operatorName} (รหัส: ${selectedItem.operatorId ?? "-"})`
                      : "-",
                    full: true,
                  },
                  {
                    label: "หมายเหตุ",
                    value: selectedItem.note ?? "-",
                    full: true,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className={`${row.full ? "sm:col-span-2" : ""} rounded-xl border border-[#0e2d4c]/10 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(14,45,76,0.06)]`}
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0e2d4c]/45">
                      {row.label}
                    </p>
                    <div className="text-sm font-medium text-[#0e2d4c]">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-[#0e2d4c]/8 bg-white/80 px-6 py-4 backdrop-blur">
              <Link
                href={`/admin/requests/${selectedItem.requestId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e2d4c] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0e2d4c]/90"
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                เปิดคำขอที่เกี่ยวข้อง
              </Link>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-[#0e2d4c]/15 px-4 py-2.5 text-xs font-semibold text-[#0e2d4c]/70 transition hover:border-[#0e2d4c]/30 hover:text-[#0e2d4c]"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


