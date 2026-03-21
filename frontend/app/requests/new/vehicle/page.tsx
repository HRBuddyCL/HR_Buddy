"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  getDepartments,
  getVehicleIssueCategories,
  type ReferenceListItem,
} from "@/lib/api/reference";
import {
  createVehicleRequest,
  type CreateVehicleRequestPayload,
} from "@/lib/api/requests";
import {
  completeMyAttachmentUpload,
  issueMyAttachmentUploadTicket,
  uploadFileToPresignedUrl,
  type FileKind,
} from "@/lib/api/my-requests";
import {
  getAcceptMimeTypes,
  inferFileKindFromMimeType,
  resolveUploadMimeType,
  validateAttachmentCandidate,
} from "@/lib/attachments/attachment-policy";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { ErrorToast } from "@/components/ui/error-toast";
import Link from "next/link";
import {
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/form-controls";

const MAX_ATTACHMENTS = 5;

const attachmentAccept = [
  getAcceptMimeTypes("IMAGE"),
  getAcceptMimeTypes("VIDEO"),
  getAcceptMimeTypes("DOCUMENT"),
].join(",");

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  vehiclePlate: string;
  issueCategoryId: string;
  issueCategoryOther: string;
  symptom: string;
  additionalDetails: string;
};

type AttachmentCandidate = {
  file: File;
  fileKind: FileKind;
  mimeType: string;
};

type AttachmentPreview = {
  key: string;
  file: File;
  fileKind: FileKind;
  mimeType: string;
  previewUrl: string;
};

const initialState: FormState = {
  employeeName: "",
  departmentId: "",
  departmentOther: "",
  phone: "",
  vehiclePlate: "",
  issueCategoryId: "",
  issueCategoryOther: "",
  symptom: "",
  additionalDetails: "",
};

const VEHICLE_ISSUE_CATEGORY_ORDER = [
  "vic_engine",
  "vic_brake",
  "vic_tire_wheel",
  "vic_battery",
  "vic_electrical",
  "vic_car_ac",
  "vic_leak",
  "vic_checkup",
  "vic_insurance",
  "vic_other",
] as const;

const vehicleIssueCategoryOrderIndex = new Map<string, number>(
  VEHICLE_ISSUE_CATEGORY_ORDER.map((id, index) => [id, index]),
);

