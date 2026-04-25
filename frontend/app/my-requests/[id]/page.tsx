"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/guards/route-guard";
import { TextareaField } from "@/components/ui/form-controls";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { downloadFileFromPresignedUrl } from "@/lib/attachments/download";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import { ApiError } from "@/lib/api/client";
import { formatPhoneDisplay } from "@/lib/phone-format";
import {
  cancelMyRequest,
  getMyRequestAttachmentDownloadUrl,
  getMyRequestDetail,
  type RequestDetail,
  type RequestType,
  type RequestStatus,
  type Urgency,
} from "@/lib/api/my-requests";

// ─── Config ────────────────────────────────────────────────────────────────────

const cancellableStatuses: RequestStatus[] = ["NEW", "APPROVED"];

const statusConfig: Record<
  RequestStatus,
  { color: string; dot: string; label: string }
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
  { label: string; color: string; bg: string; icon: string }
> = {
  NORMAL: {
    label: "ปกติ",
    color: "text-slate-600",
    bg: "bg-slate-100",
    icon: "○",
  },
  HIGH: {
    label: "สูง",
    color: "text-amber-700 font-semibold",
    bg: "bg-amber-50 ring-1 ring-amber-200",
    icon: "▲",
  },
  CRITICAL: {
    label: "เร่งด่วน",
    color: "text-rose-700 font-bold",
    bg: "bg-rose-50 ring-1 ring-rose-200",
    icon: "⚡",
  },
};

const requestTypeLabelMap: Record<
  RequestType,
  { label: string; icon: string }
> = {
  BUILDING: { label: "อาคาร", icon: "🏢" },
  VEHICLE: { label: "รถยนต์", icon: "🚗" },
  MESSENGER: { label: "ส่งเอกสาร", icon: "📦" },
  DOCUMENT: { label: "เอกสาร", icon: "📄" },
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
  MESSENGER: "แมสเซนเจอร์",
};

const buildingSideLabelMap: Record<string, string> = {
  FRONT: "ด้านหน้า",
  BACK: "ด้านหลัง",
};

const itemTypeLabelMap: Record<string, string> = {
  DOCUMENT: "เอกสาร",
  PACKAGE: "พัสดุ",
};

const deliveryMethodLabelMap: Record<string, string> = {
  DIGITAL: "ดิจิทัล",
  POSTAL: "ไปรษณีย์",
  PICKUP: "รับด้วยตนเอง",
};

