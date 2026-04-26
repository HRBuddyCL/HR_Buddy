"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/guards/route-guard";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { downloadFileFromPresignedUrl } from "@/lib/attachments/download";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import { resolveUploadMimeType } from "@/lib/attachments/attachment-policy";
import { ApiError } from "@/lib/api/client";
import { formatPhoneDisplay } from "@/lib/phone-format";
import {
  completeAdminAttachmentUpload,
  getAdminAttachmentDownloadUrl,
  getAdminRequestDetail,
  issueAdminAttachmentUploadTicket,
  updateAdminRequestStatus,
  uploadFileToPresignedUrl,
  type AdminRequestDetail,
  type AdminRequestStatus,
  type AdminRequestType,
  type AdminUrgency,
  type FileKind,
} from "@/lib/api/admin-requests";
import {
  getAdminOperators,
  type AdminOperator,
} from "@/lib/api/admin-settings";

// ─── Transition map ───────────────────────────────────────────────────────────

const transitionByType: Record<
  AdminRequestType,
  Record<AdminRequestStatus, AdminRequestStatus[]>
> = {
  BUILDING: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["IN_PROGRESS", "DONE", "CANCELED"],
    IN_PROGRESS: ["DONE", "CANCELED"],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  VEHICLE: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["IN_PROGRESS", "DONE", "CANCELED"],
    IN_PROGRESS: ["DONE", "CANCELED"],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  MESSENGER: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: [],
    IN_PROGRESS: [],
    IN_TRANSIT: ["DONE"],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  DOCUMENT: {
    NEW: ["APPROVED", "REJECTED", "CANCELED"],
    APPROVED: ["DONE", "CANCELED"],
    IN_PROGRESS: [],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
};

// ─── Label/style maps ─────────────────────────────────────────────────────────

const statusConfig: Record<
  AdminRequestStatus,
  { label: string; className: string; dot: string }
> = {
  NEW: {
    label: "คำขอใหม่",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    dot: "bg-sky-500",
  },
  APPROVED: {
    label: "อนุมัติแล้ว",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    dot: "bg-indigo-500",
  },
  IN_PROGRESS: {
    label: "กำลังดำเนินการ",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
  },
  IN_TRANSIT: {
    label: "กำลังจัดส่ง",
    className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "bg-orange-500",
  },
  DONE: {
    label: "เสร็จสิ้น",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "ปฏิเสธคำขอ",
    className: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/25",
    dot: "bg-[#b62026]",
  },
  CANCELED: {
    label: "ยกเลิกคำขอ",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
  },
};

const urgencyConfig: Record<
  AdminUrgency,
  { label: string; className: string }
> = {
  NORMAL: { label: "ปกติ", className: "bg-[#0e2d4c]/8 text-[#0e2d4c]/70" },
  HIGH: {
    label: "สูง",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  CRITICAL: {
    label: "เร่งด่วน!",
    className: "bg-[#b62026]/10 text-[#b62026] ring-1 ring-[#b62026]/25",
  },
};

const requestTypeLabelMap: Record<AdminRequestType, string> = {
  BUILDING: "ซ่อมอาคาร",
  VEHICLE: "ซ่อมรถ",
  MESSENGER: "ขนส่ง",
  DOCUMENT: "ขอเอกสาร",
};

const buildingSideLabelMap: Record<string, string> = {
  FRONT: "อาคารหน้า",
  BACK: "อาคารหลัง",
};

const requestTypeIcon: Record<AdminRequestType, string> = {
  BUILDING:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  VEHICLE: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  MESSENGER: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  DOCUMENT:
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

const statusLabelMap: Record<AdminRequestStatus, string> = {
  NEW: "คำขอใหม่",
  APPROVED: "อนุมัติแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  IN_TRANSIT: "กำลังจัดส่ง",
  DONE: "เสร็จสิ้น",
  REJECTED: "ปฏิเสธคำขอ",
  CANCELED: "ยกเลิกคำขอ",
};

const activityActionLabelMap: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  CREATE: { label: "สร้างคำขอ", icon: "✦", color: "bg-[#0e2d4c]" },
  APPROVE: { label: "อนุมัติ", icon: "✓", color: "bg-emerald-500" },
  REJECT: { label: "ปฏิเสธ", icon: "✕", color: "bg-rose-500" },
  STATUS_CHANGE: { label: "เปลี่ยนสถานะ", icon: "↻", color: "bg-amber-500" },
  CANCEL: { label: "ยกเลิก", icon: "⊘", color: "bg-slate-400" },
  UPLOAD_ATTACHMENT: {
    label: "อัปโหลดไฟล์แนบ",
    icon: "↑",
    color: "bg-indigo-500",
  },
  REPORT_PROBLEM: { label: "รายงานปัญหา", icon: "!", color: "bg-[#b62026]" },
  MESSENGER_PICKUP_EVENT: {
    label: "อัปเดตงานรับส่งเอกสาร",
    icon: "→",
    color: "bg-orange-500",
  },
};

const actorRoleLabelMap: Record<string, string> = {
  EMPLOYEE: "พนักงาน",
  ADMIN: "แอดมิน",
  MESSENGER: "เมสเซนเจอร์",
};

const documentDeliveryMethodLabelMap: Record<
  NonNullable<AdminRequestDetail["documentRequestDetail"]>["deliveryMethod"],
  string
> = {
  DIGITAL: "ไฟล์ดิจิทัล",
  PICKUP: "รับด้วยตนเอง",
  POSTAL: "ไปรษณีย์",
};

const MAX_DIGITAL_DOCUMENT_UPLOADS = 5;
const MAX_DIGITAL_DOCUMENT_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_DIGITAL_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const DIGITAL_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_PICKUP_MEDIA_UPLOADS = 5;
const MAX_PICKUP_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_PICKUP_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/mpeg",
]);
const PICKUP_MEDIA_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg";

function getFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

type PendingFilePreview = {
  key: string;
  file: File;
  mimeType: string;
  fileKind: FileKind;
  previewUrl: string;
};

