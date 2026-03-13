"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getProblemCategories, type ReferenceListItem } from "@/lib/api/reference";
import {
  createBuildingRequest,
  type BuildingSide,
  type CreateBuildingRequestPayload,
  type Urgency,
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
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";

const MAX_ATTACHMENTS = 5;

const urgencyOptions: Array<{ value: Urgency; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const buildingOptions: Array<{ value: BuildingSide; label: string }> = [
  { value: "FRONT", label: "Front building" },
  { value: "BACK", label: "Back building" },
];

const PROBLEM_CATEGORY_ORDER = [
  "pc_air",
  "pc_electric",
  "pc_plumbing",
  "pc_network",
  "pc_door_lock",
  "pc_cleaning",
  "pc_other",
] as const;

const problemCategoryOrderIndex = new Map<string, number>(
  PROBLEM_CATEGORY_ORDER.map((id, index) => [id, index]),
);

function sortProblemCategoriesByBusinessOrder(items: ReferenceListItem[]) {
  return [...items].sort((a, b) => {
    const aIndex = problemCategoryOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = problemCategoryOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.name.localeCompare(b.name, "th");
  });
}

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
  urgency: Urgency;
  building: BuildingSide;
  floor: number;
  locationDetail: string;
  problemCategoryId: string;
  problemCategoryOther: string;
  description: string;
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
  urgency: "NORMAL",
  building: "FRONT",
  floor: 1,
  locationDetail: "",
  problemCategoryId: "",
  problemCategoryOther: "",
  description: "",
  additionalDetails: "",
};

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhoneDisplay(value: string) {
  const digits = extractPhoneDigits(value);
  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function prepareAttachmentCandidates(files: File[]) {
  const candidates: AttachmentCandidate[] = [];

  for (const file of files) {
    const resolvedMimeType = resolveUploadMimeType(file);
    if (!resolvedMimeType) {
      return {
        ok: false as const,
        message: `Unsupported file type for ${file.name}`,
      };
    }

    const inferredFileKind = inferFileKindFromMimeType(resolvedMimeType);
    if (!inferredFileKind) {
      return {
        ok: false as const,
        message: `Unsupported file type for ${file.name}`,
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

  return {
    ok: true as const,
    candidates,
  };
}

export default function Page() {
  const router = useRouter();
  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [problemCategories, setProblemCategories] = useState<ReferenceListItem[]>([]);
  const [form, setForm] = useState<FormState>(initialState);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<AttachmentPreview | null>(null);
  const [imagePreview, setImagePreview] = useState<AttachmentPreview | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);

      try {
        const [departmentResult, problemCategoryResult] = await Promise.all([
          getDepartments(),
          getProblemCategories(),
        ]);

        if (!active) {
          return;
        }

        setDepartments(departmentResult.items);
        setProblemCategories(sortProblemCategoriesByBusinessOrder(problemCategoryResult.items));
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

  const isOtherCategory = useMemo(() => form.problemCategoryId === "pc_other", [form.problemCategoryId]);
  const isOtherDepartment = useMemo(() => form.departmentId === "dept_other", [form.departmentId]);

  const selectedProblemCategory = useMemo(
    () => problemCategories.find((category) => category.id === form.problemCategoryId) ?? null,
    [problemCategories, form.problemCategoryId],
  );

  const attachmentPreviews = useMemo<AttachmentPreview[]>(() => {
    return attachmentFiles
      .map((file) => {
        const mimeType = resolveUploadMimeType(file);
        if (!mimeType) {
          return null;
        }

        const inferredFileKind = inferFileKindFromMimeType(mimeType);
        if (!inferredFileKind) {
          return null;
        }

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
      return "Phone number must contain exactly 10 digits";
    }

    if (!form.locationDetail.trim()) {
      return "Location detail is required";
    }

    if (!form.problemCategoryId) {
      return "Problem category is required";
    }

    if (isOtherCategory && !form.problemCategoryOther.trim()) {
      return "Please fill the other problem category";
    }

    if (!form.description.trim()) {
      return "Description is required";
    }

    if (attachmentFiles.length === 0) {
      return "Attachment is required";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      return `Maximum ${MAX_ATTACHMENTS} attachments per request`;
    }

    const attachmentValidation = prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentValidation.ok) {
      return attachmentValidation.message;
    }

    return null;
  };

  const handleReset = () => {
    setForm(initialState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
    setVideoPreview(null);
    setImagePreview(null);
  };

  const handleAttachmentPick = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const merged = [...attachmentFiles];
    const warnings: string[] = [];

    for (const file of files) {
      const key = fileKey(file);
      const isDuplicate = merged.some((existing) => fileKey(existing) === key);
      if (isDuplicate) {
        warnings.push(`Skipped duplicate: ${file.name}`);
        continue;
      }

      if (merged.length >= MAX_ATTACHMENTS) {
        warnings.push(`Maximum ${MAX_ATTACHMENTS} files. Additional files were ignored.`);
        break;
      }

      const mimeType = resolveUploadMimeType(file);
      if (!mimeType) {
        warnings.push(`Unsupported file type: ${file.name}`);
        continue;
      }

      const fileKind = inferFileKindFromMimeType(mimeType);
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

  const handleRemoveAttachment = (targetKey: string) => {
    setAttachmentFiles((prev) => prev.filter((file) => fileKey(file) !== targetKey));
    setVideoPreview((prev) => (prev?.key === targetKey ? null : prev));
    setImagePreview((prev) => (prev?.key === targetKey ? null : prev));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const attachmentCandidatesResult = prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      setErrorMessage(attachmentCandidatesResult.message);
      return;
    }

    const payload: CreateBuildingRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: extractPhoneDigits(form.phone),
      urgency: form.urgency,
      building: form.building,
      floor: Number(form.floor),
      locationDetail: form.locationDetail.trim(),
      problemCategoryId: form.problemCategoryId,
      description: form.description.trim(),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isOtherCategory) {
      payload.problemCategoryOther = form.problemCategoryOther.trim();
    }

    if (form.additionalDetails.trim()) {
      payload.additionalDetails = form.additionalDetails.trim();
    }

    setSubmitting(true);

    let createdRequestNo: string | null = null;

    try {
      const createResult = await createBuildingRequest(payload);
      createdRequestNo = createResult.requestNo;

      for (const candidate of attachmentCandidatesResult.candidates) {
        const ticket = await issueMyAttachmentUploadTicket(createResult.id, {
          fileKind: candidate.fileKind,
          fileName: candidate.file.name,
          mimeType: candidate.mimeType,
          fileSize: candidate.file.size,
        });

        await uploadFileToPresignedUrl(ticket, candidate.file);
        await completeMyAttachmentUpload(createResult.id, ticket.uploadToken);
      }

      router.push(`/requests/success/${encodeURIComponent(createResult.requestNo)}`);
    } catch (error) {
      if (createdRequestNo) {
        router.push(`/requests/success/${encodeURIComponent(createdRequestNo)}?attachments=partial`);
        return;
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit building request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 2 - Employee Core</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Building Repair Request</h1>
        <p className="mt-3 text-slate-700">Submit a building issue request with complete details and attachments.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">Loading departments and problem categories...</p>
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
                helpText="Enter 10 digits. It will be saved as numbers only."
                inputMode="numeric"
                pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
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

              <SelectField
                id="urgency"
                label="Urgency"
                required
                value={form.urgency}
                onChange={(event) => onChange("urgency", event.target.value as Urgency)}
              >
                {urgencyOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="building"
                label="Building"
                required
                value={form.building}
                onChange={(event) => onChange("building", event.target.value as BuildingSide)}
              >
                {buildingOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="floor"
                label="Floor"
                required
                value={String(form.floor)}
                onChange={(event) => onChange("floor", Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((floor) => (
                  <option key={floor} value={floor}>
                    Floor {floor}
                  </option>
                ))}
              </SelectField>
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

            <TextField
              id="locationDetail"
              label="Location Detail"
              required
              value={form.locationDetail}
              onChange={(event) => onChange("locationDetail", event.target.value)}
              placeholder="Front lobby near elevator"
              maxLength={200}
            />

            <SelectField
              id="problemCategoryId"
              label="Problem Category"
              required
              value={form.problemCategoryId}
              onChange={(event) => onChange("problemCategoryId", event.target.value)}
            >
              <option value="">Select category</option>
              {problemCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            {selectedProblemCategory?.helperText ? (
              <p className="-mt-2 text-sm text-slate-600">{selectedProblemCategory.helperText}</p>
            ) : null}

            {isOtherCategory ? (
              <TextField
                id="problemCategoryOther"
                label="Other Category"
                required
                value={form.problemCategoryOther}
                onChange={(event) => onChange("problemCategoryOther", event.target.value)}
                placeholder="Please describe"
                maxLength={120}
              />
            ) : null}

            <TextareaField
              id="description"
              label="Issue Description"
              required
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Describe what happened"
              rows={4}
              maxLength={2000}
            />

            <div className="space-y-2">
              <label htmlFor="attachments" className="block text-sm font-medium text-slate-800">
                Attachment Files <span className="ml-1 text-rose-600">*</span>
              </label>
              <input
                id="attachments"
                type="file"
                multiple
                accept={attachmentAccept}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  event.currentTarget.value = "";
                  handleAttachmentPick(selected);
                }}
              />
              <p className="text-xs text-slate-500">
                Supports image, video, and document files. Maximum {MAX_ATTACHMENTS} files, up to 50 MB per file.
              </p>

              {attachmentNotice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {attachmentNotice}
                </div>
              ) : null}

              {attachmentPreviews.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-slate-600">
                    Selected {attachmentPreviews.length}/{MAX_ATTACHMENTS} files
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {attachmentPreviews.map((preview) => (
                      <li
                        key={preview.key}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{preview.file.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {Math.max(preview.file.size / 1024 / 1024, 0.01).toFixed(2)} MB
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {preview.fileKind}
                          </span>
                        </div>

                        <div className="space-y-2 px-3 py-3">
                          {preview.fileKind === "IMAGE" ? (
                            <>
                              <button
                                type="button"
                                className="group relative block h-44 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                                aria-label={`Preview image ${preview.file.name}`}
                                onClick={() => setImagePreview(preview)}
                              >
                                <img
                                  src={preview.previewUrl}
                                  alt={preview.file.name}
                                  className="h-full w-full bg-white object-contain"
                                />
                                <span className="pointer-events-none absolute inset-0 bg-slate-900/5 transition group-hover:bg-slate-900/10" />
                                <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                                  Preview
                                </span>
                              </button>
                              <p className="text-[11px] text-slate-500">Tap image to open larger preview.</p>
                            </>
                          ) : null}
                          {preview.fileKind === "VIDEO" ? (
                            <>
                              <button
                                type="button"
                                className="group relative block h-44 w-full overflow-hidden rounded-lg border border-slate-200 bg-black"
                                aria-label="Play video preview"
                                onClick={() => setVideoPreview(preview)}
                              >
                                <video className="h-full w-full object-cover" muted playsInline preload="metadata">
                                  <source src={preview.previewUrl} type={preview.mimeType} />
                                </video>
                                <span className="pointer-events-none absolute inset-0 bg-slate-900/40 transition group-hover:bg-slate-900/25" />
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/90 bg-slate-900/75 text-white shadow-lg">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 translate-x-[1px] fill-current">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </span>
                                </span>
                              </button>
                              <p className="text-[11px] text-slate-500">Tap thumbnail to open larger preview (muted by default).</p>
                            </>
                          ) : null}

                          {preview.fileKind === "DOCUMENT" ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <a
                                href={preview.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                                      <path d="M14 2v5h5" className="fill-white" />
                                    </svg>
                                  </span>
                                  <div className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm font-semibold text-slate-800">{preview.file.name}</p>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                      {preview.mimeType.split("/")[1]?.toUpperCase() ?? "DOCUMENT"}
                                    </p>
                                  </div>
                                  <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white transition group-hover:bg-slate-700">
                                    Open
                                  </span>
                                </div>
                              </a>
                              <p className="mt-2 text-[11px] text-slate-500">Document preview opens in a new tab.</p>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            onClick={() => handleRemoveAttachment(preview.key)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <TextareaField
              id="additionalDetails"
              label="Additional Details"
              value={form.additionalDetails}
              onChange={(event) => onChange("additionalDetails", event.target.value)}
              placeholder="Optional notes"
              rows={3}
              maxLength={2000}
            />

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
                onClick={handleReset}
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
      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={videoPreview ? `Video preview: ${videoPreview.file.name}` : "Video preview"}
        src={videoPreview?.previewUrl ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </main>
  );
}
