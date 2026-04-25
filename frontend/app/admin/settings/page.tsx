"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmModal from "@/components/ui/confirm-modal";
import { RouteGuard } from "@/components/guards/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  createAdminDepartment,
  createAdminOperator,
  createAdminProblemCategory,
  createAdminVehicleIssueCategory,
  deleteAdminDepartment,
  deleteAdminOperator,
  deleteAdminProblemCategory,
  deleteAdminVehicleIssueCategory,
  listAdminDepartments,
  listAdminOperators,
  listAdminProblemCategories,
  listAdminVehicleIssueCategories,
  updateAdminDepartment,
  updateAdminOperator,
  updateAdminProblemCategory,
  updateAdminVehicleIssueCategory,
  type AdminDepartment,
  type AdminOperator,
  type AdminProblemCategory,
  type AdminVehicleIssueCategory,
} from "@/lib/api/admin-settings";

type SettingsTab =
  | "departments"
  | "problemCategories"
  | "vehicleIssueCategories"
  | "operators";

type ConfirmAction = {
  tab: SettingsTab;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  action: () => Promise<void>;
};

const tabOptions: Array<{
  value: SettingsTab;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: "departments",
    label: "แผนก",
    description: "จัดการรายชื่อแผนกในองค์กร",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    value: "problemCategories",
    label: "หมวดปัญหาอาคาร",
    description: "จัดการหมวดหมู่ปัญหาสำหรับงานซ่อมอาคาร",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    value: "vehicleIssueCategories",
    label: "หมวดปัญหารถ",
    description: "จัดการหมวดหมู่ปัญหาสำหรับงานซ่อมยานพาหนะ",
    icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6",
  },
  {
    value: "operators",
    label: "ผู้ดำเนินการ",
    description: "จัดการรายชื่อเจ้าหน้าที่ผู้ดำเนินการ",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const defaultTabFlags: Record<SettingsTab, boolean> = {
  departments: false,
  problemCategories: false,
  vehicleIssueCategories: false,
  operators: false,
};

function containsText(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function quote(value: string) {
  return `"${value}"`;
}

// ===== Reusable UI Components =====

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e2d4c]/8">
        <svg
          className="h-5 w-5 text-[#0e2d4c]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={icon}
          />
        </svg>
      </div>
      <div>
        <h2 className="text-base font-bold text-[#0e2d4c]">{title}</h2>
      </div>
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-[#0e2d4c]/8 px-2.5 py-0.5 text-xs font-bold text-[#0e2d4c]">
          {count} รายการ
        </span>
      )}
    </div>
  );
}

function SearchInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
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
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function StyledInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10 ${className ?? ""}`}
    />
  );
}

function AddInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/60"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0e2d4c] shadow-sm outline-none placeholder:text-slate-400 transition-all focus:border-[#0e2d4c]/40 focus:ring-2 focus:ring-[#0e2d4c]/10"
      />
    </div>
  );
}

function CreateButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-[#0e2d4c] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0e2d4c]/20 transition-all hover:bg-[#0e2d4c]/90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {children}
    </button>
  );
}

function SaveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#0e2d4c]/20 bg-[#0e2d4c]/6 px-3 py-1.5 text-xs font-semibold text-[#0e2d4c] transition-all hover:bg-[#0e2d4c] hover:text-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      บันทึก
    </button>
  );
}

function ToggleStatusButton({
  isActive,
  onClick,
  disabled,
}: {
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        isActive
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
          : "border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-500 hover:text-white hover:border-slate-500"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
    </button>
  );
}

function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#b62026]/20 bg-[#b62026]/5 px-3 py-1.5 text-xs font-semibold text-[#b62026] transition-all hover:bg-[#b62026] hover:text-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      ลบ
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

// ===== Main Export =====

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminSettingsContent />
    </RouteGuard>
  );
}

function AdminSettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("departments");

  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [problemCategories, setProblemCategories] = useState<AdminProblemCategory[]>([]);
  const [vehicleIssueCategories, setVehicleIssueCategories] = useState<AdminVehicleIssueCategory[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);

  const [searchDepartment, setSearchDepartment] = useState("");
  const [searchProblemCategory, setSearchProblemCategory] = useState("");
  const [searchVehicleIssueCategory, setSearchVehicleIssueCategory] = useState("");
  const [searchOperator, setSearchOperator] = useState("");

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newProblemCategoryName, setNewProblemCategoryName] = useState("");
  const [newProblemCategoryHelperText, setNewProblemCategoryHelperText] = useState("");
  const [newVehicleIssueCategoryName, setNewVehicleIssueCategoryName] = useState("");
  const [newOperatorName, setNewOperatorName] = useState("");

  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string>>({});
  const [problemCategoryNameDrafts, setProblemCategoryNameDrafts] = useState<Record<string, string>>({});
  const [problemCategoryHelperDrafts, setProblemCategoryHelperDrafts] = useState<Record<string, string>>({});
  const [vehicleIssueCategoryDrafts, setVehicleIssueCategoryDrafts] = useState<Record<string, string>>({});
  const [operatorDrafts, setOperatorDrafts] = useState<Record<string, string>>({});

  const [loadingTabs, setLoadingTabs] = useState<Record<SettingsTab, boolean>>(defaultTabFlags);
  const [loadedTabs, setLoadedTabs] = useState<Record<SettingsTab, boolean>>(defaultTabFlags);
  const [mutating, setMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmAction | null>(null);

  const loadTab = useCallback(
    async (tab: SettingsTab, options?: { force?: boolean }) => {
      if (!options?.force && loadedTabs[tab]) return;

      setLoadingTabs((prev) => ({ ...prev, [tab]: true }));
      setErrorMessage(null);

      try {
        if (tab === "departments") {
          const depRes = await listAdminDepartments();
          setDepartments(depRes.items);
          setDepartmentDrafts(
            Object.fromEntries(depRes.items.map((item) => [item.id, item.name])),
          );
        }
        if (tab === "problemCategories") {
          const probRes = await listAdminProblemCategories();
          setProblemCategories(probRes.items);
          setProblemCategoryNameDrafts(
            Object.fromEntries(probRes.items.map((item) => [item.id, item.name])),
          );
          setProblemCategoryHelperDrafts(
            Object.fromEntries(
              probRes.items.map((item) => [item.id, item.helperText ?? ""]),
            ),
          );
        }
        if (tab === "vehicleIssueCategories") {
          const vehicleRes = await listAdminVehicleIssueCategories();
          setVehicleIssueCategories(vehicleRes.items);
          setVehicleIssueCategoryDrafts(
            Object.fromEntries(vehicleRes.items.map((item) => [item.id, item.name])),
          );
        }
        if (tab === "operators") {
          const opRes = await listAdminOperators();
          setOperators(opRes.items);
          setOperatorDrafts(
            Object.fromEntries(opRes.items.map((item) => [item.id, item.displayName])),
          );
        }
        setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดการตั้งค่าได้");
        }
      } finally {
        setLoadingTabs((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [loadedTabs],
  );

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab, loadTab]);

  // Auto-clear messages
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const filteredDepartments = useMemo(
    () => departments.filter((item) => containsText(item.name, searchDepartment)),
    [departments, searchDepartment],
  );

  const filteredProblemCategories = useMemo(
    () =>
      problemCategories.filter(
        (item) =>
          containsText(item.name, searchProblemCategory) ||
          containsText(item.helperText ?? "", searchProblemCategory),
      ),
    [problemCategories, searchProblemCategory],
  );

  const filteredVehicleIssueCategories = useMemo(
    () =>
      vehicleIssueCategories.filter((item) =>
        containsText(item.name, searchVehicleIssueCategory),
      ),
    [vehicleIssueCategories, searchVehicleIssueCategory],
  );

  const filteredOperators = useMemo(
    () =>
      operators.filter((item) => containsText(item.displayName, searchOperator)),
    [operators, searchOperator],
  );

  const runMutation = useCallback(
    async (
      tab: SettingsTab,
      action: () => Promise<void>,
      success: string,
    ) => {
      setMutating(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await action();
        await loadTab(tab, { force: true });
        setSuccessMessage(success);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถดำเนินการได้");
        }
      } finally {
        setMutating(false);
      }
    },
    [loadTab],
  );

  const requestConfirm = useCallback(
    (config: ConfirmAction) => {
      if (mutating) return;
      setPendingConfirm(config);
    },
    [mutating],
  );

  const confirmPendingAction = useCallback(() => {
    if (!pendingConfirm) return;
    const config = pendingConfirm;
    setPendingConfirm(null);
    void runMutation(config.tab, config.action, config.successMessage);
  }, [pendingConfirm, runMutation]);

  const closeConfirm = useCallback(() => {
    if (mutating) return;
    setPendingConfirm(null);
  }, [mutating]);

  const activeTabLoading = loadingTabs[activeTab];
  const activeTabLoaded = loadedTabs[activeTab];
  const activeTabOption = tabOptions.find((t) => t.value === activeTab)!;
  const activeTabNumber = tabOptions.findIndex((t) => t.value === activeTab) + 1;

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
              {"\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e23\u0e30\u0e1a\u0e1a"}
            </h1>
            <p className="mt-1 text-sm text-white/65">
              {
                "\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2b\u0e25\u0e31\u0e01\u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e43\u0e19\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21\u0e04\u0e33\u0e02\u0e2d\u0e41\u0e25\u0e30\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e1c\u0e39\u0e49\u0e14\u0e39\u0e41\u0e25\u0e23\u0e30\u0e1a\u0e1a"
              }
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/30 bg-gradient-to-r from-white/20 via-white/15 to-white/10 px-4 py-2.5 shadow-[0_12px_24px_-16px_rgba(2,6,23,0.9)] backdrop-blur-sm">
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#fed54f] px-1.5 text-[11px] font-extrabold text-[#0e2d4c] shadow-[0_6px_16px_-8px_rgba(254,213,79,1)]">
                {activeTabLoading ? "-" : activeTabNumber}
              </span>
              <span className="text-sm font-semibold tracking-wide text-white/95">
                {"\u0e2b\u0e21\u0e27\u0e14\u0e17\u0e35\u0e48\u0e01\u0e33\u0e25\u0e31\u0e07\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23: "}
                {activeTabOption.label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void loadTab(activeTab, { force: true })}
              disabled={activeTabLoading || mutating}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                className={`h-4 w-4 ${activeTabLoading ? "animate-spin" : ""}`}
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
              {activeTabLoading
                ? "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a..."
                : "\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25"}
            </button>
          </div>
        </div>
      </header>

      {/* ===== TOAST MESSAGES ===== */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-emerald-700">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-[#b62026]/20 bg-[#b62026]/5 px-4 py-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b62026]/10">
            <svg className="h-4 w-4 text-[#b62026]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#b62026]">{errorMessage}</p>
        </div>
      )}

      {/* ===== TAB NAVIGATION ===== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`group flex flex-col items-start gap-1.5 rounded-xl px-4 py-3 text-left transition-all duration-200 ${
                  isActive
                    ? "bg-[#0e2d4c] shadow-md shadow-[#0e2d4c]/20"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? "bg-white/20"
                    : "bg-slate-100 group-hover:bg-[#0e2d4c]/8"
                }`}>
                  <svg
                    className={`h-4 w-4 ${isActive ? "text-[#fed54f]" : "text-[#0e2d4c]/60"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-bold leading-tight ${isActive ? "text-white" : "text-[#0e2d4c]"}`}>
                    {tab.label}
                  </p>
                  <p className={`mt-0.5 text-[10px] leading-tight ${isActive ? "text-white/60" : "text-slate-400"}`}>
                    {tab.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== LOADING STATE ===== */}
      {activeTabLoading && !activeTabLoaded && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-[#0e2d4c] border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-500">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {/* ===== DEPARTMENTS TAB ===== */}
      {activeTabLoaded && activeTab === "departments" && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Section Header */}
          <div className="border-b border-slate-100 px-6 py-4">
            <SectionHeader
              icon={tabOptions[0].icon}
              title="แผนก"
              count={filteredDepartments.length}
            />
          </div>

          <div className="p-6 space-y-6">
            {/* Create form */}
            <div className="rounded-2xl border border-[#fed54f]/40 bg-gradient-to-br from-[#fffbeb] to-[#fff8e1] p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0e2d4c]/60">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                เพิ่มแผนกใหม่
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <AddInput
                    id="newDepartment"
                    label="ชื่อแผนก"
                    value={newDepartmentName}
                    onChange={setNewDepartmentName}
                    placeholder="กรอกชื่อแผนกใหม่"
                  />
                </div>
                <CreateButton
                  disabled={mutating || !newDepartmentName.trim()}
                  onClick={() => {
                    const name = newDepartmentName.trim();
                    if (!name) return;
                    requestConfirm({
                      tab: "departments",
                      title: "ยืนยันการสร้างแผนก",
                      description: `ยืนยันการสร้างแผนก ${quote(name)}?`,
                      confirmLabel: "สร้าง",
                      successMessage: "สร้างแผนกเรียบร้อยแล้ว",
                      action: async () => {
                        await createAdminDepartment({ name });
                        setNewDepartmentName("");
                      },
                    });
                  }}
                >
                  สร้างแผนก
                </CreateButton>
              </div>
            </div>

            {/* Search */}
            <SearchInput
              id="searchDepartment"
              value={searchDepartment}
              onChange={setSearchDepartment}
              placeholder="ค้นหาแผนก..."
            />

            {/* List */}
            {filteredDepartments.length === 0 ? (
              <EmptyState
                message={searchDepartment.trim() ? "ไม่พบแผนกที่ตรงกับคำค้นหา" : "ยังไม่มีแผนก กรุณาเพิ่มแผนกใหม่"}
              />
            ) : (
              <ul className="space-y-2">
                {filteredDepartments.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    {/* Status dot */}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${item.isActive ? "bg-emerald-400" : "bg-slate-300"}`}
                    />

                    {/* Name input */}
                    <StyledInput
                      value={departmentDrafts[item.id] ?? item.name}
                      onChange={(v) =>
                        setDepartmentDrafts((prev) => ({ ...prev, [item.id]: v }))
                      }
                      className="min-w-[160px] flex-1"
                    />

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <SaveButton
                        disabled={mutating || !(departmentDrafts[item.id] ?? item.name).trim()}
                        onClick={() => {
                          const nextName = (departmentDrafts[item.id] ?? item.name).trim();
                          if (!nextName) return;
                          requestConfirm({
                            tab: "departments",
                            title: "ยืนยันการบันทึกแผนก",
                            description: `ยืนยันการบันทึกชื่อแผนกเป็น ${quote(nextName)}?`,
                            confirmLabel: "บันทึก",
                            successMessage: "บันทึกแผนกเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminDepartment(item.id, { name: nextName });
                            },
                          });
                        }}
                      />
                      <ToggleStatusButton
                        isActive={item.isActive}
                        disabled={mutating}
                        onClick={() => {
                          const nextIsActive = !item.isActive;
                          requestConfirm({
                            tab: "departments",
                            title: "ยืนยันการเปลี่ยนสถานะ",
                            description: `เปลี่ยนสถานะแผนก ${quote(item.name)} เป็น ${nextIsActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}?`,
                            confirmLabel: "ยืนยัน",
                            successMessage: "อัปเดตสถานะแผนกเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminDepartment(item.id, { isActive: nextIsActive });
                            },
                          });
                        }}
                      />
                      <DeleteButton
                        disabled={mutating}
                        onClick={() => {
                          requestConfirm({
                            tab: "departments",
                            title: "ยืนยันการลบแผนก",
                            description: `ยืนยันการลบแผนก ${quote(item.name)}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                            confirmLabel: "ลบ",
                            successMessage: "ลบแผนกเรียบร้อยแล้ว",
                            action: async () => {
                              await deleteAdminDepartment(item.id);
                            },
                          });
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ===== PROBLEM CATEGORIES TAB ===== */}
      {activeTabLoaded && activeTab === "problemCategories" && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <SectionHeader
              icon={tabOptions[1].icon}
              title="หมวดปัญหาอาคาร"
              count={filteredProblemCategories.length}
            />
          </div>

          <div className="p-6 space-y-6">
            {/* Create form */}
            <div className="rounded-2xl border border-[#fed54f]/40 bg-gradient-to-br from-[#fffbeb] to-[#fff8e1] p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0e2d4c]/60">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                เพิ่มหมวดหมู่ใหม่
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <AddInput
                  id="newProblemCategory"
                  label="ชื่อหมวดหมู่"
                  value={newProblemCategoryName}
                  onChange={setNewProblemCategoryName}
                  placeholder="กรอกชื่อหมวดหมู่"
                />
                <AddInput
                  id="newProblemCategoryHelper"
                  label="ข้อความช่วยเหลือ (ถ้ามี)"
                  value={newProblemCategoryHelperText}
                  onChange={setNewProblemCategoryHelperText}
                  placeholder="คำอธิบายเพิ่มเติม"
                />
              </div>
              <div className="mt-3">
                <CreateButton
                  disabled={mutating || !newProblemCategoryName.trim()}
                  onClick={() => {
                    const name = newProblemCategoryName.trim();
                    const helperText = newProblemCategoryHelperText.trim();
                    if (!name) return;
                    requestConfirm({
                      tab: "problemCategories",
                      title: "ยืนยันการสร้างหมวดปัญหา",
                      description: helperText
                        ? `ยืนยันการสร้างหมวด ${quote(name)} พร้อมข้อความช่วยเหลือ ${quote(helperText)}?`
                        : `ยืนยันการสร้างหมวด ${quote(name)}?`,
                      confirmLabel: "สร้าง",
                      successMessage: "สร้างหมวดปัญหาเรียบร้อยแล้ว",
                      action: async () => {
                        await createAdminProblemCategory({
                          name,
                          helperText: helperText || undefined,
                        });
                        setNewProblemCategoryName("");
                        setNewProblemCategoryHelperText("");
                      },
                    });
                  }}
                >
                  สร้างหมวดหมู่
                </CreateButton>
              </div>
            </div>

            {/* Search */}
            <SearchInput
              id="searchProblemCategory"
              value={searchProblemCategory}
              onChange={setSearchProblemCategory}
              placeholder="ค้นหาหมวดหมู่หรือข้อความช่วยเหลือ..."
            />

            {/* List */}
            {filteredProblemCategories.length === 0 ? (
              <EmptyState
                message={
                  searchProblemCategory.trim()
                    ? "ไม่พบหมวดปัญหาที่ตรงกับคำค้นหา"
                    : "ยังไม่มีหมวดปัญหา กรุณาเพิ่มหมวดหมู่ใหม่"
                }
              />
            ) : (
              <ul className="space-y-2">
                {filteredProblemCategories.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    {/* Top row: status dot + inputs */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${item.isActive ? "bg-emerald-400" : "bg-slate-300"}`}
                      />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <StyledInput
                          value={problemCategoryNameDrafts[item.id] ?? item.name}
                          onChange={(v) =>
                            setProblemCategoryNameDrafts((prev) => ({
                              ...prev,
                              [item.id]: v,
                            }))
                          }
                          placeholder="ชื่อหมวดหมู่"
                        />
                        <StyledInput
                          value={
                            problemCategoryHelperDrafts[item.id] ??
                            item.helperText ??
                            ""
                          }
                          onChange={(v) =>
                            setProblemCategoryHelperDrafts((prev) => ({
                              ...prev,
                              [item.id]: v,
                            }))
                          }
                          placeholder="ข้อความช่วยเหลือ (ถ้ามี)"
                        />
                      </div>
                    </div>

                    {/* Bottom row: action buttons */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-5">
                      <SaveButton
                        disabled={
                          mutating ||
                          !(
                            problemCategoryNameDrafts[item.id] ?? item.name
                          ).trim()
                        }
                        onClick={() => {
                          const nextName = (
                            problemCategoryNameDrafts[item.id] ?? item.name
                          ).trim();
                          const nextHelperText = (
                            problemCategoryHelperDrafts[item.id] ??
                            item.helperText ??
                            ""
                          ).trim();
                          if (!nextName) return;
                          requestConfirm({
                            tab: "problemCategories",
                            title: "ยืนยันการบันทึกหมวดปัญหา",
                            description: nextHelperText
                              ? `ยืนยันการบันทึกหมวด ${quote(nextName)} พร้อมข้อความช่วยเหลือ ${quote(nextHelperText)}?`
                              : `ยืนยันการบันทึกหมวด ${quote(nextName)} โดยล้างข้อความช่วยเหลือ?`,
                            confirmLabel: "บันทึก",
                            successMessage: "บันทึกหมวดปัญหาเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminProblemCategory(item.id, {
                                name: nextName,
                                helperText: nextHelperText || "",
                              });
                            },
                          });
                        }}
                      />
                      <ToggleStatusButton
                        isActive={item.isActive}
                        disabled={mutating}
                        onClick={() => {
                          const nextIsActive = !item.isActive;
                          requestConfirm({
                            tab: "problemCategories",
                            title: "ยืนยันการเปลี่ยนสถานะ",
                            description: `เปลี่ยนสถานะหมวดปัญหา ${quote(item.name)} เป็น ${nextIsActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}?`,
                            confirmLabel: "ยืนยัน",
                            successMessage: "อัปเดตสถานะหมวดปัญหาเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminProblemCategory(item.id, {
                                isActive: nextIsActive,
                              });
                            },
                          });
                        }}
                      />
                      <DeleteButton
                        disabled={mutating}
                        onClick={() => {
                          requestConfirm({
                            tab: "problemCategories",
                            title: "ยืนยันการลบหมวดปัญหา",
                            description: `ยืนยันการลบหมวดปัญหา ${quote(item.name)}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                            confirmLabel: "ลบ",
                            successMessage: "ลบหมวดปัญหาเรียบร้อยแล้ว",
                            action: async () => {
                              await deleteAdminProblemCategory(item.id);
                            },
                          });
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ===== VEHICLE ISSUE CATEGORIES TAB ===== */}
      {activeTabLoaded && activeTab === "vehicleIssueCategories" && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <SectionHeader
              icon={tabOptions[2].icon}
              title="หมวดปัญหารถ"
              count={filteredVehicleIssueCategories.length}
            />
          </div>

          <div className="p-6 space-y-6">
            {/* Create form */}
            <div className="rounded-2xl border border-[#fed54f]/40 bg-gradient-to-br from-[#fffbeb] to-[#fff8e1] p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0e2d4c]/60">
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                เพิ่มหมวดหมู่ใหม่
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <AddInput
                    id="newVehicleIssueCategory"
                    label="ชื่อหมวดปัญหารถ"
                    value={newVehicleIssueCategoryName}
                    onChange={setNewVehicleIssueCategoryName}
                    placeholder="กรอกชื่อหมวดปัญหารถ"
                  />
                </div>
                <CreateButton
                  disabled={mutating || !newVehicleIssueCategoryName.trim()}
                  onClick={() => {
                    const name = newVehicleIssueCategoryName.trim();
                    if (!name) return;
                    requestConfirm({
                      tab: "vehicleIssueCategories",
                      title: "ยืนยันการสร้างหมวดปัญหารถ",
                      description: `ยืนยันการสร้างหมวดปัญหารถ ${quote(name)}?`,
                      confirmLabel: "สร้าง",
                      successMessage: "สร้างหมวดปัญหารถเรียบร้อยแล้ว",
                      action: async () => {
                        await createAdminVehicleIssueCategory({ name });
                        setNewVehicleIssueCategoryName("");
                      },
                    });
                  }}
                >
                  สร้างหมวดหมู่
                </CreateButton>
              </div>
            </div>

            {/* Search */}
            <SearchInput
              id="searchVehicleIssueCategory"
              value={searchVehicleIssueCategory}
              onChange={setSearchVehicleIssueCategory}
              placeholder="ค้นหาหมวดปัญหารถ..."
            />

            {/* List */}
            {filteredVehicleIssueCategories.length === 0 ? (
              <EmptyState
                message={
                  searchVehicleIssueCategory.trim()
                    ? "ไม่พบหมวดปัญหารถที่ตรงกับคำค้นหา"
                    : "ยังไม่มีหมวดปัญหารถ กรุณาเพิ่มหมวดหมู่ใหม่"
                }
              />
            ) : (
              <ul className="space-y-2">
                {filteredVehicleIssueCategories.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${item.isActive ? "bg-emerald-400" : "bg-slate-300"}`}
                    />
                    <StyledInput
                      value={vehicleIssueCategoryDrafts[item.id] ?? item.name}
                      onChange={(v) =>
                        setVehicleIssueCategoryDrafts((prev) => ({
                          ...prev,
                          [item.id]: v,
                        }))
                      }
                      className="min-w-[160px] flex-1"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <SaveButton
                        disabled={
                          mutating ||
                          !(
                            vehicleIssueCategoryDrafts[item.id] ?? item.name
                          ).trim()
                        }
                        onClick={() => {
                          const nextName = (
                            vehicleIssueCategoryDrafts[item.id] ?? item.name
                          ).trim();
                          if (!nextName) return;
                          requestConfirm({
                            tab: "vehicleIssueCategories",
                            title: "ยืนยันการบันทึกหมวดปัญหารถ",
                            description: `ยืนยันการบันทึกหมวดปัญหารถเป็น ${quote(nextName)}?`,
                            confirmLabel: "บันทึก",
                            successMessage: "บันทึกหมวดปัญหารถเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminVehicleIssueCategory(item.id, {
                                name: nextName,
                              });
                            },
                          });
                        }}
                      />
                      <ToggleStatusButton
                        isActive={item.isActive}
                        disabled={mutating}
                        onClick={() => {
                          const nextIsActive = !item.isActive;
                          requestConfirm({
                            tab: "vehicleIssueCategories",
                            title: "ยืนยันการเปลี่ยนสถานะ",
                            description: `เปลี่ยนสถานะหมวดปัญหารถ ${quote(item.name)} เป็น ${nextIsActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}?`,
                            confirmLabel: "ยืนยัน",
                            successMessage: "อัปเดตสถานะหมวดปัญหารถเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminVehicleIssueCategory(item.id, {
                                isActive: nextIsActive,
                              });
                            },
                          });
                        }}
                      />
                      <DeleteButton
                        disabled={mutating}
                        onClick={() => {
                          requestConfirm({
                            tab: "vehicleIssueCategories",
                            title: "ยืนยันการลบหมวดปัญหารถ",
                            description: `ยืนยันการลบหมวดปัญหารถ ${quote(item.name)}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                            confirmLabel: "ลบ",
                            successMessage: "ลบหมวดปัญหารถเรียบร้อยแล้ว",
                            action: async () => {
                              await deleteAdminVehicleIssueCategory(item.id);
                            },
                          });
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ===== OPERATORS TAB ===== */}
      {activeTabLoaded && activeTab === "operators" && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <SectionHeader
              icon={tabOptions[3].icon}
              title="ผู้ดำเนินการ"
              count={filteredOperators.length}
            />
          </div>

          <div className="p-6 space-y-6">
            {/* Create form */}
            <div className="rounded-2xl border border-[#fed54f]/40 bg-gradient-to-br from-[#fffbeb] to-[#fff8e1] p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0e2d4c]/60">
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                เพิ่มผู้ดำเนินการใหม่
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <AddInput
                    id="newOperator"
                    label="ชื่อที่แสดง"
                    value={newOperatorName}
                    onChange={setNewOperatorName}
                    placeholder="กรอกชื่อผู้ดำเนินการ"
                  />
                </div>
                <CreateButton
                  disabled={mutating || !newOperatorName.trim()}
                  onClick={() => {
                    const displayName = newOperatorName.trim();
                    if (!displayName) return;
                    requestConfirm({
                      tab: "operators",
                      title: "ยืนยันการเพิ่มผู้ดำเนินการ",
                      description: `ยืนยันการเพิ่มผู้ดำเนินการ ${quote(displayName)}?`,
                      confirmLabel: "สร้าง",
                      successMessage: "เพิ่มผู้ดำเนินการเรียบร้อยแล้ว",
                      action: async () => {
                        await createAdminOperator({ displayName });
                        setNewOperatorName("");
                      },
                    });
                  }}
                >
                  เพิ่มผู้ดำเนินการ
                </CreateButton>
              </div>
            </div>

            {/* Search */}
            <SearchInput
              id="searchOperator"
              value={searchOperator}
              onChange={setSearchOperator}
              placeholder="ค้นหาผู้ดำเนินการ..."
            />

            {/* List */}
            {filteredOperators.length === 0 ? (
              <EmptyState
                message={
                  searchOperator.trim()
                    ? "ไม่พบผู้ดำเนินการที่ตรงกับคำค้นหา"
                    : "ยังไม่มีผู้ดำเนินการ กรุณาเพิ่มผู้ดำเนินการใหม่"
                }
              />
            ) : (
              <ul className="space-y-2">
                {filteredOperators.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-xs font-bold text-[#fed54f]">
                      {(operatorDrafts[item.id] ?? item.displayName)
                        .charAt(0)
                        .toUpperCase() || "?"}
                    </div>

                    {/* Status dot */}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${item.isActive ? "bg-emerald-400" : "bg-slate-300"}`}
                    />

                    {/* Name input */}
                    <StyledInput
                      value={operatorDrafts[item.id] ?? item.displayName}
                      onChange={(v) =>
                        setOperatorDrafts((prev) => ({
                          ...prev,
                          [item.id]: v,
                        }))
                      }
                      className="min-w-[160px] flex-1"
                    />

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <SaveButton
                        disabled={
                          mutating ||
                          !(operatorDrafts[item.id] ?? item.displayName).trim()
                        }
                        onClick={() => {
                          const nextName = (
                            operatorDrafts[item.id] ?? item.displayName
                          ).trim();
                          if (!nextName) return;
                          requestConfirm({
                            tab: "operators",
                            title: "ยืนยันการบันทึกผู้ดำเนินการ",
                            description: `ยืนยันการบันทึกชื่อผู้ดำเนินการเป็น ${quote(nextName)}?`,
                            confirmLabel: "บันทึก",
                            successMessage: "บันทึกผู้ดำเนินการเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminOperator(item.id, {
                                displayName: nextName,
                              });
                            },
                          });
                        }}
                      />
                      <ToggleStatusButton
                        isActive={item.isActive}
                        disabled={mutating}
                        onClick={() => {
                          const nextIsActive = !item.isActive;
                          requestConfirm({
                            tab: "operators",
                            title: "ยืนยันการเปลี่ยนสถานะ",
                            description: `เปลี่ยนสถานะผู้ดำเนินการ ${quote(item.displayName)} เป็น ${nextIsActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}?`,
                            confirmLabel: "ยืนยัน",
                            successMessage: "อัปเดตสถานะผู้ดำเนินการเรียบร้อยแล้ว",
                            action: async () => {
                              await updateAdminOperator(item.id, {
                                isActive: nextIsActive,
                              });
                            },
                          });
                        }}
                      />
                      <DeleteButton
                        disabled={mutating}
                        onClick={() => {
                          requestConfirm({
                            tab: "operators",
                            title: "ยืนยันการลบผู้ดำเนินการ",
                            description: `ยืนยันการลบผู้ดำเนินการ ${quote(item.displayName)}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                            confirmLabel: "ลบ",
                            successMessage: "ลบผู้ดำเนินการเรียบร้อยแล้ว",
                            action: async () => {
                              await deleteAdminOperator(item.id);
                            },
                          });
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ===== CONFIRM MODAL ===== */}
      <ConfirmModal
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title}
        description={pendingConfirm?.description}
        confirmLabel={
          mutating ? "กำลังดำเนินการ..." : pendingConfirm?.confirmLabel
        }
        cancelLabel="ยกเลิก"
        onConfirm={confirmPendingAction}
        onClose={closeConfirm}
      />
    </main>
  );
}