const deliveryServiceLabelMap: Record<string, string> = {
  POST: "ไปรษณีย์",
  NAKHONCHAI_AIR: "นครชัยแอร์",
  OTHER: "อื่น ๆ",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDateOnly(iso?: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(new Date(iso));
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

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
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

function getDeliveryServiceLabel(deliveryService: string | null) {
  if (!deliveryService) return "-";
  return deliveryServiceLabelMap[deliveryService] ?? deliveryService;
}

function formatAddressLine(address: {
  houseNo: string;
  soi: string | null;
  road: string | null;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  extra: string | null;
}) {
  return [
    `บ้านเลขที่ ${address.houseNo}`,
    hasText(address.soi) ? `ซอย ${address.soi}` : "",
    hasText(address.road) ? `ถนน ${address.road}` : "",
    `แขวง/ตำบล ${address.subdistrict}`,
    `เขต/อำเภอ ${address.district}`,
    `จังหวัด ${address.province}`,
    address.postalCode,
    hasText(address.extra) ? String(address.extra) : "",
  ]
    .filter((s) => s.trim().length > 0)
    .join(", ");
}

function hasMessengerShippingInfo(detail: RequestDetail) {
  const m = detail.messengerBookingDetail;
  if (!m) return false;
  return Boolean(
    m.deliveryService ||
    hasText(m.deliveryServiceOther) ||
    m.senderAddress ||
    m.receiverAddress,
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** ฟิลด์ข้อมูล label + value แบบ card */
function InfoField({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children ?? (
        <p className="text-sm font-semibold leading-relaxed text-[#0e2d4c]">
          {value ?? "-"}
        </p>
      )}
    </div>
  );
}

/** Section wrapper มี header bar สีบริษัท */
function SectionCard({
  title,
  icon,
  children,
  accent = "navy",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: "navy" | "red" | "yellow" | "emerald";
}) {
  const accentColor = {
    navy: "from-[#0e2d4c] to-[#163d64]",
    red: "from-[#b62026] to-[#d42a30]",
    yellow: "from-[#fed54f] to-[#fbbf24]",
    emerald: "from-emerald-600 to-emerald-500",
  }[accent];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)]">
      {/* header bar */}
      <div
        className={`flex items-center gap-3 bg-gradient-to-r ${accentColor} px-5 py-3.5`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white">
          {icon}
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">
          {title}
        </h2>
      </div>
      <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/40 to-white p-5 md:p-6">
        {children}
      </div>
    </section>
  );
}

/** Skeleton loader */
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

/** Address card */
function AddressBlock({
  label,
  name,
  phone,
  address,
}: {
  label: string;
  name: string;
  phone: string;
  address: Parameters<typeof formatAddressLine>[0];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm font-semibold text-[#0e2d4c]">{name}</p>
      <p className="mt-0.5 text-sm text-slate-600">
        {formatPhoneDisplay(phone)}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        {formatAddressLine(address)}
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard
      tokenType="employee"
      redirectTo="/auth/otp"
      nextPathOverride="/my-requests"
    >
      <MyRequestDetailContent />
    </RouteGuard>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────

function MyRequestDetailContent() {
  const params = useParams<{ id: string }>();
  const requestId = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

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

  const canCancel = useMemo(() => {
    if (!detail) return false;
    return cancellableStatuses.includes(detail.status);
  }, [detail]);

  useEffect(() => {
    if (!canCancel) setShowConfirmCancel(false);
  }, [canCancel]);

  const employeeAttachments = useMemo(() => {
    if (!detail) return [];
    return detail.attachments.filter((a) => a.uploadedByRole === "EMPLOYEE");
  }, [detail]);

  const adminDigitalDocumentAttachments = useMemo(() => {
    if (!detail) return [];
    if (detail.type !== "DOCUMENT") return [];
    if (detail.documentRequestDetail?.deliveryMethod !== "DIGITAL") return [];
    return detail.attachments.filter(
      (attachment) =>
        attachment.uploadedByRole === "ADMIN" &&
        attachment.fileKind === "DOCUMENT",
    );
  }, [detail]);

  const adminPickupMediaAttachments = useMemo(() => {
    if (!detail) return [];
    if (detail.type !== "DOCUMENT") return [];
    if (detail.documentRequestDetail?.deliveryMethod !== "PICKUP") return [];
    return detail.attachments.filter(
      (attachment) =>
        attachment.uploadedByRole === "ADMIN" &&
        (attachment.fileKind === "IMAGE" || attachment.fileKind === "VIDEO"),
    );
  }, [detail]);

  const visibleAttachments = useMemo(() => {
    if (!detail) return [];
    if (
      detail.type === "DOCUMENT" &&
      detail.documentRequestDetail?.deliveryMethod === "DIGITAL"
    ) {
      return adminDigitalDocumentAttachments;
    }
    if (
      detail.type === "DOCUMENT" &&
      detail.documentRequestDetail?.deliveryMethod === "PICKUP"
    ) {
      return adminPickupMediaAttachments;
    }
    return employeeAttachments;
  }, [
    adminDigitalDocumentAttachments,
    adminPickupMediaAttachments,
    detail,
    employeeAttachments,
  ]);

  useEffect(() => {
    setInlinePreviewUrlByAttachmentId({});
  }, [detail?.id]);

  useEffect(() => {
    if (!detail) return;

    const targetAttachments = visibleAttachments.filter(
      (attachment) =>
        (attachment.fileKind === "IMAGE" || attachment.fileKind === "VIDEO") &&
        !attachment.publicUrl,
    );

    if (targetAttachments.length === 0) return;

    let cancelled = false;

    void Promise.allSettled(
      targetAttachments.map(async (attachment) => {
        const result = await getMyRequestAttachmentDownloadUrl(
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
  }, [detail, visibleAttachments]);

  const latestActivityLog = useMemo(() => {
    if (!detail || detail.activityLogs.length === 0) return null;
    return detail.activityLogs[detail.activityLogs.length - 1];
  }, [detail]);

  const loadDetail = useCallback(async () => {
    if (!requestId) {
      setErrorMessage("รหัสคำขอไม่ถูกต้อง");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getMyRequestDetail(requestId);
      setDetail(result);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "โหลดรายละเอียดคำขอไม่สำเร็จ",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const performCancel = async () => {
    if (!detail) return;
    setCanceling(true);
    setErrorMessage(null);
    setShowConfirmCancel(false);
    try {
      await cancelMyRequest(detail.id, cancelReason.trim());
      setCancelReason("");
      await loadDetail();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "ยกเลิกคำขอไม่สำเร็จ",
      );
    } finally {
      setCanceling(false);
    }
  };

  const handleCancel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !canCancel) return;
    if (!cancelReason.trim()) {
      setErrorMessage("กรุณาระบุเหตุผลในการยกเลิก");
      return;
    }
    setShowConfirmCancel(true);
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!detail) return;
    setDownloadingAttachmentId(attachmentId);
    setErrorMessage(null);
    try {
      const result = await getMyRequestAttachmentDownloadUrl(
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
          : "สร้างลิงก์ดาวน์โหลดไฟล์แนบไม่สำเร็จ",
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
      const result = await getMyRequestAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "inline",
      );
      setVideoPreview({ attachmentId, fileName, url: result.downloadUrl });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "สร้างลิงก์พรีวิวไฟล์แนบไม่สำเร็จ",
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
      const result = await getMyRequestAttachmentDownloadUrl(
        detail.id,
        attachmentId,
        "inline",
      );
      setImagePreview({ attachmentId, fileName, url: result.downloadUrl });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "ไม่สามารถสร้างลิงก์พรีวิวไฟล์แนบได้",
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
      const result = await getMyRequestAttachmentDownloadUrl(
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
          : "ไม่สามารถสร้างลิงก์พรีวิวไฟล์แนบได้",
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 md:px-8">
        {/* ── Hero Header ───────────────────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-2xl shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e2d4c] via-[#163d64] to-[#0e2d4c]" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#b62026] via-[#fed54f] to-[#b62026]" />
          {/* texture */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #fed54f 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-8">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#fed54f]" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                  HR Buddy
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                รายละเอียดคำขอ
              </h1>
              <p className="mt-1 text-sm text-white/65">
                ดูรายละเอียดบริการ ไทม์ไลน์ ไฟล์แนบ และสถานะของคำขอนี้
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDetail()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
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
                รีเฟรช
              </button>
              <Link
                href="/my-requests"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
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
                กลับสู่หน้ารายการ
              </Link>
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

        {/* ── Loading Skeletons ─────────────────────────────────────────── */}
        {loading && (
          <>
            <SkeletonCard lines={5} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={6} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={4} />
          </>
        )}

        {/* ── Main Detail ───────────────────────────────────────────────── */}
        {!loading && detail && (
          <>
            {/* ── 1. Request Summary Card ──────────────────────────────── */}
            <SectionCard
              title="สรุปคำขอ"
              accent="navy"
              icon={
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
            >
              {/* ชื่อ + หมายเลข + badge สถานะ */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* icon ประเภท */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0e2d4c]/8 text-3xl">
                      {requestTypeLabelMap[detail.type]?.icon ?? "📋"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#0e2d4c]/50">
                        {requestTypeLabelMap[detail.type]?.label ?? detail.type}
                      </p>
                      <h2 className="text-xl font-bold text-[#0e2d4c] md:text-2xl">
                        {detail.requestNo}
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* badge สถานะ */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${statusConfig[detail.status].color}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${statusConfig[detail.status].dot}`}
                      />
                      {statusConfig[detail.status].label}
                    </span>
                    {/* ปุ่มคัดลอก */}
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
                </div>
              </div>

              {/* ตาราง info fields */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="ผู้ยื่นคำขอ" value={detail.employeeName} />
                <InfoField
                  label="เบอร์โทร"
                  value={formatPhoneDisplay(detail.phone)}
                />
                <InfoField label="ความเร่งด่วน">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ${urgencyConfig[detail.urgency].bg} ${urgencyConfig[detail.urgency].color}`}
                  >
                    <span>{urgencyConfig[detail.urgency].icon}</span>
                    {urgencyConfig[detail.urgency].label}
                  </span>
                </InfoField>
                <InfoField label="แผนก">
                  <p className="text-sm font-medium text-[#0e2d4c]">
                    {detail.department.name}
                  </p>
                  {hasText(detail.departmentOther) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      ระบุเพิ่มเติม: {detail.departmentOther}
                    </p>
                  )}
                </InfoField>
                <InfoField
                  label="วันที่สร้างคำขอ"
                  value={formatDateTime(detail.createdAt)}
                />
                <InfoField
                  label="วันที่ปิดคำขอ"
                  value={formatDateTime(detail.closedAt)}
                />
              </div>

              {/* หมายเหตุพิเศษ */}
              {detail.cancelReason && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#b62026]/25 bg-[#b62026]/5 p-4">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b62026] text-[10px] font-bold text-white">
                    ✕
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#b62026]">
                      เหตุผลการยกเลิก
                    </p>
                    <p className="mt-0.5 text-sm text-[#b62026]/80">
                      {detail.cancelReason}
                    </p>
                  </div>
                </div>
              )}
              {detail.hrCloseNote && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">
                      หมายเหตุปิดงานจาก HR
                    </p>
                    <p className="mt-0.5 text-sm text-indigo-700">
                      {detail.hrCloseNote}
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ── 2. Status Summary ─────────────────────────────────────── */}
            <SectionCard
              title="สรุปสถานะล่าสุด"
              accent="emerald"
              icon={
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoField label="สถานะปัจจุบัน">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${statusConfig[detail.status].color}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusConfig[detail.status].dot}`}
                    />
                    {statusConfig[detail.status].label}
                  </span>
                </InfoField>
                <InfoField label="กิจกรรมล่าสุด">
                  {latestActivityLog ? (
                    <>
                      <p className="text-sm font-semibold text-[#0e2d4c]">
                        {getActivityConfig(latestActivityLog.action).label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        โดย:{" "}
                        {latestActivityLog.operator?.displayName ||
                          latestActivityLog.actorDisplayName ||
                          getActorRoleLabel(latestActivityLog.actorRole)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">-</p>
                  )}
                </InfoField>
                <InfoField
                  label="อัปเดตเมื่อ"
                  value={formatDateTime(detail.updatedAt)}
                />
              </div>
            </SectionCard>

            {/* ── 3. Service Detail ─────────────────────────────────────── */}
            <SectionCard
              title="รายละเอียดบริการ"
              accent="navy"
              icon={
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            >
              {/* Building */}
              {detail.buildingRepairDetail && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField
                    label="อาคาร"
                    value={
                      buildingSideLabelMap[
                        detail.buildingRepairDetail.building
                      ] ?? detail.buildingRepairDetail.building
                    }
                  />
                  <InfoField
                    label="ชั้น"
                    value={detail.buildingRepairDetail.floor}
                  />
                  <InfoField
                    label="ตำแหน่ง"
                    value={detail.buildingRepairDetail.locationDetail}
                  />
                  <InfoField
                    label="หมวดปัญหา"
                    value={detail.buildingRepairDetail.problemCategory.name}
                  />
                  {hasText(
                    detail.buildingRepairDetail.problemCategoryOther,
                  ) && (
                    <InfoField
                      label="หมวดปัญหา (ระบุเพิ่มเติม)"
                      value={detail.buildingRepairDetail.problemCategoryOther!}
                    />
                  )}
                  <div className="sm:col-span-2">
                    <InfoField
                      label="รายละเอียดอาการ"
                      value={detail.buildingRepairDetail.description}
                    />
                  </div>
                  {hasText(detail.buildingRepairDetail.additionalDetails) && (
                    <div className="sm:col-span-2">
                      <InfoField
                        label="รายละเอียดเพิ่มเติม"
                        value={detail.buildingRepairDetail.additionalDetails!}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle */}
              {detail.vehicleRepairDetail && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField
                    label="ทะเบียนรถ"
                    value={detail.vehicleRepairDetail.vehiclePlate}
                  />
                  <InfoField
                    label="หมวดปัญหา"
                    value={detail.vehicleRepairDetail.issueCategory.name}
                  />
                  {hasText(detail.vehicleRepairDetail.issueCategoryOther) && (
                    <InfoField
                      label="หมวดปัญหา (ระบุเพิ่มเติม)"
                      value={detail.vehicleRepairDetail.issueCategoryOther!}
                    />
                  )}
                  <div className="sm:col-span-2">
                    <InfoField
                      label="อาการ"
                      value={detail.vehicleRepairDetail.symptom}
                    />
                  </div>
                  {hasText(detail.vehicleRepairDetail.additionalDetails) && (
                    <div className="sm:col-span-2">
                      <InfoField
                        label="รายละเอียดเพิ่มเติม"
                        value={detail.vehicleRepairDetail.additionalDetails!}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Messenger */}
              {detail.messengerBookingDetail && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoField
                      label="วันที่จัดส่ง"
                      value={formatDateOnly(
                        detail.messengerBookingDetail.pickupDatetime,
                      )}
                    />
                    <InfoField
                      label="ประเภทสิ่งของ"
                      value={
                        itemTypeLabelMap[
                          detail.messengerBookingDetail.itemType
                        ] ?? detail.messengerBookingDetail.itemType
                      }
                    />
                    <InfoField
                      label="รายละเอียดสิ่งของ"
                      value={detail.messengerBookingDetail.itemDescription}
                    />
                    <InfoField
                      label="นอกเขตกรุงเทพฯและปริมณฑล"
                      value={
                        detail.messengerBookingDetail.outsideBkkMetro
                          ? "ใช่"
                          : "ไม่ใช่"
                      }
                    />
                  </div>

                  {hasMessengerShippingInfo(detail) && (
                    <div className="rounded-xl border border-[#0e2d4c]/[0.15] bg-[#0e2d4c]/[0.04] p-4">
                      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0e2d4c]">
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
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                        ข้อมูลการจัดส่ง
                      </p>
                      <div className="space-y-4">
                        <InfoField label="บริการขนส่ง">
                          <p className="text-sm font-medium text-[#0e2d4c]">
                            {getDeliveryServiceLabel(
                              detail.messengerBookingDetail.deliveryService,
                            )}
                          </p>
                          {hasText(
                            detail.messengerBookingDetail.deliveryServiceOther,
                          ) && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {
                                detail.messengerBookingDetail
                                  .deliveryServiceOther
                              }
                            </p>
                          )}
                        </InfoField>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {detail.messengerBookingDetail.senderAddress && (
                            <div
                              className={
                                detail.messengerBookingDetail.receiverAddress
                                  ? ""
                                  : "lg:col-span-2"
                              }
                            >
                              <AddressBlock
                                label="ที่อยู่ผู้ส่ง"
                                name={
                                  detail.messengerBookingDetail.senderAddress
                                    .name
                                }
                                phone={
                                  detail.messengerBookingDetail.senderAddress
                                    .phone
                                }
                                address={
                                  detail.messengerBookingDetail.senderAddress
                                }
                              />
                            </div>
                          )}
                          {detail.messengerBookingDetail.receiverAddress && (
                            <div
                              className={
                                detail.messengerBookingDetail.senderAddress
                                  ? ""
                                  : "lg:col-span-2"
                              }
                            >
                              <AddressBlock
                                label="ที่อยู่ผู้รับ"
                                name={
                                  detail.messengerBookingDetail.receiverAddress
                                    .name
                                }
                                phone={
                                  detail.messengerBookingDetail.receiverAddress
                                    .phone
                                }
                                address={
                                  detail.messengerBookingDetail.receiverAddress
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document */}
              {detail.documentRequestDetail &&
                (() => {
                  const doc = detail.documentRequestDetail;
                  return (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoField label="ไซต์งาน" value={doc.siteNameRaw} />
                        <InfoField
                          label="วิธีรับเอกสาร"
                          value={
                            deliveryMethodLabelMap[doc.deliveryMethod] ??
                            doc.deliveryMethod
                          }
                        />
                        <div className="sm:col-span-2">
                          <InfoField
                            label="เอกสารที่ต้องการ"
                            value={doc.documentDescription}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <InfoField label="วัตถุประสงค์" value={doc.purpose} />
                        </div>
                        {hasText(doc.note) && (
                          <div className="sm:col-span-2">
                            <InfoField label="หมายเหตุ" value={doc.note!} />
                          </div>
                        )}
                        {hasText(doc.pickupNote) && (
                          <div className="sm:col-span-2">
                            <InfoField
                              label="หมายเหตุการรับเอกสาร"
                              value={doc.pickupNote!}
                            />
                          </div>
                        )}
                      </div>

                      {/* ที่อยู่จัดส่ง */}
                      {doc.deliveryMethod === "POSTAL" &&
                        doc.deliveryAddress && (
                          <div className="rounded-xl border border-[#0e2d4c]/[0.15] bg-[#0e2d4c]/[0.04] p-4">
                            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0e2d4c]">
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
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              ข้อมูลการจัดส่ง
                            </p>
                            <AddressBlock
                              label="ที่อยู่จัดส่งเอกสาร"
                              name={doc.deliveryAddress.name}
                              phone={doc.deliveryAddress.phone}
                              address={doc.deliveryAddress}
                            />
                          </div>
                        )}
                    </div>
                  );
                })()}

              {/* ไม่มีรายละเอียด */}
              {!detail.buildingRepairDetail &&
                !detail.vehicleRepairDetail &&
                !detail.messengerBookingDetail &&
                !detail.documentRequestDetail && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="text-3xl">📋</span>
                    <p className="text-sm text-slate-500">
                      ยังไม่มีรายละเอียดเฉพาะของคำขอนี้
                    </p>
                  </div>
                )}
            </SectionCard>

            {/* ── 4. Attachments ────────────────────────────────────────── */}
            <SectionCard
              title="ไฟล์แนบ"
              accent="navy"
              icon={
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
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              }
            >
              {visibleAttachments.length === 0 ? (
                detail.type === "DOCUMENT" &&
                detail.documentRequestDetail?.deliveryMethod === "DIGITAL" ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                      !
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        ยังไม่มีไฟล์ดิจิทัล
                      </p>
                      <p className="mt-0.5 text-sm text-amber-700">
                        ยังไม่มีไฟล์ดิจิทัลจาก HR สำหรับคำขอนี้
                        กรุณาติดตามสถานะอีกครั้ง
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="text-3xl">📂</span>
                    <p className="text-sm text-slate-500">ยังไม่มีไฟล์แนบ</p>
                  </div>
                )
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {visibleAttachments.map((attachment) => {
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
                                disabled={
                                  previewingAttachmentId === attachment.id
                                }
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
                                  <source
                                    src={previewUrl ?? ""}
                                    type={attachment.mimeType}
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
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePreviewVideoAttachment(
                                    attachment.id,
                                    attachment.fileName,
                                  )
                                }
                                disabled={
                                  previewingAttachmentId === attachment.id
                                }
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
                                  <path
                                    d="M14 2v5h5"
                                    className="fill-white/60"
                                  />
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

            {/* ── 5. Timeline ───────────────────────────────────────────── */}
            <SectionCard
              title="ไทม์ไลน์กิจกรรม"
              accent="navy"
              icon={
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            >
              {detail.activityLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <span className="text-3xl">🕐</span>
                  <p className="text-sm text-slate-500">ยังไม่มีกิจกรรม</p>
                </div>
              ) : (
                <ol className="relative space-y-0">
                  {detail.activityLogs.map((log, index) => {
                    const cfg = getActivityConfig(log.action);
                    const isLast = index === detail.activityLogs.length - 1;
                    return (
                      <li key={log.id} className="relative flex gap-4">
                        {/* เส้นไทม์ไลน์ */}
                        <div className="flex flex-col items-center">
                          {/* dot */}
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${cfg.color}`}
                          >
                            {cfg.icon}
                          </span>
                          {/* เส้นเชื่อม */}
                          {!isLast && (
                            <span
                              className="mt-1 w-[2px] flex-1 bg-gradient-to-b from-slate-200 to-slate-100"
                              style={{ minHeight: "1.5rem" }}
                            />
                          )}
                        </div>

                        {/* เนื้อหา */}
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

                          {/* การเปลี่ยนสถานะ */}
                          {(log.fromStatus || log.toStatus) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {log.fromStatus && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig[log.fromStatus].color}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${statusConfig[log.fromStatus].dot}`}
                                  />
                                  {statusConfig[log.fromStatus].label}
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
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig[log.toStatus].color}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${statusConfig[log.toStatus].dot}`}
                                  />
                                  {statusConfig[log.toStatus].label}
                                </span>
                              )}
                            </div>
                          )}

                          {/* ผู้ดำเนินการ */}
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

                          {/* หมายเหตุ */}
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

            {/* ── 6. Cancel Section ─────────────────────────────────────── */}
            {canCancel && (
              <SectionCard
                title="ยกเลิกคำขอ"
                accent="red"
                icon={
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
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              >
                {/* คำเตือน */}
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#b62026]/20 bg-[#b62026]/5 p-4">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-[#b62026]">
                      ข้อควรระวัง
                    </p>
                    <p className="mt-0.5 text-sm text-[#b62026]/80">
                      ยกเลิกได้เฉพาะเมื่อสถานะเป็น <strong>ใหม่</strong> หรือ{" "}
                      <strong>อนุมัติแล้ว</strong> เท่านั้น
                      หลังยกเลิกแล้วจะไม่สามารถดำเนินการต่อได้
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleCancel}>
                  <TextareaField
                    id="cancelReason"
                    label="เหตุผลในการยกเลิก"
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="กรุณาระบุเหตุผลในการยกเลิกคำขอนี้..."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      {cancelReason.length}/1000 ตัวอักษร
                    </p>
                    <button
                      type="submit"
                      disabled={canceling || !cancelReason.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#b62026] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#b62026]/25 transition hover:bg-[#d42a30] disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                    >
                      {canceling ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          กำลังยกเลิก...
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
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          ยืนยันยกเลิกคำขอ
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}
          </>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={showConfirmCancel && canCancel}
        title="ยืนยันการยกเลิกคำขอ"
        description="ยืนยันการยกเลิกคำขอนี้? หลังยกเลิกแล้วจะไม่สามารถดำเนินการต่อได้"
        confirmLabel={canceling ? "กำลังยืนยัน..." : "ยืนยันยกเลิกคำขอ"}
        cancelLabel="ยกเลิก"
        onConfirm={() => void performCancel()}
        onClose={() => {
          if (!canceling) setShowConfirmCancel(false);
        }}
      />

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
    </div>
  );
}







