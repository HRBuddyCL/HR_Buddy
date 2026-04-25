"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { TextareaField } from "@/components/ui/form-controls";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import { ApiError } from "@/lib/api/client";
import {
  getMessengerLink,
  reportMessengerProblem,
  updateMessengerLinkStatus,
  type MessengerAddress,
  type MessengerLinkDetail,
} from "@/lib/api/messenger-link";
import { formatPhoneDisplay } from "@/lib/phone-format";

type NextStatus = "IN_TRANSIT" | "DONE";
type AttachmentPreviewState = {
  attachmentId: string;
  fileName: string;
  url: string;
  mimeType: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatThaiDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusConfig(status: string): { bg: string; text: string; dot: string; label: string } {
  switch (status) {
    case "APPROVED":
      return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "อนุมัติแล้ว" };
    case "IN_TRANSIT":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "กำลังจัดส่ง" };
    case "DONE":
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "เสร็จสิ้น" };
    case "REJECTED":
      return { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "ปฏิเสธคำขอ" };
    case "CANCELED":
      return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "ยกเลิกคำขอ" };
    case "NEW":
      return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "คำขอใหม่" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: status };
  }
}

function urgencyConfig(urgency: MessengerLinkDetail["request"]["urgency"]) {
  if (urgency === "CRITICAL")
    return { label: "เร่งด่วนมาก", bg: "bg-rose-50", text: "text-rose-700", icon: "●" };
  if (urgency === "HIGH")
    return { label: "สูง", bg: "bg-amber-50", text: "text-amber-700", icon: "●" };
  return { label: "ปกติ", bg: "bg-slate-100", text: "text-slate-600", icon: "●" };
}

function itemTypeLabel(itemType: MessengerLinkDetail["messengerDetail"]["itemType"]) {
  return itemType === "DOCUMENT" ? "เอกสาร" : "พัสดุ";
}

function deliveryServiceLabel(detail: MessengerLinkDetail["messengerDetail"]) {
  if (!detail.outsideBkkMetro) return "-";
  if (detail.deliveryService === "POST") return "ไปรษณีย์";
  if (detail.deliveryService === "NAKHONCHAI_AIR") return "นครชัยแอร์";
  if (detail.deliveryService === "OTHER") return detail.deliveryServiceOther || "อื่นๆ";
  return "-";
}

function renderAddressLines(address: MessengerAddress) {
  const parts: string[] = [
    `บ้านเลขที่ ${address.houseNo}`,
    address.soi ? `ซอย${address.soi}` : "",
    address.road ? `ถนน${address.road}` : "",
    address.subdistrict,
    address.district,
    address.province,
    address.postalCode,
  ].filter((part) => part.trim().length > 0);
  return parts.join(", ");
}

function formatAttachmentSize(size: number) {
  const sizeInMb = Math.max(size / 1024 / 1024, 0.01);
  return `${sizeInMb.toFixed(2)} MB`;
}

function getAttachmentExtensionLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.trim().toUpperCase();
  return ext || "FILE";
}