function sortVehicleIssueCategories(items: ReferenceListItem[]) {
  return [...items].sort((a, b) => {
    const aIndex =
      vehicleIssueCategoryOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex =
      vehicleIssueCategoryOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.name.localeCompare(b.name, "th");
  });
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhoneDisplay(value: string) {
  const digits = extractPhoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function prepareAttachmentCandidates(files: File[]) {
  const candidates: AttachmentCandidate[] = [];

  for (const file of files) {
    const resolvedMimeType = resolveUploadMimeType(file);
    if (!resolvedMimeType) {
      return {
        ok: false as const,
        message: "รองรับเฉพาะรูปภาพ วิดีโอ และเอกสารเท่านั้น",
      };
    }

    const inferredFileKind = inferFileKindFromMimeType(resolvedMimeType);
    if (!inferredFileKind) {
      return {
        ok: false as const,
        message: "รองรับเฉพาะรูปภาพ วิดีโอ และเอกสารเท่านั้น",
      };
    }

    const validation = validateAttachmentCandidate(file, inferredFileKind);
    if (!validation.ok) {
      return {
        ok: false as const,
        message: `${file.name}: ${validation.message}`,
      };
    }

    candidates.push({
      file,
      fileKind: inferredFileKind,
      mimeType: validation.mimeType,
    });
  }

  return { ok: true as const, candidates };
}

/* ─── Divider ─── */

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/* ─── Panel ─── */

function Panel({
  stepNumber,
  title,
  children,
}: {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-[11px] font-bold text-white">
          {stepNumber}
        </span>
        <h2 className="text-sm font-bold text-[#0e2d4c]">{title}</h2>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [vehicleIssueCategories, setVehicleIssueCategories] = useState<
    ReferenceListItem[]
  >([]);
  const [form, setForm] = useState<FormState>(initialState);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<AttachmentPreview | null>(
    null,
  );
  const [imagePreview, setImagePreview] = useState<AttachmentPreview | null>(
    null,
  );
  const [documentPreview, setDocumentPreview] =
    useState<AttachmentPreview | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);

      try {
        const [departmentResult, categoriesResult] = await Promise.all([
          getDepartments(),
          getVehicleIssueCategories(),
        ]);

        if (!active) {
          return;
        }

        setDepartments(departmentResult.items);
        setVehicleIssueCategories(
          sortVehicleIssueCategories(categoriesResult.items),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดข้อมูลอ้างอิงได้");
        }
      } finally {
        if (active) {
          setLoadingReferences(false);
        }
      }
    }

    void loadReferences();

    return () => {
      active = false;
    };
  }, []);

  const isOtherCategory = useMemo(
    () => form.issueCategoryId === "vic_other",
    [form.issueCategoryId],
  );
  const isOtherDepartment = useMemo(
    () => form.departmentId === "dept_other",
    [form.departmentId],
  );

  const attachmentPreviews = useMemo<AttachmentPreview[]>(() => {
    return attachmentFiles
      .map((file) => {
        const mimeType = resolveUploadMimeType(file);
        if (!mimeType) return null;

        const inferredFileKind = inferFileKindFromMimeType(mimeType);
        if (!inferredFileKind) return null;

        return {
          key: fileKey(file),
          file,
          fileKind: inferredFileKind,
          mimeType,
          previewUrl: URL.createObjectURL(file),
        } satisfies AttachmentPreview;
      })
      .filter((item): item is AttachmentPreview => item !== null);
  }, [attachmentFiles]);

  useEffect(() => {
    return () => {
      for (const preview of attachmentPreviews) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [attachmentPreviews]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handlePhoneChange = (value: string) => {
    onChange("phone", formatPhoneDisplay(value));
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.phone;
        return next;
      });
    }
  };

  const validateBeforeSubmit = () => {
    const errors: Record<string, string> = {};

    if (!form.employeeName.trim()) {
      errors.employeeName = "กรุณากรอกชื่อ-นามสกุล";
    }

    if (!form.departmentId) {
      errors.departmentId = "กรุณาเลือกแผนก";
    }

    if (isOtherDepartment && !form.departmentOther.trim()) {
      errors.departmentOther = "กรุณากรอกชื่อแผนกอื่น";
    }

    if (extractPhoneDigits(form.phone).length !== 10) {
      errors.phone = "หมายเลขโทรศัพท์ต้องมีตัวเลข 10 หลัก";
    }

    if (!form.vehiclePlate.trim()) {
      errors.vehiclePlate = "กรุณากรอกรหัสหรือป้ายทะเบียนรถ";
    }

    if (!form.issueCategoryId) {
      errors.issueCategoryId = "กรุณาเลือกประเภทปัญหาของรถ";
    }

    if (isOtherCategory && !form.issueCategoryOther.trim()) {
      errors.issueCategoryOther = "กรุณากรอกประเภทปัญหาอื่นของรถ";
    }

    if (!form.symptom.trim()) {
      errors.symptom = "กรุณาอธิบายอาการ/ปัญหา";
    }

    if (attachmentFiles.length === 0) {
      errors.attachments =
        "ไฟล์แนบเป็นข้อมูลที่จำเป็น ควรแนบรูปภาพหรือวิดีโอแสดงปัญหาอย่างน้อย 1 ไฟล์";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      errors.attachments = `รองรับสูงสุด ${MAX_ATTACHMENTS} ไฟล์เท่านั้น`;
    }

    const candidates = prepareAttachmentCandidates(attachmentFiles);
    if (!candidates.ok) {
      errors.attachments = candidates.message;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!validateBeforeSubmit()) {
      return;
    }
    setShowConfirmSubmit(true);
  };

  const performSubmit = async () => {
    setShowConfirmSubmit(false);
    setSubmitting(true);
    setErrorMessage(null);

    const candidates = prepareAttachmentCandidates(attachmentFiles);
    if (!candidates.ok) {
      setFieldErrors((prev) => ({ ...prev, attachments: candidates.message }));
      setSubmitting(false);
      return;
    }

    const payload: CreateVehicleRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: extractPhoneDigits(form.phone),
      vehiclePlate: form.vehiclePlate.trim(),
      issueCategoryId: form.issueCategoryId,
      symptom: form.symptom.trim(),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isOtherCategory) {
      payload.issueCategoryOther = form.issueCategoryOther.trim();
    }

    if (form.additionalDetails.trim()) {
      payload.additionalDetails = form.additionalDetails.trim();
    }

    let createdRequestNo: string | null = null;

    try {
      const created = await createVehicleRequest(payload);
      createdRequestNo = created.requestNo;

      for (const candidate of candidates.candidates) {
        const ticket = await issueMyAttachmentUploadTicket(created.id, {
          fileKind: candidate.fileKind,
          fileName: candidate.file.name,
          mimeType: candidate.mimeType,
          fileSize: candidate.file.size,
        });

        await uploadFileToPresignedUrl(ticket, candidate.file);
        await completeMyAttachmentUpload(created.id, ticket.uploadToken);
      }

      document.cookie = `hrb_success_request_no=${encodeURIComponent(created.requestNo)}; Path=/; Max-Age=600; SameSite=Lax`;
      document.cookie =
        "hrb_success_attachments=; Path=/; Max-Age=0; SameSite=Lax";
      router.push("/requests/success");
    } catch (error) {
      if (createdRequestNo) {
        document.cookie = `hrb_success_request_no=${encodeURIComponent(createdRequestNo)}; Path=/; Max-Age=600; SameSite=Lax`;
        document.cookie =
          "hrb_success_attachments=partial; Path=/; Max-Age=600; SameSite=Lax";
        router.push("/requests/success");
        return;
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถส่งคำขอซ่อมรถได้");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachmentPick = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const merged = [...attachmentFiles];
    const warnings: string[] = [];

    for (const file of files) {
      const key = fileKey(file);
      if (merged.some((existing) => fileKey(existing) === key)) {
        warnings.push(`ข้ามไฟล์ซ้ำ: ${file.name}`);
        continue;
      }

      if (merged.length >= MAX_ATTACHMENTS) {
        warnings.push(`สูงสุด ${MAX_ATTACHMENTS} ไฟล์ ข้ามไฟล์ที่เหลือ`);
        break;
      }

      const resolvedMimeType = resolveUploadMimeType(file);
      if (!resolvedMimeType) {
        warnings.push(`รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`);
        continue;
      }

      const fileKind = inferFileKindFromMimeType(resolvedMimeType);
      if (!fileKind) {
        warnings.push(`รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`);
        continue;
      }

      const validation = validateAttachmentCandidate(file, fileKind);
      if (!validation.ok) {
        warnings.push(`${file.name}: ${validation.message}`);
        continue;
      }

      merged.push(file);
    }

    setAttachmentFiles(merged);
    setAttachmentNotice(warnings.length > 0 ? warnings.join(" | ") : null);
    if (fieldErrors.attachments && merged.length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.attachments;
        return next;
      });
    }
  };

  const handleRemoveAttachment = (keyToRemove: string) => {
    setAttachmentFiles((prev) =>
      prev.filter((file) => fileKey(file) !== keyToRemove),
    );
  };

  const handleDocumentAction = (preview: AttachmentPreview) => {
    if (preview.mimeType.toLowerCase() === "application/pdf") {
      setDocumentPreview(preview);
      return;
    }

    const url = URL.createObjectURL(preview.file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = preview.file.name;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const doReset = () => {
    setShowConfirmReset(false);
    setForm(initialState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
    setVideoPreview(null);
    setImagePreview(null);
    setDocumentPreview(null);
    setFieldErrors({});
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <ErrorToast
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-slate-700">
              หน้าแรก
            </Link>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-slate-600">คำขอซ่อมยานพาหนะ</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]">
              <span className="text-2xl">🚗</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2d4c] sm:text-2xl">
                แบบฟอร์มคำขอซ่อมยานพาหนะ
              </h1>
              <p className="text-sm text-slate-500">
                กรอกข้อมูลให้ครบถ้วนและแนบไฟล์แสดงปัญหา
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingReferences ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Panel stepNumber={1} title="ข้อมูลผู้แจ้ง">
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <TextField
                    id="employeeName"
                    label="ชื่อ-นามสกุล"
                    required
                    value={form.employeeName}
                    onChange={(event) =>
                      onChange("employeeName", event.target.value)
                    }
                    placeholder="สมชาย ใจดี"
                    maxLength={120}
                  />
                  <FieldError message={fieldErrors.employeeName} />
                </div>

                <div className="sm:col-span-1">
                  <SelectField
                    id="departmentId"
                    label="แผนก"
                    required
                    value={form.departmentId}
                    onChange={(event) =>
                      onChange("departmentId", event.target.value)
                    }
                  >
                    <option value="">เลือกแผนก</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.departmentId} />
                </div>

                <div className="sm:col-span-1">
                  <TextField
                    id="phone"
                    label="เบอร์โทรศัพท์"
                    required
                    value={form.phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    placeholder="012-345-6789"
                    inputMode="numeric"
                    maxLength={12}
                  />
                  <FieldError message={fieldErrors.phone} />
                </div>

                {isOtherDepartment ? (
                  <div className="sm:col-span-3">
                    <TextField
                      id="departmentOther"
                      label="ระบุชื่อแผนก"
                      required
                      value={form.departmentOther}
                      onChange={(event) =>
                        onChange("departmentOther", event.target.value)
                      }
                      placeholder="กรุณาระบุชื่อแผนก"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.departmentOther} />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel stepNumber={2} title="ข้อมูลรถและประเภทปัญหา">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <TextField
                      id="vehiclePlate"
                      label="ป้ายทะเบียน/รหัสรถ"
                      required
                      value={form.vehiclePlate}
                      onChange={(event) =>
                        onChange("vehiclePlate", event.target.value)
                      }
                      placeholder="กก-1234"
                      maxLength={20}
                    />
                    <FieldError message={fieldErrors.vehiclePlate} />
                  </div>

                  <div>
                    <SelectField
                      id="issueCategoryId"
                      label="ประเภทปัญหาของรถ"
                      required
                      value={form.issueCategoryId}
                      onChange={(event) =>
                        onChange("issueCategoryId", event.target.value)
                      }
                    >
                      <option value="">เลือกประเภทปัญหา</option>
                      {vehicleIssueCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </SelectField>
                    <FieldError message={fieldErrors.issueCategoryId} />
                  </div>
                </div>

                {isOtherCategory ? (
                  <div>
                    <TextField
                      id="issueCategoryOther"
                      label="ระบุประเภทปัญหาอื่น"
                      required
                      value={form.issueCategoryOther}
                      onChange={(event) =>
                        onChange("issueCategoryOther", event.target.value)
                      }
                      placeholder="กรุณาระบุประเภทปัญหา"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.issueCategoryOther} />
                  </div>
                ) : null}

                <Divider label="" />

                <div>
                  <TextareaField
                    id="symptom"
                    label="อาการ/ปัญหา"
                    required
                    value={form.symptom}
                    onChange={(event) =>
                      onChange("symptom", event.target.value)
                    }
                    placeholder="อธิบายอาการหรือปัญหาที่พบ"
                    rows={4}
                    maxLength={2000}
                  />
                  <FieldError message={fieldErrors.symptom} />
                </div>

                <div>
                  <TextareaField
                    id="additionalDetails"
                    label="หมายเหตุเพิ่มเติม (ถ้ามี)"
                    value={form.additionalDetails}
                    onChange={(event) =>
                      onChange("additionalDetails", event.target.value)
                    }
                    placeholder="ข้อมูลเพิ่มเติมอื่นๆ ที่เกี่ยวข้อง"
                    rows={2}
                    maxLength={2000}
                  />
                </div>
              </div>
            </Panel>

            <Panel stepNumber={3} title="ไฟล์แนบ">
              <div className="space-y-4">
                <label
                  htmlFor="attachments"
                  className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors duration-150 ${
                    fieldErrors.attachments
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
                      รูปภาพ · วิดีโอ · เอกสาร &nbsp;|&nbsp; สูงสุด{" "}
                      {MAX_ATTACHMENTS} ไฟล์ · ไม่เกิน 100 MB/ไฟล์
                    </p>
                  </div>
                  <input
                    id="attachments"
                    type="file"
                    multiple
                    accept={attachmentAccept}
                    className="sr-only"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      event.currentTarget.value = "";
                      handleAttachmentPick(selected);
                    }}
                  />
                </label>

                <FieldError message={fieldErrors.attachments} />

                {attachmentNotice ? (
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
                    {attachmentNotice}
                  </div>
                ) : null}

                {attachmentPreviews.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {attachmentPreviews.map((preview) => (
                      <li
                        key={preview.key}
                        className="flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              preview.fileKind === "IMAGE"
                                ? "bg-blue-100 text-blue-700"
                                : preview.fileKind === "VIDEO"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {preview.file.name
                              .split(".")
                              .pop()
                              ?.toUpperCase() ?? preview.fileKind}
                          </span>
                          <p
                            className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
                            title={preview.file.name}
                          >
                            {preview.file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(preview.key)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-sm transition-shadow duration-150 hover:bg-red-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
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
                              onClick={() => setImagePreview(preview)}
                              aria-label={`ดูภาพ ${preview.file.name}`}
                              className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                            >
                              <Image
                                src={preview.previewUrl}
                                alt={preview.file.name}
                                fill
                                className="object-cover transition duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-800 opacity-0 transition group-hover:opacity-100">
                                  ขยาย
                                </span>
                              </div>
                            </button>
                          ) : null}

                          {preview.fileKind === "VIDEO" ? (
                            <button
                              type="button"
                              onClick={() => setVideoPreview(preview)}
                              aria-label="เล่นวิดีโอ"
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

                          {preview.fileKind === "DOCUMENT" ? (
                            <button
                              type="button"
                              onClick={() => handleDocumentAction(preview)}
                              className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:border-[#0e2d4c]/20 hover:bg-[#0e2d4c]/5"
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
                          ) : null}
                        </div>

                        <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                          {Math.max(
                            preview.file.size / 1024 / 1024,
                            0.01,
                          ).toFixed(2)}{" "}
                          MB
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Panel>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-5 py-2.5">
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs font-medium text-amber-800">
                  กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดส่งคำขอ
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col-reverse items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 sm:order-1">
                    <Link
                      href="/"
                      className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
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
                      กลับสู่หน้าหลัก
                    </Link>

                    <button
                      type="button"
                      onClick={() => setShowConfirmReset(true)}
                      disabled={submitting}
                      aria-label="รีเซ็ตแบบฟอร์ม"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 sm:w-auto"
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
                      รีเซ็ตแบบฟอร์ม
                    </button>
                  </div>
                </div>

                <div className="sm:order-2">
                  <button
                    type="submit"
                    disabled={submitting || loadingReferences}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e2d4c] px-10 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#1a4a7a] disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? (
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
                        กำลังส่งคำขอ...
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
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                        ส่งคำขอซ่อม
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      <ConfirmModal
        open={showConfirmReset}
        title="รีเซ็ตฟอร์ม"
        description="ต้องการรีเซ็ตฟอร์ม? ข้อมูลที่กรอกจะถูกลบทั้งหมด"
        confirmLabel="รีเซ็ต"
        cancelLabel="ยกเลิก"
        onConfirm={doReset}
        onClose={() => setShowConfirmReset(false)}
      />

      <ConfirmModal
        open={showConfirmSubmit}
        title="ยืนยันการส่งคำขอ"
        description="ยืนยันการส่งคำขอ? คุณจะไม่สามารถแก้ไขคำขอได้หลังจากส่ง"
        confirmLabel="ส่งคำขอ"
        cancelLabel="ยกเลิก"
        onConfirm={performSubmit}
        onClose={() => setShowConfirmSubmit(false)}
      />

      <ImagePreviewModal
        open={Boolean(imagePreview)}
        title={
          imagePreview
            ? `ตัวอย่างภาพ: ${imagePreview.file.name}`
            : "ตัวอย่างภาพ"
        }
        src={imagePreview?.previewUrl ?? ""}
        onClose={() => setImagePreview(null)}
      />

      <DocumentPreviewModal
        open={Boolean(documentPreview)}
        title={
          documentPreview
            ? `ตัวอย่างเอกสาร: ${documentPreview.file.name}`
            : "ตัวอย่างเอกสาร"
        }
        src={documentPreview?.previewUrl ?? ""}
        mimeType={documentPreview?.mimeType}
        onClose={() => setDocumentPreview(null)}
      />

      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={
          videoPreview
            ? `ตัวอย่างวิดีโอ: ${videoPreview.file.name}`
            : "ตัวอย่างวิดีโอ"
        }
        src={videoPreview?.previewUrl ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </main>
  );
}