function inferPendingFileKind(mimeType: string): FileKind {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("image/")) return "IMAGE";
  if (normalized.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStatusLabel(status?: AdminRequestStatus | null) {
  return status ? (statusLabelMap[status] ?? status) : "-";
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDateOnlyThai(iso?: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatFileSizeMbShort(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getAttachmentExtensionLabel(fileName: string, fileKind: string) {
  const ext = fileName.split(".").pop()?.trim().toUpperCase();
  if (ext) return ext;
  if (fileKind === "IMAGE") return "IMG";
  if (fileKind === "VIDEO") return "VID";
  return "FILE";
}

function getAttachmentBadgeClass(fileKind: string) {
  if (fileKind === "IMAGE") return "bg-blue-100 text-blue-700";
  if (fileKind === "VIDEO") return "bg-purple-100 text-purple-700";
  return "bg-slate-200 text-slate-600";
}

function validateDigitalDocumentFile(file: File) {
  const mimeType = resolveUploadMimeType(file);
  if (!mimeType || !ALLOWED_DIGITAL_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      message: `${file.name}: รองรับเฉพาะ PDF, Word หรือ Excel เท่านั้น`,
    };
  }

  if (file.size > MAX_DIGITAL_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      ok: false as const,
      message: `${file.name}: ขนาดไฟล์ต้องไม่เกิน ${formatFileSize(MAX_DIGITAL_DOCUMENT_FILE_SIZE_BYTES)}`,
    };
  }

  return { ok: true as const, mimeType };
}

function validatePickupMediaFile(file: File) {
  const mimeType = resolveUploadMimeType(file);
  if (!mimeType || !ALLOWED_PICKUP_MEDIA_MIME_TYPES.has(mimeType)) {
    return {
      ok: false as const,
      message: `${file.name}: รองรับเฉพาะไฟล์รูปภาพหรือวิดีโอเท่านั้น`,
    };
  }

  if (file.size > MAX_PICKUP_MEDIA_FILE_SIZE_BYTES) {
    return {
      ok: false as const,
      message: `${file.name}: ขนาดไฟล์ต้องไม่เกิน ${formatFileSize(MAX_PICKUP_MEDIA_FILE_SIZE_BYTES)}`,
    };
  }

  return { ok: true as const, mimeType };
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatDeliveryServiceLabel(value?: string | null) {
  if (!hasText(value)) return null;
  const normalized = value.trim().toUpperCase();
  const labelMap: Record<string, string> = {
    POST: "ไปรษณีย์",
    NAKHONCHAI_AIR: "นครชัยแอร์",
    OTHER: "อื่นๆ",
  };
  return labelMap[normalized] ?? null;
}

function formatMessengerItemTypeLabel(value?: string | null) {
  if (!hasText(value)) return null;
  const normalized = value.trim().toUpperCase();
  const labelMap: Record<string, string> = {
    DOCUMENT: "เอกสาร",
    PACKAGE: "พัสดุ",
  };
  return labelMap[normalized] ?? value.trim();
}

function formatBuildingSideLabel(value?: string | null) {
  if (!hasText(value)) return null;
  const normalized = value.trim().toUpperCase();
  return buildingSideLabelMap[normalized] ?? value.trim();
}

function formatAddress(address: {
  houseNo: string;
  soi: string | null;
  road: string | null;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}) {
  return [
    `เลขที่ ${address.houseNo}`,
    address.soi ? `ซอย ${address.soi}` : null,
    address.road ? `ถนน ${address.road}` : null,
    `แขวง/ตำบล ${address.subdistrict}`,
    `เขต/อำเภอ ${address.district}`,
    `จังหวัด ${address.province}`,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
}

function getActivityConfig(action: string) {
  return (
    activityActionLabelMap[action] ?? {
      label: action,
      icon: "•",
      color: "bg-slate-400",
    }
  );
}

function getActorRoleLabel(actorRole: string) {
  return actorRoleLabelMap[actorRole] ?? actorRole;
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  accent,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: "navy" | "red" | "yellow";
}) {
  const accentBar =
    accent === "red"
      ? "from-[#b62026] to-[#d42a30]"
      : accent === "yellow"
        ? "from-[#fed54f] to-[#fbbf24]"
        : "from-[#0e2d4c] to-[#163d64]";
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)]">
      <div
        className={`flex items-center gap-3 bg-gradient-to-r ${accentBar} px-5 py-3.5`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={icon}
            />
          </svg>
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">
          {title}
        </h2>
      </div>
      <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/40 to-white p-5">
        {children}
      </div>
    </section>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>;
}

function InfoCell({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${full ? "sm:col-span-2" : ""}`}
    >
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="text-sm font-semibold leading-relaxed text-[#0e2d4c]">
        {value ?? "-"}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminRequestStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#0e2d4c] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-[#0e2d4c]/35 focus:ring-2 focus:ring-[#0e2d4c]/10";

const selectClass = inputClass + " appearance-none cursor-pointer pr-9";

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500"
    >
      {children}
      {required && <span className="ml-0.5 text-[#b62026]">*</span>}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#b62026]">
      <svg
        className="h-3.5 w-3.5 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
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

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-12 animate-pulse bg-[#0e2d4c]/10" />
      <div className="space-y-3 p-5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded-lg bg-slate-100"
            style={{ width: `${70 + (i % 3) * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminRequestDetailContent />
    </RouteGuard>
  );
}

function AdminRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<AdminRequestDetail | null>(null);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<AdminRequestStatus | "">("");
  const [operatorId, setOperatorId] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    targetStatus?: string;
    note?: string;
    digitalAttachments?: string;
  }>({});
  const [pickupNote, setPickupNote] = useState("");
  const [pendingDigitalFiles, setPendingDigitalFiles] = useState<File[]>([]);
  const [digitalAttachmentNotice, setDigitalAttachmentNotice] = useState<
    string | null
  >(null);
  const [pendingPickupImageFiles, setPendingPickupImageFiles] = useState<
    File[]
  >([]);
  const [pickupImageNotice, setPickupImageNotice] = useState<string | null>(
    null,
  );
  const [uploadingDigitalDocuments, setUploadingDigitalDocuments] =
    useState(false);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [showConfirmUpdateStatus, setShowConfirmUpdateStatus] = useState(false);
  const [messengerMagicLink, setMessengerMagicLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [magicLinkCopyState, setMagicLinkCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<
    string | null
  >(null);
  const [videoPreview, setVideoPreview] = useState<{
    attachmentId: string;
    fileName: string;
    url: string;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    attachmentId: string;
    fileName: string;
    url: string;
  } | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{
    attachmentId: string;
    fileName: string;
    url: string;
    mimeType: string;
  } | null>(null);
  const [copiedRequestNo, setCopiedRequestNo] = useState(false);
  const [inlinePreviewUrlByAttachmentId, setInlinePreviewUrlByAttachmentId] =
    useState<Record<string, string>>({});

  const availableTransitions = useMemo(() => {
    if (!detail) return [];
    return transitionByType[detail.type][detail.status] ?? [];
  }, [detail]);

  const documentDeliveryMethod = detail?.documentRequestDetail?.deliveryMethod;
  const noteRequired =
    targetStatus === "REJECTED" || targetStatus === "CANCELED";
  const adminDocumentAttachmentCount = useMemo(() => {
    if (!detail) return 0;
    return detail.attachments.filter(
      (item) => item.fileKind === "DOCUMENT" && item.uploadedByRole === "ADMIN",
    ).length;
  }, [detail]);
  const latestAdminDocumentAttachmentId = useMemo(() => {
    if (!detail) return "";
    const adminDocuments = detail.attachments.filter(
      (item) => item.fileKind === "DOCUMENT" && item.uploadedByRole === "ADMIN",
    );
    if (adminDocuments.length === 0) return "";
    return adminDocuments
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]?.id;
  }, [detail]);

  const loadData = useCallback(async () => {
    if (!requestId) {
      setErrorMessage("รหัสคำขอไม่ถูกต้อง");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const [detailResult, operatorsResult] = await Promise.all([
        getAdminRequestDetail(requestId),
        getAdminOperators(),
      ]);
      setDetail(detailResult);
      setOperators(operatorsResult.items);
      setTargetStatus(detailResult.status);
      setOperatorId((prev) => prev || operatorsResult.items[0]?.id || "");
      setPickupNote(detailResult.documentRequestDetail?.pickupNote || "");
      setPendingDigitalFiles([]);
      setDigitalAttachmentNotice(null);
      setPendingPickupImageFiles([]);
      setPickupImageNotice(null);
      if (detailResult.type === "MESSENGER" && detailResult.magicLink?.url) {
        setMessengerMagicLink({
          url: detailResult.magicLink.url,
          expiresAt: detailResult.magicLink.expiresAt,
        });
        setMagicLinkCopyState("idle");
      } else if (
        detailResult.type !== "MESSENGER" ||
        (detailResult.status !== "APPROVED" && detailResult.status !== "IN_TRANSIT")
      ) {
        // Clear only when request is not messenger or has left active messenger statuses.
        setMessengerMagicLink(null);
        setMagicLinkCopyState("idle");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "โหลดรายละเอียดคำขอไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setInlinePreviewUrlByAttachmentId({});
  }, [detail?.id]);

  useEffect(() => {
    if (!detail) return;

    const targetAttachments = detail.attachments.filter(
      (attachment) =>
        (attachment.fileKind === "IMAGE" || attachment.fileKind === "VIDEO") &&
        !attachment.publicUrl,
    );

    if (targetAttachments.length === 0) return;

    let cancelled = false;

    void Promise.allSettled(
      targetAttachments.map(async (attachment) => {
        const result = await getAdminAttachmentDownloadUrl(
          detail.id,
          attachment.id,
          "inline",
        );
        return { id: attachment.id, url: result.downloadUrl };
      }),
    ).then((results) => {
      if (cancelled) return;
      setInlinePreviewUrlByAttachmentId((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result.status === "fulfilled") {
            next[result.value.id] = result.value.url;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [detail]);

  const pendingDigitalFilePreviews = useMemo<PendingFilePreview[]>(() => {
    return pendingDigitalFiles.map((file) => {
      const mimeType = resolveUploadMimeType(file) ?? "application/octet-stream";
      return {
        key: getFileKey(file),
        file,
        mimeType,
        fileKind: inferPendingFileKind(mimeType),
        previewUrl: URL.createObjectURL(file),
      };
    });
  }, [pendingDigitalFiles]);

  const pendingPickupFilePreviews = useMemo<PendingFilePreview[]>(() => {
    return pendingPickupImageFiles.map((file) => {
      const mimeType = resolveUploadMimeType(file) ?? "application/octet-stream";
      return {
        key: getFileKey(file),
        file,
        mimeType,
        fileKind: inferPendingFileKind(mimeType),
        previewUrl: URL.createObjectURL(file),
      };
    });
  }, [pendingPickupImageFiles]);

  useEffect(() => {
    return () => {
      for (const preview of pendingDigitalFilePreviews) {
        URL.revokeObjectURL(preview.previewUrl);
      }
      for (const preview of pendingPickupFilePreviews) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [pendingDigitalFilePreviews, pendingPickupFilePreviews]);

  const validateStatusUpdate = () => {
    const nextFieldErrors: {
      targetStatus?: string;
      note?: string;
      digitalAttachments?: string;
    } = {};

    if (!detail) return false;
    if (!operatorId) {
      setErrorMessage("กรุณาเลือกผู้ดำเนินการ");
      return false;
    }
    if (!targetStatus || targetStatus === detail.status) {
      nextFieldErrors.targetStatus = "กรุณาเลือกสถานะถัดไปที่ถูกต้อง";
    }
    if (noteRequired && !note.trim()) {
      nextFieldErrors.note = "กรุณาระบุหมายเหตุ";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return false;
    }
    setFieldErrors({});
    if (detail.type === "DOCUMENT" && targetStatus === "DONE") {
      if (documentDeliveryMethod === "PICKUP" && !pickupNote.trim()) {
        setErrorMessage("กรุณาระบุหมายเหตุการรับด้วยตนเองก่อนปิดงาน");
        return false;
      }
      if (documentDeliveryMethod === "DIGITAL") {
        const hasExistingUploadedDocument = Boolean(
          latestAdminDocumentAttachmentId,
        );
        const hasPendingUpload = pendingDigitalFiles.length > 0;
        if (!hasExistingUploadedDocument && !hasPendingUpload) {
          nextFieldErrors.digitalAttachments =
            "กรุณาอัปโหลดไฟล์เอกสารดิจิทัลอย่างน้อย 1 ไฟล์ก่อนปิดงาน";
        }
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return false;
    }
    return true;
  };

  const performUpdateStatus = async () => {
    if (!detail) return;
    if (!validateStatusUpdate()) {
      setShowConfirmUpdateStatus(false);
      return;
    }
    if (!targetStatus) {
      setShowConfirmUpdateStatus(false);
      return;
    }
    setSubmittingStatus(true);
    setUploadingDigitalDocuments(false);
    setErrorMessage(null);
    try {
      let effectiveDigitalAttachmentId = latestAdminDocumentAttachmentId || "";

      if (
        detail.type === "DOCUMENT" &&
        targetStatus === "DONE" &&
        documentDeliveryMethod === "DIGITAL" &&
        pendingDigitalFiles.length > 0
      ) {
        setUploadingDigitalDocuments(true);
        const uploadedAttachmentIds: string[] = [];

        for (const file of pendingDigitalFiles) {
          const validation = validateDigitalDocumentFile(file);
          if (!validation.ok) {
            throw new ApiError(400, null, validation.message);
          }

          const uploadTicket = await issueAdminAttachmentUploadTicket(detail.id, {
            fileKind: "DOCUMENT",
            fileName: file.name,
            mimeType: validation.mimeType,
            fileSize: file.size,
          });

          await uploadFileToPresignedUrl(uploadTicket, file);
          const completed = await completeAdminAttachmentUpload(
            detail.id,
            uploadTicket.uploadToken,
            operatorId,
          );
          uploadedAttachmentIds.push(completed.id);
        }

        if (uploadedAttachmentIds.length > 0) {
          effectiveDigitalAttachmentId =
            uploadedAttachmentIds[uploadedAttachmentIds.length - 1] ||
            effectiveDigitalAttachmentId;
          setPendingDigitalFiles([]);
          setDigitalAttachmentNotice(null);
          await loadData();
        }
      }

      if (
        detail.type === "DOCUMENT" &&
        targetStatus === "DONE" &&
        documentDeliveryMethod === "PICKUP" &&
        pendingPickupImageFiles.length > 0
      ) {
        setUploadingDigitalDocuments(true);
        for (const file of pendingPickupImageFiles) {
          const validation = validatePickupMediaFile(file);
          if (!validation.ok) {
            throw new ApiError(400, null, validation.message);
          }
          const pickupFileKind = validation.mimeType.startsWith("video/")
            ? "VIDEO"
            : "IMAGE";

          const uploadTicket = await issueAdminAttachmentUploadTicket(detail.id, {
            fileKind: pickupFileKind,
            fileName: file.name,
            mimeType: validation.mimeType,
            fileSize: file.size,
          });

          await uploadFileToPresignedUrl(uploadTicket, file);
          await completeAdminAttachmentUpload(
            detail.id,
            uploadTicket.uploadToken,
            operatorId,
          );
        }

        setPendingPickupImageFiles([]);
        setPickupImageNotice(null);
        await loadData();
      }

      const result = await updateAdminRequestStatus(detail.id, {
        status: targetStatus,
        operatorId,
        note: note.trim() || undefined,
        pickupNote: pickupNote.trim() || undefined,
        digitalFileAttachmentId: effectiveDigitalAttachmentId || undefined,
      });
      if (result.magicLink?.url) {
        setMessengerMagicLink({
          url: result.magicLink.url,
          expiresAt: result.magicLink.expiresAt,
        });
        setMagicLinkCopyState("idle");
      } else if (detail.type === "MESSENGER") {
        setMessengerMagicLink(null);
        setMagicLinkCopyState("idle");
      }
      setNote("");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "อัปเดตสถานะคำขอไม่สำเร็จ",
      );
    } finally {
      setUploadingDigitalDocuments(false);
      setSubmittingStatus(false);
      setShowConfirmUpdateStatus(false);
    }
  };

  const handleUpdateStatus = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!validateStatusUpdate()) return;
    setShowConfirmUpdateStatus(true);
  };

  const handleUploadDigitalDocuments = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    if (!detail) return;

    const selectedFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (selectedFiles.length === 0) return;

    const remainingSlots =
      MAX_DIGITAL_DOCUMENT_UPLOADS -
      adminDocumentAttachmentCount -
      pendingDigitalFiles.length;
    if (remainingSlots <= 0) {
      setErrorMessage(
        `อัปโหลดไฟล์เอกสารดิจิทัลได้สูงสุด ${MAX_DIGITAL_DOCUMENT_UPLOADS} ไฟล์`,
      );
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    const skippedCount = selectedFiles.length - filesToAdd.length;
    const validationMessages: string[] = [];
    const nextPendingFiles = [...pendingDigitalFiles];

    for (const file of filesToAdd) {
      const isDuplicate = nextPendingFiles.some(
        (existingFile) => getFileKey(existingFile) === getFileKey(file),
      );
      if (isDuplicate) {
        validationMessages.push(`ข้ามไฟล์ซ้ำ: ${file.name}`);
        continue;
      }
      const validation = validateDigitalDocumentFile(file);
      if (!validation.ok) {
        validationMessages.push(validation.message);
        continue;
      }
      nextPendingFiles.push(file);
    }

    if (nextPendingFiles.length === pendingDigitalFiles.length) {
      setDigitalAttachmentNotice(validationMessages[0] ?? "ไม่พบไฟล์ที่เลือกได้");
      return;
    }

    setPendingDigitalFiles(nextPendingFiles);
    setFieldErrors((prev) => ({ ...prev, digitalAttachments: undefined }));

    const feedbackMessages: string[] = [];
    if (skippedCount > 0) {
      feedbackMessages.push(
        `อัปโหลดได้สูงสุด ${MAX_DIGITAL_DOCUMENT_UPLOADS} ไฟล์ ข้ามไป ${skippedCount} ไฟล์`,
      );
    }
    feedbackMessages.push(...validationMessages);
    setDigitalAttachmentNotice(feedbackMessages[0] ?? null);
  };

  const handleRemovePendingDigitalFile = (targetKey: string) => {
    setPendingDigitalFiles((prev) =>
      prev.filter((file) => getFileKey(file) !== targetKey),
    );
  };

  const handleUploadPickupImages = (event: ChangeEvent<HTMLInputElement>) => {
    if (!detail) return;

    const selectedFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (selectedFiles.length === 0) return;

    const remainingSlots =
      MAX_PICKUP_MEDIA_UPLOADS -
      detail.attachments.length -
      pendingPickupImageFiles.length;
    if (remainingSlots <= 0) {
      setErrorMessage(
        `อัปโหลดไฟล์ประกอบได้สูงสุด ${MAX_PICKUP_MEDIA_UPLOADS} ไฟล์`,
      );
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    const skippedCount = selectedFiles.length - filesToAdd.length;
    const validationMessages: string[] = [];
    const nextPendingFiles = [...pendingPickupImageFiles];

    for (const file of filesToAdd) {
      const isDuplicate = nextPendingFiles.some(
        (existingFile) => getFileKey(existingFile) === getFileKey(file),
      );
      if (isDuplicate) {
        validationMessages.push(`ข้ามไฟล์ซ้ำ: ${file.name}`);
        continue;
      }
      const validation = validatePickupMediaFile(file);
      if (!validation.ok) {
        validationMessages.push(validation.message);
        continue;
      }
      nextPendingFiles.push(file);
    }

    if (nextPendingFiles.length === pendingPickupImageFiles.length) {
      setPickupImageNotice(validationMessages[0] ?? "ไม่พบไฟล์ที่เลือกได้");
      return;
    }

    setPendingPickupImageFiles(nextPendingFiles);

    const feedbackMessages: string[] = [];
    if (skippedCount > 0) {
      feedbackMessages.push(
        `อัปโหลดได้สูงสุด ${MAX_PICKUP_MEDIA_UPLOADS} ไฟล์ ข้ามไป ${skippedCount} ไฟล์`,
      );
    }
    feedbackMessages.push(...validationMessages);
    setPickupImageNotice(feedbackMessages[0] ?? null);
  };

  const handleRemovePendingPickupImage = (targetKey: string) => {
    setPendingPickupImageFiles((prev) =>
      prev.filter((file) => getFileKey(file) !== targetKey),
    );
  };

  const handlePendingDocumentAction = (preview: PendingFilePreview) => {
    if (preview.mimeType.toLowerCase() === "application/pdf") {
      setDocumentPreview({
        attachmentId: `pending-${preview.key}`,
        fileName: preview.file.name,
        url: preview.previewUrl,
        mimeType: preview.mimeType,
      });
      return;
    }

    const link = document.createElement("a");
    link.href = preview.previewUrl;
    link.download = preview.file.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMagicLink = async () => {
    if (!messengerMagicLink?.url) return;
    try {
      await navigator.clipboard.writeText(messengerMagicLink.url);
      setMagicLinkCopyState("copied");
    } catch {
      setMagicLinkCopyState("failed");
    }
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!detail) return;
    setDownloadingAttachmentId(attachmentId);
    setErrorMessage(null);
    try {
      const result = await getAdminAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "download",
      );
      await downloadFileFromPresignedUrl({
        downloadUrl: result.downloadUrl,
        fallbackFileName: result.fileName,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถเตรียมลิงก์ดาวน์โหลดไฟล์แนบได้",
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handlePreviewVideoAttachment = async (
    attachmentId: string,
    fileName: string,
  ) => {
    if (!detail) return;
    setPreviewingAttachmentId(attachmentId);
    setErrorMessage(null);
    try {
      const result = await getAdminAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "inline",
      );
      setVideoPreview({ attachmentId, fileName, url: result.downloadUrl });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถเตรียมลิงก์พรีวิวไฟล์แนบได้",
      );
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const handlePreviewImageAttachment = async (
    attachmentId: string,
    fileName: string,
  ) => {
    if (!detail) return;
    setPreviewingAttachmentId(attachmentId);
    setErrorMessage(null);
    try {
      const result = await getAdminAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "inline",
      );
      setImagePreview({ attachmentId, fileName, url: result.downloadUrl });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถเตรียมลิงก์พรีวิวไฟล์แนบได้",
      );
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const handleDocumentAttachmentAction = async (
    attachmentId: string,
    fileName: string,
    mimeType: string,
  ) => {
    if (mimeType !== "application/pdf") {
      await handleDownloadAttachment(attachmentId);
      return;
    }
    if (!detail) return;
    setPreviewingAttachmentId(attachmentId);
    setErrorMessage(null);
    try {
      const result = await getAdminAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "inline",
      );
      setDocumentPreview({
        attachmentId,
        fileName,
        url: result.downloadUrl,
        mimeType,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถเตรียมลิงก์พรีวิวไฟล์แนบได้",
      );
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const handleCopyRequestNo = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.requestNo);
      setCopiedRequestNo(true);
      window.setTimeout(() => setCopiedRequestNo(false), 1500);
    } catch {
      setErrorMessage("คัดลอกเลขคำขอไม่สำเร็จ");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-8 md:px-6 lg:px-8">
      {/* ── PAGE HEADER ── */}
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
              รายละเอียดคำขอผู้ดูแลระบบ
            </h1>
            <p className="mt-1 text-sm text-white/65">
              ตรวจสอบข้อมูลคำขอ จัดการสถานะ และติดตามการดำเนินงาน
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            <div className="relative flex items-center gap-2.5 rounded-2xl border border-white/30 bg-gradient-to-r from-white/20 via-white/15 to-white/10 px-4 py-2.5 shadow-[0_12px_24px_-16px_rgba(2,6,23,0.9)] backdrop-blur-sm">
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              <span className="text-sm font-semibold tracking-wide text-white/95">
                {detail ? `เลขที่คำขอ ${detail.requestNo}` : "กำลังโหลดคำขอ..."}
              </span>
              {detail ? <StatusBadge status={detail.status} /> : null}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                รีเฟรช
              </button>
              <Link
                href="/admin/requests"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                ไปที่รายการคำขอ
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

      {/* ── LOADING ── */}
      {loading && (
        <>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </>
      )}

      {/* ── ERROR ── */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/30 bg-[#b62026]/5 px-4 py-3.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b62026] text-[10px] font-bold text-white">
            !
          </span>
          <p className="text-sm font-medium text-[#b62026]">{errorMessage}</p>
        </div>
      )}

      {!loading && detail && (
        <>
          {/* ── REQUEST OVERVIEW ── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)]">

            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Request identity */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0e2d4c]/8 text-[#0e2d4c]">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d={requestTypeIcon[detail.type]}
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {requestTypeLabelMap[detail.type]}
                      </span>
                      <StatusBadge status={detail.status} />
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${urgencyConfig[detail.urgency].className}`}
                      >
                        {urgencyConfig[detail.urgency].label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-[#0e2d4c]">
                        {detail.requestNo}
                      </h2>
                      <button
                        type="button"
                        onClick={() => void handleCopyRequestNo()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#0e2d4c]/30 hover:bg-[#0e2d4c]/5 hover:text-[#0e2d4c] active:scale-95"
                      >
                        {copiedRequestNo ? (
                          <>
                            <svg
                              className="h-3.5 w-3.5 text-emerald-500"
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
                            คัดลอกแล้ว
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
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            คัดลอกเลขคำขอ
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {detail.employeeName}
                      <span className="mx-2 text-[#0e2d4c]/25">|</span>
                      {formatPhoneDisplay(detail.phone)}
                      <span className="mx-2 text-[#0e2d4c]/25">|</span>
                      {detail.department.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta stats */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[ 
                  {
                    label: "วันที่สร้าง",
                    value: formatDateTime(detail.createdAt),
                    icon: "M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z",
                  },
                  {
                    label: "กิจกรรมล่าสุด",
                    value: formatDateTime(detail.latestActivityAt),
                    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                  },
                  {
                    label: "แผนก",
                    value: detail.department.name,
                    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
                  },
                  {
                    label: "สถานะปัจจุบัน",
                    value: statusLabelMap[detail.status],
                    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
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
                          d={stat.icon}
                        />
                      </svg>
                      {stat.label}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#0e2d4c]">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes/Alerts */}
            {(detail.cancelReason || detail.hrCloseNote) && (
              <div className="space-y-2 border-t border-slate-200 p-5 pt-4">
                {detail.cancelReason && (
                  <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/20 bg-[#b62026]/[0.06] px-4 py-3">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#b62026]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#b62026]/80">
                        เหตุผลการยกเลิก
                      </p>
                      <p className="mt-0.5 text-sm text-[#b62026]">
                        {detail.cancelReason}
                      </p>
                    </div>
                  </div>
                )}
                {detail.hrCloseNote && (
                  <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
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
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-indigo-600/80">
                        หมายเหตุปิดงาน HR
                      </p>
                      <p className="mt-0.5 text-sm text-indigo-800">
                        {detail.hrCloseNote}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── FORM DATA ── */}
          <SectionCard
            title="ข้อมูลจากแบบฟอร์ม"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            accent="navy"
          >
            {detail.type === "BUILDING" && detail.buildingRepairDetail && (
              <InfoGrid>
                <InfoCell
                  label="อาคาร"
                  value={formatBuildingSideLabel(detail.buildingRepairDetail.building)}
                />
                <InfoCell
                  label="ชั้น"
                  value={detail.buildingRepairDetail.floor}
                />
                <InfoCell
                  label="จุดที่พบปัญหา"
                  value={detail.buildingRepairDetail.locationDetail}
                  full
                />
                <InfoCell
                  label="หมวดปัญหา"
                  value={detail.buildingRepairDetail.problemCategory.name}
                />
                {hasText(detail.buildingRepairDetail.problemCategoryOther) && (
                  <InfoCell
                    label="หมวดปัญหา (อื่นๆ)"
                    value={detail.buildingRepairDetail.problemCategoryOther}
                  />
                )}
                {detail.buildingRepairDetail.problemCategory.helperText && (
                  <InfoCell
                    label="คำแนะนำเบื้องต้น"
                    value={
                      detail.buildingRepairDetail.problemCategory.helperText
                    }
                  />
                )}
                <InfoCell
                  label="อาการที่พบ"
                  value={detail.buildingRepairDetail.description}
                  full
                />
                {detail.buildingRepairDetail.additionalDetails && (
                  <InfoCell
                    label="ข้อมูลเพิ่มเติม"
                    value={detail.buildingRepairDetail.additionalDetails}
                    full
                  />
                )}
              </InfoGrid>
            )}

            {detail.type === "VEHICLE" && detail.vehicleRepairDetail && (
              <InfoGrid>
                <InfoCell
                  label="ทะเบียนรถ"
                  value={detail.vehicleRepairDetail.vehiclePlate}
                />
                <InfoCell
                  label="หมวดปัญหา"
                  value={detail.vehicleRepairDetail.issueCategory.name}
                />
                {hasText(detail.vehicleRepairDetail.issueCategoryOther) && (
                  <InfoCell
                    label="หมวดปัญหา (อื่นๆ)"
                    value={detail.vehicleRepairDetail.issueCategoryOther}
                  />
                )}
                <InfoCell
                  label="อาการที่พบ"
                  value={detail.vehicleRepairDetail.symptom}
                  full
                />
                {detail.vehicleRepairDetail.additionalDetails && (
                  <InfoCell
                    label="ข้อมูลเพิ่มเติม"
                    value={detail.vehicleRepairDetail.additionalDetails}
                    full
                  />
                )}
              </InfoGrid>
            )}

            {detail.type === "MESSENGER" && detail.messengerBookingDetail && (
              <InfoGrid>
                <InfoCell
                  label="วันที่จัดส่ง"
                  value={formatDateOnlyThai(
                    detail.messengerBookingDetail.pickupDatetime,
                  )}
                />
                <InfoCell
                  label="ประเภทสิ่งของ"
                  value={formatMessengerItemTypeLabel(
                    detail.messengerBookingDetail.itemType,
                  )}
                />
                <InfoCell
                  label="รายละเอียดสิ่งของ"
                  value={detail.messengerBookingDetail.itemDescription}
                  full
                />
                {formatDeliveryServiceLabel(
                  detail.messengerBookingDetail.deliveryService,
                ) && (
                  <InfoCell
                    label="บริการจัดส่ง"
                    value={formatDeliveryServiceLabel(
                      detail.messengerBookingDetail.deliveryService,
                    )}
                  />
                )}
                {detail.messengerBookingDetail.deliveryService
                  ?.trim()
                  .toUpperCase() === "OTHER" &&
                  hasText(
                    detail.messengerBookingDetail.deliveryServiceOther,
                  ) && (
                    <InfoCell
                      label="รายละเอียดบริการจัดส่ง (อื่นๆ)"
                      value={detail.messengerBookingDetail.deliveryServiceOther}
                    />
                  )}
                <InfoCell
                  label="พื้นที่จัดส่ง"
                  value={
                    detail.messengerBookingDetail.outsideBkkMetro
                      ? "นอกเขตกรุงเทพฯ และปริมณฑล"
                      : "ในเขตกรุงเทพฯ และปริมณฑล"
                  }
                />
                <InfoCell
                  label="ปลายทาง"
                  full
                  value={
                    <div className="space-y-0.5">
                      <p className="font-semibold">
                        {detail.messengerBookingDetail.receiverAddress.name} ·{" "}
                        {formatPhoneDisplay(
                          detail.messengerBookingDetail.receiverAddress.phone,
                        )}
                      </p>
                      <p className="text-[#0e2d4c]/60">
                        {formatAddress(
                          detail.messengerBookingDetail.receiverAddress,
                        )}
                      </p>
                      {detail.messengerBookingDetail.receiverAddress.extra && (
                        <p className="text-[#0e2d4c]/60">
                          {detail.messengerBookingDetail.receiverAddress.extra}
                        </p>
                      )}
                    </div>
                  }
                />
              </InfoGrid>
            )}

            {detail.type === "DOCUMENT" && detail.documentRequestDetail && (
              <InfoGrid>
                <InfoCell
                  label="ไซต์งาน"
                  value={detail.documentRequestDetail.siteNameRaw}
                />
                <InfoCell
                  label="วันที่ต้องการใช้"
                  value={formatDateOnlyThai(
                    detail.documentRequestDetail.neededDate,
                  )}
                />
                <InfoCell
                  label="เอกสารที่ต้องการ"
                  value={detail.documentRequestDetail.documentDescription}
                  full
                />
                <InfoCell
                  label="วัตถุประสงค์"
                  value={detail.documentRequestDetail.purpose}
                  full
                />
                {hasText(detail.documentRequestDetail.note) && (
                  <InfoCell
                    label="หมายเหตุจากผู้ขอ"
                    value={detail.documentRequestDetail.note}
                    full
                  />
                )}
                <InfoCell
                  label="วิธีรับเอกสาร"
                  value={
                    documentDeliveryMethodLabelMap[
                      detail.documentRequestDetail.deliveryMethod
                    ]
                  }
                />
                {detail.documentRequestDetail.deliveryMethod === "DIGITAL" &&
                  detail.documentRequestDetail.digitalFileAttachment && (
                    <InfoCell
                      label="ไฟล์ดิจิทัลที่แนบ"
                      value={
                        detail.documentRequestDetail.digitalFileAttachment
                          .fileName
                      }
                    />
                  )}
                {detail.documentRequestDetail.deliveryMethod === "PICKUP" &&
                  detail.documentRequestDetail.pickupNote && (
                    <InfoCell
                      label="หมายเหตุการรับด้วยตนเอง"
                      value={detail.documentRequestDetail.pickupNote}
                      full
                    />
                  )}
                {detail.documentRequestDetail.deliveryMethod === "POSTAL" &&
                  detail.documentRequestDetail.deliveryAddress && (
                    <InfoCell
                      label="ที่อยู่จัดส่ง"
                      full
                      value={
                        <div className="space-y-0.5">
                          <p className="font-semibold">
                            {detail.documentRequestDetail.deliveryAddress.name}{" "}
                            ·{" "}
                            {formatPhoneDisplay(
                              detail.documentRequestDetail.deliveryAddress
                                .phone,
                            )}
                          </p>
                          <p className="text-[#0e2d4c]/60">
                            {formatAddress(
                              detail.documentRequestDetail.deliveryAddress,
                            )}
                          </p>
                          {detail.documentRequestDetail.deliveryAddress
                            .extra && (
                            <p className="text-[#0e2d4c]/60">
                              {
                                detail.documentRequestDetail.deliveryAddress
                                  .extra
                              }
                            </p>
                          )}
                        </div>
                      }
                    />
                  )}
              </InfoGrid>
            )}
          </SectionCard>

          <div className="flex flex-col gap-5">
          {/* ── STATUS MANAGEMENT ── */}
          <div className="order-2">
          <SectionCard
            title="จัดการสถานะ"
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            accent="red"
          >
            {availableTransitions.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#0e2d4c]/[0.04] px-4 py-3.5 text-sm text-[#0e2d4c]/60">
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                คำขอนี้อยู่ในสถานะสุดท้ายแล้ว ไม่สามารถเปลี่ยนสถานะได้อีก
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleUpdateStatus} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="targetStatus" required>
                      สถานะถัดไป
                    </FieldLabel>
                    <SelectWrapper>
                      <select
                        id="targetStatus"
                        required
                        value={targetStatus}
                        aria-invalid={Boolean(fieldErrors.targetStatus)}
                        className={selectClass}
                        onChange={(e) => {
                          const nextStatus =
                            e.target.value as AdminRequestStatus;
                          setTargetStatus(nextStatus);
                          setFieldErrors((prev) => ({
                            ...prev,
                            targetStatus: undefined,
                            digitalAttachments: undefined,
                            note:
                              nextStatus === "REJECTED" ||
                              nextStatus === "CANCELED"
                                ? prev.note
                                : undefined,
                          }));
                        }}
                      >
                        <option value="">เลือกสถานะ</option>
                        {availableTransitions.map((s) => (
                          <option key={s} value={s}>
                            {statusLabelMap[s]}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                    {fieldErrors.targetStatus ? (
                      <FieldError message={fieldErrors.targetStatus} />
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel htmlFor="operatorId" required>
                      ผู้ดำเนินการ
                    </FieldLabel>
                    <SelectWrapper>
                      <select
                        id="operatorId"
                        required
                        value={operatorId}
                        className={selectClass}
                        onChange={(e) => setOperatorId(e.target.value)}
                      >
                        <option value="">เลือกผู้ดำเนินการ</option>
                        {operators.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.displayName}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="note" required={noteRequired}>
                    หมายเหตุ
                  </FieldLabel>
                  <textarea
                    id="note"
                    rows={3}
                    required={noteRequired}
                    maxLength={2000}
                    aria-invalid={Boolean(fieldErrors.note)}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        note: undefined,
                      }));
                    }}
                    placeholder={
                      noteRequired
                        ? "กรุณาระบุหมายเหตุ (จำเป็นสำหรับปฏิเสธ/ยกเลิก)"
                        : "หมายเหตุเพิ่มเติม (ถ้ามี)"
                    }
                    className={inputClass + " resize-none"}
                  />
                  {fieldErrors.note ? (
                    <FieldError message={fieldErrors.note} />
                  ) : null}
                </div>

                {detail.type === "DOCUMENT" &&
                  targetStatus === "DONE" &&
                  documentDeliveryMethod === "PICKUP" && (
                    <div className="space-y-3">
                      <div>
                        <FieldLabel htmlFor="pickupNote" required>
                          หมายเหตุการรับด้วยตนเอง
                        </FieldLabel>
                        <input
                          id="pickupNote"
                          type="text"
                          required
                          value={pickupNote}
                          maxLength={500}
                          onChange={(e) => setPickupNote(e.target.value)}
                          placeholder="จุดรับเอกสารและเวลานัดรับ"
                          className={inputClass}
                        />
                      </div>

                      <label
                        htmlFor="pickupImageUpload"
                        className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-7 text-center transition-colors duration-150 hover:border-[#0e2d4c]/30 hover:bg-slate-50/60"
                      >
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
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-[#0e2d4c]">
                            แนบรูปจุดรับเอกสาร (ไม่บังคับ)
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            รูปภาพ/วิดีโอ &nbsp;|&nbsp; สูงสุด {MAX_PICKUP_MEDIA_UPLOADS}{" "}
                            ไฟล์ · ไม่เกิน{" "}
                            {formatFileSize(MAX_PICKUP_MEDIA_FILE_SIZE_BYTES)}
                            /ไฟล์
                          </p>
                        </div>
                        <input
                          id="pickupImageUpload"
                          type="file"
                          multiple
                          accept={PICKUP_MEDIA_ACCEPT}
                          disabled={uploadingDigitalDocuments}
                          onChange={handleUploadPickupImages}
                          className="sr-only"
                        />
                      </label>

                      {pickupImageNotice ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                          <svg
                            className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {pickupImageNotice}
                        </div>
                      ) : null}

                      {pendingPickupFilePreviews.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {pendingPickupFilePreviews.map((preview) => {
                            const extensionLabel =
                              preview.file.name.split(".").pop()?.toUpperCase() ??
                              preview.fileKind;
                            const badgeClass =
                              preview.fileKind === "IMAGE"
                                ? "bg-blue-100 text-blue-700"
                                : preview.fileKind === "VIDEO"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-slate-200 text-slate-600";

                            return (
                              <li
                                key={preview.key}
                                className="flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                              >
                                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                                  >
                                    {extensionLabel}
                                  </span>
                                  <p
                                    className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
                                    title={preview.file.name}
                                  >
                                    {preview.file.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemovePendingPickupImage(preview.key)
                                    }
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-sm transition hover:bg-red-600 hover:text-white"
                                    aria-label={`ลบ ${preview.file.name}`}
                                    title={`ลบ ${preview.file.name}`}
                                  >
                                    <svg
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>

                                <div className="p-2.5">
                                  {preview.fileKind === "IMAGE" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setImagePreview({
                                          attachmentId: `pending-${preview.key}`,
                                          fileName: preview.file.name,
                                          url: preview.previewUrl,
                                        })
                                      }
                                      className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={preview.previewUrl}
                                        alt={preview.file.name}
                                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                                      />
                                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                                    </button>
                                  ) : null}

                                  {preview.fileKind === "VIDEO" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setVideoPreview({
                                          attachmentId: `pending-${preview.key}`,
                                          fileName: preview.file.name,
                                          url: preview.previewUrl,
                                        })
                                      }
                                      className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-100 bg-black"
                                    >
                                      <video
                                        className="h-full w-full object-cover opacity-60"
                                        muted
                                        playsInline
                                        preload="metadata"
                                      >
                                        <source
                                          src={preview.previewUrl}
                                          type={preview.mimeType}
                                        />
                                      </video>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow transition-transform group-hover:scale-110">
                                          <svg
                                            viewBox="0 0 24 24"
                                            className="h-4 w-4 translate-x-0.5 fill-[#0e2d4c]"
                                          >
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        </span>
                                      </div>
                                    </button>
                                  ) : null}
                                </div>

                                <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                                  {formatFileSizeMbShort(preview.file.size)}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )}

                {detail.type === "DOCUMENT" &&
                  targetStatus === "DONE" &&
                  documentDeliveryMethod === "DIGITAL" && (
                    <div className="space-y-3">
                      <label
                        htmlFor="digitalDocumentUpload"
                        className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors duration-150 ${
                          fieldErrors.digitalAttachments
                            ? "border-[#b62026]/40 bg-red-50/40"
                            : "border-slate-300 bg-white hover:border-[#0e2d4c]/30 hover:bg-slate-50/60"
                        }`}
                      >
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
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-[#0e2d4c]">
                            แตะเพื่อเลือกไฟล์{" "}
                            <span className="text-[#b62026]">*</span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            เอกสาร &nbsp;|&nbsp; สูงสุด{" "}
                            {MAX_DIGITAL_DOCUMENT_UPLOADS} ไฟล์ · ไม่เกิน{" "}
                            {formatFileSize(
                              MAX_DIGITAL_DOCUMENT_FILE_SIZE_BYTES,
                            )}
                            /ไฟล์
                          </p>
                        </div>
                        <input
                          id="digitalDocumentUpload"
                          type="file"
                          multiple
                          accept={DIGITAL_DOCUMENT_ACCEPT}
                          disabled={uploadingDigitalDocuments}
                          onChange={handleUploadDigitalDocuments}
                          className="sr-only"
                        />
                      </label>

                      {fieldErrors.digitalAttachments ? (
                        <FieldError message={fieldErrors.digitalAttachments} />
                      ) : null}

                      {digitalAttachmentNotice ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                          <svg
                            className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {digitalAttachmentNotice}
                        </div>
                      ) : null}

                      {pendingDigitalFilePreviews.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {pendingDigitalFilePreviews.map((preview) => {
                            const extensionLabel =
                              preview.file.name.split(".").pop()?.toUpperCase() ??
                              "DOC";
                            return (
                              <li
                                key={preview.key}
                                className="flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                              >
                                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-600">
                                    {extensionLabel}
                                  </span>
                                  <p
                                    className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
                                    title={preview.file.name}
                                  >
                                    {preview.file.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemovePendingDigitalFile(preview.key)
                                    }
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-sm transition hover:bg-red-600 hover:text-white"
                                    aria-label={`ลบ ${preview.file.name}`}
                                    title={`ลบ ${preview.file.name}`}
                                  >
                                    <svg
                                      className="h-5 w-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>

                                <div className="p-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handlePendingDocumentAction(preview)}
                                    className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:border-[#0e2d4c]/20 hover:bg-[#0e2d4c]/5"
                                  >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0e2d4c]/10 text-[#0e2d4c]">
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="h-4 w-4 fill-current"
                                      >
                                        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                                        <path d="M14 2v5h5" className="fill-white/60" />
                                      </svg>
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className="truncate text-[11px] font-semibold leading-tight text-slate-800"
                                        title={preview.file.name}
                                      >
                                        {preview.file.name}
                                      </p>
                                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                        {getDocumentTypeLabel(
                                          preview.mimeType,
                                          preview.file.name,
                                        )}
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-md bg-[#0e2d4c] px-2 py-0.5 text-[10px] font-bold text-white">
                                      {preview.mimeType.toLowerCase() ===
                                      "application/pdf"
                                        ? "ดู"
                                        : "ดาวน์โหลด"}
                                    </span>
                                  </button>
                                </div>

                                <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                                  {formatFileSizeMbShort(preview.file.size)}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )}

                <button
                  type="submit"
                  disabled={submittingStatus || uploadingDigitalDocuments}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0e2d4c] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(14,45,76,0.3)] transition hover:bg-[#0e2d4c]/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingStatus ? (
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
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      อัปเดตสถานะ
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Magic Link */}
            {messengerMagicLink && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
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
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  ลิงก์สำหรับเมสเซนเจอร์
                </div>
                <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-emerald-700 ring-1 ring-emerald-200">
                  {messengerMagicLink.url}
                </p>
                <p className="mt-1.5 text-[11px] text-emerald-700">
                  หมดอายุ: {formatDateTime(messengerMagicLink.expiresAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyMagicLink()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    {magicLinkCopyState === "copied"
                      ? "คัดลอกแล้ว ✓"
                      : "คัดลอกลิงก์"}
                  </button>
                  <a
                    href={messengerMagicLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    เปิดลิงก์
                  </a>
                </div>
                {magicLinkCopyState === "failed" && (
                  <p className="mt-2 text-xs text-[#b62026]">
                    คัดลอกไม่สำเร็จ กรุณาคัดลอกลิงก์ด้วยตนเอง
                  </p>
                )}
              </div>
            )}
          </SectionCard>
          </div>

          {/* ── ATTACHMENTS ── */}
          <div className="order-1">
          <SectionCard
            title="ไฟล์แนบ"
            icon="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            accent="navy"
          >
            {detail.attachments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-3xl">📂</span>
                <p className="text-sm text-slate-500">ยังไม่มีไฟล์แนบ</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {detail.attachments.map((attachment) => {
                  const badgeLabel = getAttachmentExtensionLabel(
                    attachment.fileName,
                    attachment.fileKind,
                  );
                  const badgeClass = getAttachmentBadgeClass(
                    attachment.fileKind,
                  );
                  const documentType =
                    attachment.fileKind === "DOCUMENT"
                      ? getDocumentTypeLabel(
                          attachment.mimeType,
                          attachment.fileName,
                        )
                      : attachment.mimeType;
                  const previewUrl =
                    attachment.publicUrl ??
                    inlinePreviewUrlByAttachmentId[attachment.id] ??
                    null;
                  const hasPublicPreview = Boolean(previewUrl);

                  return (
                    <li
                      key={attachment.id}
                      className="flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                        >
                          {badgeLabel}
                        </span>
                        <p
                          className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDownloadAttachment(attachment.id)
                          }
                          disabled={downloadingAttachmentId === attachment.id}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c]/10 text-[#0e2d4c] shadow-sm transition hover:bg-[#0e2d4c] hover:text-white disabled:opacity-50"
                          aria-label={`ดาวน์โหลด ${attachment.fileName}`}
                          title={`ดาวน์โหลด ${attachment.fileName}`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="p-2.5">
                        {attachment.fileKind === "IMAGE" ? (
                          hasPublicPreview ? (
                            <button
                              type="button"
                              onClick={() =>
                                setImagePreview({
                                  attachmentId: attachment.id,
                                  fileName: attachment.fileName,
                                  url: previewUrl ?? "",
                                })
                              }
                              className="group relative block h-40 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewUrl ?? ""}
                                alt={attachment.fileName}
                                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewImageAttachment(
                                  attachment.id,
                                  attachment.fileName,
                                )
                              }
                              disabled={previewingAttachmentId === attachment.id}
                              className="flex h-40 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                            >
                              {previewingAttachmentId === attachment.id
                                ? "กำลังเตรียม..."
                                : "ดูตัวอย่างรูปภาพ"}
                            </button>
                          )
                        ) : null}

                        {attachment.fileKind === "VIDEO" ? (
                          hasPublicPreview ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewVideoAttachment(
                                  attachment.id,
                                  attachment.fileName,
                                )
                              }
                              className="group relative block h-40 w-full overflow-hidden rounded-lg border border-slate-100 bg-black"
                            >
                              <video
                                className="h-full w-full object-cover opacity-60"
                                muted
                                playsInline
                                preload="metadata"
                              >
                                  <source src={previewUrl ?? ""} type={attachment.mimeType} />
                              </video>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow transition-transform group-hover:scale-110">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 translate-x-0.5 fill-[#0e2d4c]"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </span>
                              </div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewVideoAttachment(
                                  attachment.id,
                                  attachment.fileName,
                                )
                              }
                              disabled={previewingAttachmentId === attachment.id}
                              className="flex h-40 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                            >
                              {previewingAttachmentId === attachment.id
                                ? "กำลังเตรียม..."
                                : "ดูตัวอย่างวิดีโอ"}
                            </button>
                          )
                        ) : null}

                        {attachment.fileKind === "DOCUMENT" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleDocumentAttachmentAction(
                                attachment.id,
                                attachment.fileName,
                                attachment.mimeType,
                              )
                            }
                            disabled={
                              downloadingAttachmentId === attachment.id ||
                              previewingAttachmentId === attachment.id
                            }
                            className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:border-[#0e2d4c]/20 hover:bg-[#0e2d4c]/5 disabled:opacity-60"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0e2d4c]/10 text-[#0e2d4c]">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4 fill-current"
                              >
                                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                                <path d="M14 2v5h5" className="fill-white/60" />
                              </svg>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-[11px] font-semibold leading-tight text-slate-800"
                                title={attachment.fileName}
                              >
                                {attachment.fileName}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                {documentType}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-md bg-[#0e2d4c] px-2 py-0.5 text-[10px] font-bold text-white">
                              {previewingAttachmentId === attachment.id ||
                              downloadingAttachmentId === attachment.id
                                ? "กำลังเตรียม..."
                                : attachment.mimeType === "application/pdf"
                                  ? "ดู"
                                  : "ดาวน์โหลด"}
                            </span>
                          </button>
                        ) : null}
                      </div>

                      <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                        {Math.max(attachment.fileSize / 1024 / 1024, 0.01).toFixed(
                          2,
                        )}{" "}
                        MB
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
          </div>
          </div>

          {/* ── TIMELINE ── */}
          <SectionCard
            title="ไทม์ไลน์กิจกรรม"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            accent="navy"
          >
            {detail.activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-[#0e2d4c]/35">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">ยังไม่มีกิจกรรม</p>
              </div>
            ) : (
              <ol className="relative space-y-0">
                {detail.activityLogs.map((log, index) => {
                  const cfg = getActivityConfig(log.action);
                  const isLast = index === detail.activityLogs.length - 1;
                  return (
                    <li key={log.id} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${cfg.color}`}
                        >
                          {cfg.icon}
                        </span>
                        {!isLast && (
                          <span
                            className="mt-1 w-[2px] flex-1 bg-gradient-to-b from-slate-200 to-slate-100"
                            style={{ minHeight: "1.5rem" }}
                          />
                        )}
                      </div>

                      <div
                        className={`mb-4 flex-1 rounded-xl border border-slate-100 bg-[#f8fafc] p-4 ${isLast ? "border-[#0e2d4c]/20 bg-[#0e2d4c]/[0.04]" : ""}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p
                            className={`text-sm font-bold ${isLast ? "text-[#0e2d4c]" : "text-slate-800"}`}
                          >
                            {cfg.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(log.createdAt)}
                          </p>
                        </div>

                        {(log.fromStatus || log.toStatus) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {log.fromStatus && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig[log.fromStatus as AdminRequestStatus]?.className ?? "bg-slate-100 text-slate-600"}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusConfig[log.fromStatus as AdminRequestStatus]?.dot ?? "bg-slate-400"}`}
                                />
                                {formatStatusLabel(
                                  log.fromStatus as AdminRequestStatus,
                                )}
                              </span>
                            )}
                            {log.fromStatus && log.toStatus && (
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
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            )}
                            {log.toStatus && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig[log.toStatus as AdminRequestStatus]?.className ?? "bg-slate-100 text-slate-600"}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusConfig[log.toStatus as AdminRequestStatus]?.dot ?? "bg-slate-400"}`}
                                />
                                {formatStatusLabel(log.toStatus as AdminRequestStatus)}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          {log.operator?.displayName ||
                            log.actorDisplayName ||
                            getActorRoleLabel(log.actorRole)}
                        </p>

                        {log.note && (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">
                              หมายเหตุ:{" "}
                            </span>
                            {log.note}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionCard>
        </>
      )}

      <ImagePreviewModal
        open={Boolean(imagePreview)}
        title={
          imagePreview ? `พรีวิวรูปภาพ: ${imagePreview.fileName}` : "พรีวิวรูปภาพ"
        }
        src={imagePreview?.url ?? ""}
        onClose={() => setImagePreview(null)}
      />
      <DocumentPreviewModal
        open={Boolean(documentPreview)}
        title={
          documentPreview
            ? `พรีวิวเอกสาร: ${documentPreview.fileName}`
            : "พรีวิวเอกสาร"
        }
        src={documentPreview?.url ?? ""}
        mimeType={documentPreview?.mimeType}
        onClose={() => setDocumentPreview(null)}
      />
      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={
          videoPreview
            ? `พรีวิววิดีโอ: ${videoPreview.fileName}`
            : "พรีวิววิดีโอ"
        }
        src={videoPreview?.url ?? ""}
        onClose={() => setVideoPreview(null)}
      />
      <ConfirmModal
        open={showConfirmUpdateStatus}
        title="ยืนยันการอัปเดตสถานะ"
        description="กรุณาตรวจสอบความถูกต้องก่อนยืนยันอัปเดตสถานะคำขอ"
        confirmLabel={submittingStatus ? "กำลังอัปเดต..." : "ยืนยันอัปเดตสถานะ"}
        cancelLabel="ยกเลิก"
        onClose={() => {
          if (submittingStatus) return;
          setShowConfirmUpdateStatus(false);
        }}
        onConfirm={() => void performUpdateStatus()}
      />
    </main>
  );
}