function getAttachmentBadgeClass(fileKind: "IMAGE" | "VIDEO" | "DOCUMENT") {
  if (fileKind === "IMAGE") return "bg-blue-100 text-blue-700";
  if (fileKind === "VIDEO") return "bg-purple-100 text-purple-700";
  return "bg-slate-200 text-slate-600";
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function toThaiMessengerErrorMessage(error: ApiError, fallback: string) {
  const code = error.body?.code;
  switch (code) {
    case "MESSENGER_TOKEN_REQUIRED":
      return "ไม่พบโทเคนสำหรับเข้าหน้างานลิงก์เมสเซนเจอร์";
    case "MAGIC_LINK_NOT_FOUND":
      return "ไม่พบลิงก์เมสเซนเจอร์นี้";
    case "INVALID_MAGIC_LINK_REQUEST_TYPE":
      return "ลิงก์นี้ไม่ใช่หน้างานเมสเซนเจอร์";
    case "MAGIC_LINK_REVOKED":
      return "ลิงก์นี้ถูกยกเลิกแล้ว";
    case "MAGIC_LINK_EXPIRED":
      return "ลิงก์นี้หมดอายุแล้ว";
    case "INVALID_MESSENGER_TARGET_STATUS":
    case "INVALID_MESSENGER_STATUS_TRANSITION":
      return "ไม่สามารถเปลี่ยนสถานะตามที่เลือกได้";
    case "REQUIRED_TEXT_MISSING":
      return "กรุณากรอกหมายเหตุให้ครบถ้วน";
    case "MAGIC_LINK_REPLAY_BLOCKED":
      return "มีการส่งรายการซ้ำเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่";
    default:
      if (error.status === 429) return "มีการใช้งานที่มากเกินไป กรุณารอสักครู่แล้วลองใหม่";
      return error.message?.trim() || fallback;
  }
}

// Section
function SectionCard({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Section */}
      <div
        className={`flex items-center gap-3 border-b px-4 py-3.5 ${
          accent
            ? "border-[#0e2d4c]/10 bg-[#0e2d4c]"
            : "border-slate-100 bg-slate-50"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            accent ? "bg-white/15 text-white" : "bg-white text-[#0e2d4c] shadow-sm border border-slate-200"
          }`}
        >
          {icon}
        </span>
        <h2
          className={`text-sm font-bold tracking-wide ${
            accent ? "text-white" : "text-[#0e2d4c]"
          }`}
        >
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// Section
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-[2.25rem] items-start gap-2 py-1.5">
      <span className="w-28 shrink-0 text-xs font-semibold text-slate-400 pt-0.5 uppercase tracking-wide">
        {label}
      </span>
      <span className="flex-1 text-sm font-medium text-[#0e2d4c] break-words leading-snug">
        {value}
      </span>
    </div>
  );
}

// Section
function Divider() {
  return <div className="my-1 h-px bg-slate-100" />;
}

