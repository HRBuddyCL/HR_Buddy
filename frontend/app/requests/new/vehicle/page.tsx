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
import {
  Button,
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
};

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
        message: "Only images, videos, and documents are allowed.",
      };
    }

    const inferredFileKind = inferFileKindFromMimeType(resolvedMimeType);
    if (!inferredFileKind) {
      return {
        ok: false as const,
        message: "Only images, videos, and documents are allowed.",
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
        setVehicleIssueCategories(categoriesResult.items);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load reference data");
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
  };

  const handlePhoneChange = (value: string) => {
    onChange("phone", formatPhoneDisplay(value));
  };

  const validateBeforeSubmit = () => {
    if (!form.employeeName.trim()) {
      return "Employee name is required";
    }

    if (!form.departmentId) {
      return "Department is required";
    }

    if (isOtherDepartment && !form.departmentOther.trim()) {
      return "Please fill the other department name";
    }

    if (extractPhoneDigits(form.phone).length !== 10) {
      return "Phone number must be exactly 10 digits";
    }

    if (!form.vehiclePlate.trim()) {
      return "Vehicle plate is required";
    }

    if (!form.issueCategoryId) {
      return "Vehicle issue category is required";
    }

    if (isOtherCategory && !form.issueCategoryOther.trim()) {
      return "Please fill the other vehicle issue category";
    }

    if (!form.symptom.trim()) {
      return "Symptom is required";
    }

    if (attachmentFiles.length === 0) {
      return "Please attach at least one file";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      return `Maximum ${MAX_ATTACHMENTS} files are allowed`;
    }

    const candidates = prepareAttachmentCandidates(attachmentFiles);
    if (!candidates.ok) {
      return candidates.message;
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const candidates = prepareAttachmentCandidates(attachmentFiles);
    if (!candidates.ok) {
      setErrorMessage(candidates.message);
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

    setSubmitting(true);

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

      router.push(`/requests/success/${encodeURIComponent(created.requestNo)}`);
    } catch (error) {
      if (createdRequestNo) {
        router.push(
          `/requests/success/${encodeURIComponent(createdRequestNo)}?attachments=partial`,
        );
        return;
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit vehicle request");
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
        warnings.push(`Skipped duplicate file: ${file.name}`);
        continue;
      }

      if (merged.length >= MAX_ATTACHMENTS) {
        warnings.push(`Maximum ${MAX_ATTACHMENTS} files allowed`);
        break;
      }

      const resolvedMimeType = resolveUploadMimeType(file);
      if (!resolvedMimeType) {
        warnings.push(`Unsupported file type: ${file.name}`);
        continue;
      }

      const fileKind = inferFileKindFromMimeType(resolvedMimeType);
      if (!fileKind) {
        warnings.push(`Unsupported file type: ${file.name}`);
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
  };

  const handleRemoveAttachment = (keyToRemove: string) => {
    setAttachmentFiles((prev) => prev.filter((file) => fileKey(file) !== keyToRemove));
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

  const resetForm = () => {
    setForm(initialState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
    setVideoPreview(null);
    setImagePreview(null);
    setDocumentPreview(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Vehicle Repair Request</h1>
        <p className="mt-3 text-slate-700">
          Submit a vehicle issue request with the required details and attachments.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">Loading departments and vehicle issue categories...</p>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="employeeName"
                label="Employee Name"
                required
                value={form.employeeName}
                onChange={(event) => onChange("employeeName", event.target.value)}
                placeholder="Thanaruk T."
                maxLength={120}
              />

              <TextField
                id="phone"
                label="Phone"
                required
                value={form.phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                placeholder="012-345-6789"
                inputMode="numeric"
                maxLength={12}
              />

              <SelectField
                id="departmentId"
                label="Department"
                required
                value={form.departmentId}
                onChange={(event) => onChange("departmentId", event.target.value)}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectField>

              <TextField
                id="vehiclePlate"
                label="Vehicle Plate"
                required
                value={form.vehiclePlate}
                onChange={(event) => onChange("vehiclePlate", event.target.value)}
                placeholder="1??1234"
                maxLength={20}
              />

              <div className="md:col-span-2">
                <SelectField
                  id="issueCategoryId"
                  label="Vehicle Issue Category"
                  required
                  value={form.issueCategoryId}
                  onChange={(event) => onChange("issueCategoryId", event.target.value)}
                >
                  <option value="">Select category</option>
                  {vehicleIssueCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            {isOtherDepartment ? (
              <TextField
                id="departmentOther"
                label="Other Department"
                required
                value={form.departmentOther}
                onChange={(event) => onChange("departmentOther", event.target.value)}
                placeholder="Please specify department name"
                maxLength={120}
              />
            ) : null}

            {isOtherCategory ? (
              <TextField
                id="issueCategoryOther"
                label="Other Vehicle Issue Category"
                required
                value={form.issueCategoryOther}
                onChange={(event) => onChange("issueCategoryOther", event.target.value)}
                placeholder="Please specify category"
                maxLength={120}
              />
            ) : null}

            <TextareaField
              id="symptom"
              label="Symptom"
              required
              value={form.symptom}
              onChange={(event) => onChange("symptom", event.target.value)}
              placeholder="Describe the vehicle issue"
              rows={4}
              maxLength={2000}
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                Attach Files <span className="ml-1 text-rose-600">*</span>
              </label>

              <input
                type="file"
                multiple
                accept={attachmentAccept}
                onChange={(event) => {
                  handleAttachmentPick(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

              <p className="text-xs text-slate-500">
                Allowed: image, video, and document files. Maximum {MAX_ATTACHMENTS} files.
              </p>

              {attachmentNotice ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {attachmentNotice}
                </p>
              ) : null}

              {attachmentPreviews.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {attachmentPreviews.map((preview) => (
                    <li
                      key={preview.key}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="truncate text-xs font-semibold text-slate-700" title={preview.file.name}>
                          {preview.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(preview.key)}
                          className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="p-3">
                        {preview.fileKind === "IMAGE" ? (
                          <button
                            type="button"
                            onClick={() => setImagePreview(preview)}
                            className="group relative block h-28 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                          >
                            <Image
                              src={preview.previewUrl}
                              alt={preview.file.name}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover transition duration-200 group-hover:scale-105"
                            />
                          </button>
                        ) : null}

                        {preview.fileKind === "VIDEO" ? (
                          <button
                            type="button"
                            onClick={() => setVideoPreview(preview)}
                            className="group relative block h-28 w-full overflow-hidden rounded-lg border border-slate-100 bg-black"
                            aria-label="Play video preview"
                          >
                            <video className="h-full w-full object-cover opacity-70" muted playsInline preload="metadata">
                              <source src={preview.previewUrl} type={preview.mimeType} />
                            </video>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow transition-transform group-hover:scale-110">
                                <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-0.5 fill-[#0e2d4c]">
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
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800" title={preview.file.name}>
                                {preview.file.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {getDocumentTypeLabel(preview.mimeType, preview.file.name)}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                              {preview.mimeType.toLowerCase() === "application/pdf" ? "Preview" : "Download"}
                            </span>
                          </button>
                        ) : null}
                      </div>

                      <div className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500">
                        {(preview.file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting || loadingReferences}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
              <Button
                type="button"
                className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                onClick={resetForm}
                disabled={submitting}
              >
                Reset
              </Button>
            </div>
          </form>
        )}
      </section>

      <ImagePreviewModal
        open={Boolean(imagePreview)}
        title={imagePreview ? `Image preview: ${imagePreview.file.name}` : "Image preview"}
        src={imagePreview?.previewUrl ?? ""}
        onClose={() => setImagePreview(null)}
      />

      <DocumentPreviewModal
        open={Boolean(documentPreview)}
        title={documentPreview ? `Document preview: ${documentPreview.file.name}` : "Document preview"}
        src={documentPreview?.previewUrl ?? ""}
        mimeType={documentPreview?.mimeType}
        onClose={() => setDocumentPreview(null)}
      />

      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={videoPreview ? `Video preview: ${videoPreview.file.name}` : "Video preview"}
        src={videoPreview?.previewUrl ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </main>
  );
}