export default function Page() {
  const params = useParams<{ token: string | string[] }>();
  const tokenRaw = params?.token;
  const token = useMemo(() => {
    if (!tokenRaw) return "";
    const value = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
    return decodeURIComponent(value ?? "");
  }, [tokenRaw]);

  const [detail, setDetail] = useState<MessengerLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusNote, setStatusNote] = useState("");
  const [problemNote, setProblemNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingProblem, setSendingProblem] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<NextStatus | null>(null);
  const [imagePreview, setImagePreview] =
    useState<AttachmentPreviewState | null>(null);
  const [videoPreview, setVideoPreview] =
    useState<AttachmentPreviewState | null>(null);
  const [documentPreview, setDocumentPreview] =
    useState<AttachmentPreviewState | null>(null);

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!token) {
        if (!silent) {
          setErrorMessage("ไม่พบโทเคนสำหรับเข้าหน้างานลิงก์เมสเซนเจอร์");
          setLoading(false);
        }
        return;
      }

      if (!silent) {
        setLoading(true);
        setErrorMessage(null);
      }

      try {
        const result = await getMessengerLink(token);
        setDetail(result);
      } catch (error) {
        if (silent) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(
            toThaiMessengerErrorMessage(
              error,
              "ไม่สามารถโหลดข้อมูลงานได้",
            ),
          );
        } else {
          setErrorMessage("ไม่สามารถโหลดข้อมูลงานได้");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isExpired = useMemo(() => {
    if (!detail) return false;
    return new Date(detail.expiresAt).getTime() <= Date.now();
  }, [detail]);

  const nextStatus = useMemo<NextStatus | null>(() => {
    if (!detail) return null;
    if (detail.request.status === "APPROVED") return "IN_TRANSIT";
    if (detail.request.status === "IN_TRANSIT") return "DONE";
    return null;
  }, [detail]);

  const executeUpdateStatus = async (targetStatus: NextStatus) => {
    if (!detail || isExpired) return;
    setUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateMessengerLinkStatus(token, {
        status: targetStatus,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
      });
      setDetail((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          request: {
            ...previous.request,
            status: updated.status,
            latestActivityAt: new Date().toISOString(),
          },
        };
      });
      setStatusNote("");
      setSuccessMessage(
        `อัปเดตสถานะเป็น "${statusConfig(targetStatus).label}" เรียบร้อยแล้ว`,
      );
      void loadDetail(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(
          toThaiMessengerErrorMessage(error, "อัปเดตสถานะงานไม่สำเร็จ"),
        );
      } else {
        setErrorMessage("อัปเดตสถานะงานไม่สำเร็จ");
      }
    } finally {
      setUpdatingStatus(false);
      setPendingStatus(null);
      setConfirmOpen(false);
    }
  };

  const requestUpdateStatus = () => {
    if (!detail || !nextStatus || isExpired) return;
    setPendingStatus(nextStatus);
    setConfirmOpen(true);
  };

  const handleReportProblem = async () => {
    if (isExpired || !detail) return;
    const note = problemNote.trim();
    if (!note) {
      setErrorMessage("กรุณาระบุรายละเอียดปัญหา");
      return;
    }
    setSendingProblem(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await reportMessengerProblem(token, note);
      setProblemNote("");
      setSuccessMessage("ส่งรายงานปัญหาให้ผู้ดูแลเรียบร้อยแล้ว");
      await loadDetail();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(
          toThaiMessengerErrorMessage(error, "ส่งรายงานปัญหาไม่สำเร็จ"),
        );
      } else {
        setErrorMessage("ส่งรายงานปัญหาไม่สำเร็จ");
      }
    } finally {
      setSendingProblem(false);
    }
  };

  const handleDocumentAction = (
    attachment: MessengerLinkDetail["attachments"][number],
  ) => {
    if (attachment.fileKind !== "DOCUMENT") return;
    const documentType = getDocumentTypeLabel(
      attachment.mimeType,
      attachment.fileName,
    );
    if (documentType === "PDF") {
      setDocumentPreview({
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        url: attachment.previewUrl,
        mimeType: attachment.mimeType,
      });
      return;
    }
    triggerDownload(attachment.downloadUrl, attachment.fileName);
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          {/* Section */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0e2d4c]">
            <svg
              className="h-8 w-8 text-white animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#0e2d4c]">
            กำลังโหลดข้อมูลงาน...
          </p>
          <p className="mt-1 text-xs text-slate-400">ลิงก์งานเมสเซนเจอร์</p>
          {/* Section */}
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    );
  }

  // Error State
  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-4">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
          <div className="h-1.5 w-full bg-[#b62026]" />
          <div className="p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
              <svg
                className="h-8 w-8 text-[#b62026]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-base font-bold text-[#0e2d4c]">
              ไม่สามารถเข้าถึงได้
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {errorMessage ?? "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Derived values
  const status = statusConfig(detail.request.status);
  const urgency = urgencyConfig(detail.request.urgency);

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Section */}
      <main className="mx-auto w-full max-w-2xl px-3 pb-10 pt-4 sm:px-4 sm:pt-6">
        {/* Section */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-[#0e2d4c] shadow-lg">
          {/* Section */}
          <div className="h-1 w-full bg-gradient-to-r from-[#b62026] via-[#fed54f] to-[#b62026]" />

          <div className="p-4 sm:p-5">
            {/* Section */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                ลิงก์งานเมสเซนเจอร์
              </span>
              <span
                className={`text-[11px] font-medium ${isExpired ? "text-[#b62026] bg-rose-900/30" : "text-white/50"} rounded-full px-2 py-0.5`}
              >
                {isExpired
                  ? "⚠ หมดอายุแล้ว"
                  : `หมดอายุ ${formatDateTime(detail.expiresAt)}`}
              </span>
            </div>

            {/* Section */}
            <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {detail.request.requestNo}
            </h1>

            {/* Section */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Section */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${status.bg} ${status.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {/* Section */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${urgency.bg} ${urgency.text}`}
              >
                {urgency.icon} {urgency.label}
              </span>
            </div>

            {/* Section */}
            {isExpired && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-900/30 px-3 py-2.5">
                <svg
                  className="h-4 w-4 shrink-0 text-rose-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs font-semibold text-rose-300">
                  ลิงก์นี้หมดอายุแล้ว ไม่สามารถอัปเดตสถานะได้
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section */}
        <div className="flex flex-col gap-3">
          {/* Section */}
          <SectionCard
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v12a2 2 0 01-2 2z"
                />
              </svg>
            }
            title="รายละเอียดงาน"
          >
            <InfoRow
              label="วันที่จัดส่ง"
              value={formatThaiDateOnly(detail.messengerDetail.pickupDatetime)}
            />
            <Divider />
            <InfoRow
              label="ประเภทสิ่งของ"
              value={
                <span className="inline-flex items-center rounded-lg bg-[#0e2d4c]/8 px-2.5 py-0.5 text-xs font-bold text-[#0e2d4c]">
                  {itemTypeLabel(detail.messengerDetail.itemType)}
                </span>
              }
            />
            <Divider />
            <InfoRow
              label="รายละเอียด"
              value={detail.messengerDetail.itemDescription}
            />
            <Divider />
            <InfoRow
              label="พื้นที่จัดส่ง"
              value={
                detail.messengerDetail.outsideBkkMetro
                  ? "นอกเขตกรุงเทพฯ และปริมณฑล"
                  : "ในเขตกรุงเทพฯ และปริมณฑล"
              }
            />
            {detail.messengerDetail.outsideBkkMetro && (
              <>
                <Divider />
                <InfoRow
                  label="บริการจัดส่ง"
                  value={deliveryServiceLabel(detail.messengerDetail)}
                />
              </>
            )}
          </SectionCard>

          {/* Section */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0e2d4c] shadow-sm">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
              </span>
              <h2 className="text-sm font-bold tracking-wide text-[#0e2d4c]">
                เส้นทางจัดส่ง
              </h2>
            </div>

            <div className="p-4">
              {/* Section */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-[10px] font-bold text-white">
                    A
                  </span>
                  <div
                    className="mt-1 flex-1 w-px bg-gradient-to-b from-[#0e2d4c]/30 to-[#b62026]/30"
                    style={{ minHeight: "2rem" }}
                  />
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    ต้นทาง
                  </p>
                  <p className="text-sm font-bold text-[#0e2d4c]">
                    {detail.request.employeeName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg
                      className="h-3 w-3 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {formatPhoneDisplay(detail.request.phone)}
                  </p>
                  {detail.messengerDetail.senderAddress && (
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {renderAddressLines(detail.messengerDetail.senderAddress)}
                    </p>
                  )}
                  {detail.messengerDetail.senderAddress?.extra && (
                    <p className="mt-1 rounded-lg bg-[#fed54f]/20 px-2.5 py-1 text-[11px] font-medium text-[#0e2d4c]">
                      หมายเหตุ: {detail.messengerDetail.senderAddress.extra}
                    </p>
                  )}
                </div>
              </div>

              {/* Section */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b62026] text-[10px] font-bold text-white">
                    B
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    ปลายทาง
                  </p>
                  <p className="text-sm font-bold text-[#0e2d4c]">
                    {detail.messengerDetail.receiverAddress.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg
                      className="h-3 w-3 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {formatPhoneDisplay(
                      detail.messengerDetail.receiverAddress.phone,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {renderAddressLines(detail.messengerDetail.receiverAddress)}
                  </p>
                  {detail.messengerDetail.receiverAddress.extra && (
                    <p className="mt-1 rounded-lg bg-[#fed54f]/20 px-2.5 py-1 text-[11px] font-medium text-[#0e2d4c]">
                      หมายเหตุ: {detail.messengerDetail.receiverAddress.extra}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section */}
          <SectionCard
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            }
            title={`ไฟล์แนบ ${detail.attachments.length > 0 ? `(${detail.attachments.length})` : ""}`}
          >
            {detail.attachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                <svg
                  className="h-8 w-8 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium text-slate-400">
                  ไม่มีไฟล์แนบ
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {detail.attachments.map((attachment) => {
                  const extensionLabel = getAttachmentExtensionLabel(
                    attachment.fileName,
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

                  return (
                    <li
                      key={attachment.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
                    >
                      {/* Section */}
                      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                        >
                          {extensionLabel}
                        </span>
                        <p
                          className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#0e2d4c]"
                          title={attachment.fileName}
                        >
                          {attachment.fileName}
                        </p>
                        {/* Section */}
                        <button
                          type="button"
                          onClick={() =>
                            triggerDownload(
                              attachment.downloadUrl,
                              attachment.fileName,
                            )
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#0e2d4c]/15 bg-[#0e2d4c]/5 text-[#0e2d4c] transition hover:bg-[#0e2d4c] hover:text-white"
                          aria-label={`ดาวน์โหลด ${attachment.fileName}`}
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Section */}
                      <div className="p-2.5">
                        {attachment.fileKind === "IMAGE" && (
                          <button
                            type="button"
                            onClick={() =>
                              setImagePreview({
                                attachmentId: attachment.id,
                                fileName: attachment.fileName,
                                url: attachment.previewUrl,
                                mimeType: attachment.mimeType,
                              })
                            }
                            aria-label={`ดูภาพ ${attachment.fileName}`}
                            className="group relative block h-36 w-full overflow-hidden rounded-lg border border-slate-200"
                          >
                            <Image
                              src={attachment.previewUrl}
                              alt={attachment.fileName}
                              fill
                              className="object-cover transition duration-200 group-hover:scale-105"
                              unoptimized
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                              <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-[#0e2d4c] opacity-0 shadow transition group-hover:opacity-100">
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                ดูภาพ
                              </span>
                            </div>
                          </button>
                        )}

                        {attachment.fileKind === "VIDEO" && (
                          <button
                            type="button"
                            onClick={() =>
                              setVideoPreview({
                                attachmentId: attachment.id,
                                fileName: attachment.fileName,
                                url: attachment.previewUrl,
                                mimeType: attachment.mimeType,
                              })
                            }
                            aria-label="ดูตัวอย่างวิดีโอ"
                            className="group relative block h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-[#0e2d4c]"
                          >
                            <video
                              className="h-full w-full object-cover opacity-50"
                              muted
                              playsInline
                              preload="metadata"
                            >
                              <source
                                src={attachment.previewUrl}
                                type={attachment.mimeType}
                              />
                            </video>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5 translate-x-0.5 fill-[#0e2d4c]"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </span>
                            </div>
                            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              VDO
                            </span>
                          </button>
                        )}

                        {attachment.fileKind === "DOCUMENT" && (
                          <button
                            type="button"
                            onClick={() => handleDocumentAction(attachment)}
                            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#0e2d4c]/25 hover:bg-[#0e2d4c]/4"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]/8 text-[#0e2d4c]">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5 fill-current"
                              >
                                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                              </svg>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-xs font-bold text-[#0e2d4c]"
                                title={attachment.fileName}
                              >
                                {attachment.fileName}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                                {documentType}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-lg bg-[#0e2d4c] px-2.5 py-1 text-[10px] font-bold text-white">
                              {documentType === "PDF" ? "ดู PDF" : "โหลด"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Section */}
                      <div className="border-t border-slate-200 bg-white/60 px-3 py-1.5 text-center text-[10px] font-medium text-slate-400">
                        {formatAttachmentSize(attachment.fileSize)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Section */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Section */}
            <div className="flex items-center gap-3 border-b border-[#0e2d4c]/10 bg-[#0e2d4c] px-4 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-wide text-white">
                  จัดการงาน
                </h2>
                <p className="text-[11px] text-white/60">
                  อัปเดตสถานะ และรายงานปัญหา
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Section */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {/* Section */}
                <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0e2d4c]/10 text-[#0e2d4c]">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </span>
                  <h3 className="text-xs font-bold text-[#0e2d4c]">
                    อัปเดตสถานะงาน
                  </h3>
                  {/* Section */}
                  {nextStatus && !isExpired && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#0e2d4c] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      {statusConfig(nextStatus).label}
                    </span>
                  )}
                </div>

                <div className="p-3.5 space-y-3">
                  {/* Section */}
                  {nextStatus && !isExpired && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold
                        ${statusConfig(detail.request.status).bg} ${statusConfig(detail.request.status).text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusConfig(detail.request.status).dot}`}
                        />
                        {statusConfig(detail.request.status).label}
                      </span>
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold
                        ${statusConfig(nextStatus).bg} ${statusConfig(nextStatus).text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusConfig(nextStatus).dot}`}
                        />
                        {statusConfig(nextStatus).label}
                      </span>
                    </div>
                  )}

                  <TextareaField
                    id="statusNote"
                    label="หมายเหตุสถานะ"
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                    rows={2}
                    maxLength={2000}
                  />

                  <button
                    type="button"
                    onClick={requestUpdateStatus}
                    disabled={
                      !nextStatus ||
                      isExpired ||
                      updatingStatus ||
                      sendingProblem
                    }
                    className={`
                      relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-bold
                      transition-all duration-200 active:scale-[0.98]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                      ${
                        !nextStatus || isExpired
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-[#0e2d4c] text-white shadow-md shadow-[#0e2d4c]/25 hover:bg-[#0e2d4c]/90 hover:shadow-lg"
                      }
                    `}
                  >
                    {/* Section */}
                    {nextStatus && !isExpired && (
                      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      {updatingStatus ? (
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
                      ) : nextStatus && !isExpired ? (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          อัปเดตเป็น &quot;{statusConfig(nextStatus).label}&quot;
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                          ไม่สามารถเปลี่ยนสถานะได้
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Section */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {/* Section */}
                <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#b62026]/10 text-[#b62026]">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </span>
                  <h3 className="text-xs font-bold text-[#0e2d4c]">
                    รายงานปัญหา
                  </h3>
                  <span className="ml-auto rounded-full bg-[#b62026]/10 px-2 py-0.5 text-[10px] font-bold text-[#b62026]">
                    แจ้งผู้ดูแล
                  </span>
                </div>

                <div className="p-3.5 space-y-3">
                  <TextareaField
                    id="problemNote"
                    label="รายละเอียดปัญหา"
                    required
                    value={problemNote}
                    onChange={(event) => setProblemNote(event.target.value)}
                    placeholder="ระบุปัญหาที่ต้องการแจ้งผู้ดูแล เช่น ไม่พบผู้รับ, ที่อยู่ไม่ถูกต้อง..."
                    rows={3}
                    maxLength={2000}
                  />

                  <button
                    type="button"
                    onClick={handleReportProblem}
                    disabled={isExpired || sendingProblem || updatingStatus}
                    className={`
                      relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-bold
                      transition-all duration-200 active:scale-[0.98]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2
                      ${
                        isExpired
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-[#b62026] text-white shadow-md shadow-[#b62026]/25 hover:bg-[#b62026]/90 hover:shadow-lg"
                      }
                    `}
                  >
                    <span className="relative flex items-center justify-center gap-2">
                      {sendingProblem ? (
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
                          กำลังส่ง...
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          ส่งรายงานปัญหา
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Section */}
              {errorMessage && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b62026]/10">
                    <svg
                      className="h-4 w-4 text-[#b62026]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#b62026]">
                      เกิดข้อผิดพลาด
                    </p>
                    <p className="mt-0.5 text-xs text-rose-600 leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <svg
                      className="h-4 w-4 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700">สำเร็จ</p>
                    <p className="mt-0.5 text-xs text-emerald-600 leading-relaxed">
                      {successMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section */}
          <div className="h-2" />
        </div>
      </main>

      {/* Section */}
      <ConfirmModal
        open={confirmOpen}
        title="ยืนยันการเปลี่ยนสถานะงาน"
        description={
          pendingStatus
            ? `ยืนยันเปลี่ยนสถานะเป็น "${statusConfig(pendingStatus).label}" ใช่หรือไม่`
            : "ยืนยันการเปลี่ยนสถานะงาน"
        }
        confirmLabel={
          updatingStatus
            ? "กำลังยืนยัน..."
            : pendingStatus === "DONE"
              ? "ยืนยันปิดงาน"
              : "ยืนยันเปลี่ยนสถานะ"
        }
        cancelLabel="ยกเลิก"
        onClose={() => {
          if (updatingStatus) return;
          setConfirmOpen(false);
          setPendingStatus(null);
        }}
        onConfirm={() => {
          if (!pendingStatus || updatingStatus) return;
          void executeUpdateStatus(pendingStatus);
        }}
      />
      <ImagePreviewModal
        open={Boolean(imagePreview)}
        title={imagePreview?.fileName ?? ""}
        src={imagePreview?.url ?? ""}
        onClose={() => setImagePreview(null)}
      />
      <DocumentPreviewModal
        open={Boolean(documentPreview)}
        title={documentPreview?.fileName ?? ""}
        src={documentPreview?.url ?? ""}
        mimeType={documentPreview?.mimeType}
        onClose={() => setDocumentPreview(null)}
      />
      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={videoPreview?.fileName ?? ""}
        src={videoPreview?.url ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </div>
  );
}
