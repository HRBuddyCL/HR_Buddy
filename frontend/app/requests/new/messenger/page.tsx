"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ApiError } from "@/lib/api/client";
import {
  getGeoDistricts,
  getGeoPostalCode,
  getGeoProvinces,
  getGeoSubdistricts,
} from "@/lib/api/geo";
import { getDepartments, type ReferenceListItem } from "@/lib/api/reference";
import {
  createMessengerRequest,
  type AddressPayload,
  type CreateMessengerRequestPayload,
  type DeliveryService,
  type ItemType,
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
import {
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/form-controls";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { ErrorToast } from "@/components/ui/error-toast";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";

const itemTypeOptions: Array<{ value: ItemType; label: string }> = [
  { value: "DOCUMENT", label: "เอกสาร" },
  { value: "PACKAGE", label: "พัสดุ" },
];

const deliveryServiceOptions: Array<{ value: DeliveryService; label: string }> =
  [
    { value: "POST", label: "ไปรษณีย์" },
    { value: "NAKHONCHAI_AIR", label: "นครชัยแอร์" },
    { value: "OTHER", label: "อื่นๆ" },
  ];

type AddressState = Omit<AddressPayload, "soi" | "road" | "extra"> & {
  soi: string;
  road: string;
  extra: string;
};

type AddressGeoState = {
  districts: string[];
  subdistricts: string[];
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

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  pickupDate: string;
  itemType: ItemType;
  itemDescription: string;
  additionalNote: string;
  deliveryService: DeliveryService;
  deliveryServiceOther: string;
};

const BKK_METRO_PROVINCES = new Set([
  "กรุงเทพมหานคร",
  "นนทบุรี",
  "ปทุมธานี",
  "สมุทรปราการ",
  "นครปฐม",
  "สมุทรสาคร",
  "Bangkok",
  "Nonthaburi",
  "Pathum Thani",
  "Samut Prakan",
  "Nakhon Pathom",
  "Samut Sakhon",
]);

const MAX_ATTACHMENTS = 5;

const attachmentAccept = [
  getAcceptMimeTypes("IMAGE"),
  getAcceptMimeTypes("VIDEO"),
  getAcceptMimeTypes("DOCUMENT"),
].join(",");

const createInitialAddressState = (): AddressState => ({
  name: "",
  phone: "",
  province: "",
  district: "",
  subdistrict: "",
  postalCode: "",
  houseNo: "",
  soi: "",
  road: "",
  extra: "",
});

const initialFormState: FormState = {
  employeeName: "",
  departmentId: "",
  departmentOther: "",
  phone: "",
  pickupDate: "",
  itemType: "DOCUMENT",
  itemDescription: "",
  additionalNote: "",
  deliveryService: "POST",
  deliveryServiceOther: "",
};

const emptyGeoState: AddressGeoState = {
  districts: [],
  subdistricts: [],
};

function normalizeAddress(address: AddressState): AddressPayload {
  return {
    name: address.name.trim(),
    phone: extractPhoneDigits(address.phone),
    province: address.province.trim(),
    district: address.district.trim(),
    subdistrict: address.subdistrict.trim(),
    postalCode: address.postalCode.trim(),
    houseNo: address.houseNo.trim(),
    ...(address.soi.trim() ? { soi: address.soi.trim() } : {}),
    ...(address.road.trim() ? { road: address.road.trim() } : {}),
    ...(address.extra.trim() ? { extra: address.extra.trim() } : {}),
  };
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

function isValidPhone(value: string) {
  return extractPhoneDigits(value).length === 10;
}

function isOutsideBkkMetroByProvince(province: string) {
  const normalized = province.trim();
  if (!normalized) {
    return false;
  }

  return !BKK_METRO_PROVINCES.has(normalized);
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function toThailandStartOfDayIso(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function formatThaiBuddhistDate(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return "";
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function getThailandTodayDateValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
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
  const pickupDateInputRef = useRef<HTMLInputElement | null>(null);

  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [receiver, setReceiver] = useState<AddressState>(
    createInitialAddressState(),
  );

  const [receiverGeo, setReceiverGeo] =
    useState<AddressGeoState>(emptyGeoState);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);

      try {
        const [departmentsResult, provincesResult] = await Promise.all([
          getDepartments(),
          getGeoProvinces(),
        ]);

        if (!active) {
          return;
        }

        setDepartments(departmentsResult.items);
        setProvinces(provincesResult);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("โหลดข้อมูลอ้างอิงไม่สำเร็จ");
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

  const updateReceiverAddress = <K extends keyof AddressState>(
    key: K,
    value: AddressState[K],
  ) => {
    setReceiver((prev) => ({ ...prev, [key]: value }));

    const receiverFieldErrorMap: Partial<Record<keyof AddressState, string>> = {
      name: "receiverName",
      phone: "receiverPhone",
      province: "receiverProvince",
      district: "receiverDistrict",
      subdistrict: "receiverSubdistrict",
      postalCode: "receiverPostalCode",
      houseNo: "receiverHouseNo",
    };

    const mappedField = receiverFieldErrorMap[key];
    if (mappedField && fieldErrors[mappedField]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[mappedField];
        return next;
      });
    }
  };

  const handleRequesterPhoneChange = (value: string) => {
    onChange("phone", formatPhoneDisplay(value));
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.phone;
        return next;
      });
    }
  };

  const handleReceiverPhoneChange = (value: string) => {
    updateReceiverAddress("phone", formatPhoneDisplay(value));
    if (fieldErrors.receiverPhone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.receiverPhone;
        return next;
      });
    }
  };

  const openPickupDatePicker = () => {
    const input = pickupDateInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!receiver.province) {
        setReceiverGeo(emptyGeoState);
        return;
      }

      setReceiverGeo(emptyGeoState);
      setReceiver((prev) => ({
        ...prev,
        district: "",
        subdistrict: "",
        postalCode: "",
      }));

      try {
        const districts = await getGeoDistricts(receiver.province);

        if (!active) {
          return;
        }

        setReceiverGeo({ districts, subdistricts: [] });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("โหลดเขต/อำเภอของผู้รับไม่สำเร็จ");
        }
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [receiver.province]);

  useEffect(() => {
    let active = true;

    async function loadSubdistricts() {
      if (!receiver.province || !receiver.district) {
        setReceiverGeo((prev) => ({ ...prev, subdistricts: [] }));
        setReceiver((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));
        return;
      }

      setReceiverGeo((prev) => ({ ...prev, subdistricts: [] }));
      setReceiver((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));

      try {
        const subdistricts = await getGeoSubdistricts(
          receiver.province,
          receiver.district,
        );

        if (!active) {
          return;
        }

        setReceiverGeo((prev) => ({ ...prev, subdistricts }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("โหลดแขวง/ตำบลของผู้รับไม่สำเร็จ");
        }
      }
    }

    void loadSubdistricts();

    return () => {
      active = false;
    };
  }, [receiver.province, receiver.district]);

  useEffect(() => {
    let active = true;

    async function loadPostalCode() {
      if (!receiver.province || !receiver.district || !receiver.subdistrict) {
        setReceiver((prev) => ({ ...prev, postalCode: "" }));
        return;
      }

      try {
        const result = await getGeoPostalCode(
          receiver.province,
          receiver.district,
          receiver.subdistrict,
        );

        if (!active) {
          return;
        }

        setReceiver((prev) => ({
          ...prev,
          postalCode: result.postalCode ?? "",
        }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("โหลดรหัสไปรษณีย์ของผู้รับไม่สำเร็จ");
        }
      }
    }

    void loadPostalCode();

    return () => {
      active = false;
    };
  }, [receiver.province, receiver.district, receiver.subdistrict]);

  const isOtherDepartment = useMemo(
    () => form.departmentId === "dept_other",
    [form.departmentId],
  );
  const outsideBkkMetro = useMemo(
    () => isOutsideBkkMetroByProvince(receiver.province),
    [receiver.province],
  );
  const requiresDeliveryService = useMemo(
    () => outsideBkkMetro,
    [outsideBkkMetro],
  );
  const requiresDeliveryServiceOther = useMemo(
    () => requiresDeliveryService && form.deliveryService === "OTHER",
    [requiresDeliveryService, form.deliveryService],
  );
  const pickupDateDisplay = useMemo(
    () => formatThaiBuddhistDate(form.pickupDate),
    [form.pickupDate],
  );
  const minPickupDate = useMemo(() => getThailandTodayDateValue(), []);

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

  const validateBeforeSubmit = () => {
    const errors: Record<string, string> = {};

    if (!form.employeeName.trim()) {
      errors.employeeName = "กรุณากรอกชื่อ-นามสกุล";
    }

    if (!form.departmentId) {
      errors.departmentId = "กรุณาเลือกแผนก";
    }
    if (isOtherDepartment && !form.departmentOther.trim()) {
      errors.departmentOther = "กรุณาระบุชื่อหน่วยงานอื่น";
    }

    if (!isValidPhone(form.phone)) {
      errors.phone = "หมายเลขโทรศัพท์ต้องมีตัวเลข 10 หลัก";
    }

    if (!form.pickupDate) {
      errors.pickupDate = "กรุณาเลือกวันที่จัดส่ง";
    }

    if (!toThailandStartOfDayIso(form.pickupDate)) {
      errors.pickupDate = "วันที่จัดส่งไม่ถูกต้อง";
    }

    if (minPickupDate && form.pickupDate < minPickupDate) {
      errors.pickupDate = "วันที่จัดส่งต้องเป็นวันปัจจุบันหรืออนาคตเท่านั้น";
    }

    if (!form.itemDescription.trim()) {
      errors.itemDescription = "กรุณากรอกรายละเอียดสิ่งของ";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      errors.attachments = `รองรับสูงสุด ${MAX_ATTACHMENTS} ไฟล์เท่านั้น`;
    }

    const attachmentCandidatesResult =
      prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      errors.attachments = attachmentCandidatesResult.message;
    }

    if (requiresDeliveryServiceOther && !form.deliveryServiceOther.trim()) {
      errors.deliveryServiceOther = "กรุณาระบุบริการจัดส่งอื่น";
    }

    if (!receiver.name.trim()) {
      errors.receiverName = "กรุณากรอกชื่อผู้รับ";
    }

    if (!isValidPhone(receiver.phone)) {
      errors.receiverPhone = "หมายเลขโทรศัพท์ต้องมีตัวเลข 10 หลัก";
    }

    if (!receiver.province.trim()) {
      errors.receiverProvince = "กรุณาเลือกจังหวัดผู้รับ";
    }

    if (receiver.province.trim() && !receiver.district.trim()) {
      errors.receiverDistrict = "กรุณาเลือกเขต/อำเภอผู้รับ";
    } else if (receiver.district.trim() && !receiver.subdistrict.trim()) {
      errors.receiverSubdistrict = "กรุณาเลือกแขวง/ตำบลผู้รับ";
    }

    if (!receiver.houseNo.trim()) {
      errors.receiverHouseNo = "กรุณากรอกบ้านเลขที่ผู้รับ";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const doReset = () => {
    setShowConfirmReset(false);
    setForm(initialFormState);
    setReceiver(createInitialAddressState());
    setReceiverGeo(emptyGeoState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
    setVideoPreview(null);
    setImagePreview(null);
    setDocumentPreview(null);
    setFieldErrors({});
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
        warnings.push("รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสารเท่านั้น");
        continue;
      }

      const fileKind = inferFileKindFromMimeType(resolvedMimeType);
      if (!fileKind) {
        warnings.push("รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสารเท่านั้น");
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

  const handleRemoveAttachment = (targetKey: string) => {
    setAttachmentFiles((prev) =>
      prev.filter((file) => fileKey(file) !== targetKey),
    );
    setVideoPreview((prev) => (prev?.key === targetKey ? null : prev));
    setImagePreview((prev) => (prev?.key === targetKey ? null : prev));
    setDocumentPreview((prev) => (prev?.key === targetKey ? null : prev));
  };

  const handleOpenDocumentPreview = (preview: AttachmentPreview) => {
    setDocumentPreview(preview);
  };

  const handleDownloadDocumentFile = (preview: AttachmentPreview) => {
    const link = document.createElement("a");
    link.href = preview.previewUrl;
    link.download = preview.file.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentAction = (preview: AttachmentPreview) => {
    if (preview.mimeType.toLowerCase() === "application/pdf") {
      handleOpenDocumentPreview(preview);
      return;
    }

    handleDownloadDocumentFile(preview);
  };

  const setSuccessCookies = (
    nextRequestNo: string,
    hasPartialAttachments = false,
  ) => {
    document.cookie = `hrb_success_request_no=${encodeURIComponent(nextRequestNo)}; Path=/; Max-Age=600; SameSite=Lax`;
    if (hasPartialAttachments) {
      document.cookie =
        "hrb_success_attachments=partial; Path=/; Max-Age=600; SameSite=Lax";
      return;
    }
    document.cookie =
      "hrb_success_attachments=; Path=/; Max-Age=0; SameSite=Lax";
  };

  const performSubmit = async () => {
    setShowConfirmSubmit(false);
    setSubmitting(true);
    setErrorMessage(null);

    const attachmentCandidatesResult =
      prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      setErrorMessage(attachmentCandidatesResult.message);
      setSubmitting(false);
      return;
    }

    const pickupDatetime = toThailandStartOfDayIso(form.pickupDate);
    if (!pickupDatetime) {
      setErrorMessage("วันที่จัดส่งไม่ถูกต้อง");
      setSubmitting(false);
      return;
    }

    const payload: CreateMessengerRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: extractPhoneDigits(form.phone),
      pickupDatetime,
      itemType: form.itemType,
      itemDescription: form.additionalNote.trim()
        ? `${form.itemDescription.trim()}\n\nหมายเหตุเพิ่มเติม: ${form.additionalNote.trim()}`
        : form.itemDescription.trim(),
      outsideBkkMetro,
      receiver: normalizeAddress(receiver),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (outsideBkkMetro) {
      payload.deliveryService = form.deliveryService;

      if (form.deliveryService === "OTHER") {
        payload.deliveryServiceOther = form.deliveryServiceOther.trim();
      }
    }

    let createdRequestNo: string | null = null;

    try {
      const result = await createMessengerRequest(payload);
      createdRequestNo = result.requestNo;

      for (const candidate of attachmentCandidatesResult.candidates) {
        const ticket = await issueMyAttachmentUploadTicket(result.id, {
          fileKind: candidate.fileKind,
          fileName: candidate.file.name,
          mimeType: candidate.mimeType,
          fileSize: candidate.file.size,
        });

        await uploadFileToPresignedUrl(ticket, candidate.file);
        await completeMyAttachmentUpload(result.id, ticket.uploadToken);
      }

      setSuccessCookies(result.requestNo);
      router.push("/requests/success");
    } catch (error) {
      if (createdRequestNo) {
        setSuccessCookies(createdRequestNo, true);
        router.push("/requests/success");
        return;
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ส่งคำขอเมสเซนเจอร์ไม่สำเร็จ");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (!validationError) {
      return;
    }

    setShowConfirmSubmit(true);
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
            <span className="text-slate-600">คำขอเมสเซนเจอร์</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]">
              <span className="text-2xl">📬</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2d4c] sm:text-2xl">
                แบบฟอร์มคำขอใช้บริการเมสเซนเจอร์
              </h1>
              <p className="text-sm text-slate-500">
                กรอกข้อมูลให้ครบถ้วนและแนบไฟล์ประกอบการจัดส่ง
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingReferences ? (
          <div className="space-y-4">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
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
                    onChange={(event) =>
                      handleRequesterPhoneChange(event.target.value)
                    }
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
                      placeholder="ชื่อแผนก"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.departmentOther} />
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel stepNumber={2} title="รายละเอียดสิ่งของ">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="pickupDateDisplay"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      วันที่จัดส่ง{" "}
                      <span className="ml-0.5 text-[#b62026]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="pickupDateDisplay"
                        type="text"
                        readOnly
                        value={pickupDateDisplay}
                        placeholder="วัน/เดือน/ปี พ.ศ."
                        onClick={openPickupDatePicker}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#0e2d4c] focus:ring-2 focus:ring-[#0e2d4c]/10"
                      />
                      <button
                        type="button"
                        onClick={openPickupDatePicker}
                        className="absolute inset-y-0 right-1 flex items-center rounded-lg px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="เลือกวันที่จัดส่ง"
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
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                      <input
                        ref={pickupDateInputRef}
                        id="pickupDate"
                        type="date"
                        min={minPickupDate}
                        value={form.pickupDate}
                        onChange={(event) =>
                          onChange("pickupDate", event.target.value)
                        }
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0"
                      />
                    </div>
                    <FieldError message={fieldErrors.pickupDate} />
                  </div>

                  <SelectField
                    id="itemType"
                    label="ประเภทสิ่งของ"
                    required
                    value={form.itemType}
                    onChange={(event) =>
                      onChange("itemType", event.target.value as ItemType)
                    }
                  >
                    {itemTypeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <TextareaField
                    id="itemDescription"
                    label="รายละเอียดสิ่งของ"
                    required
                    value={form.itemDescription}
                    onChange={(event) =>
                      onChange("itemDescription", event.target.value)
                    }
                    placeholder="อธิบายสิ่งของที่ต้องจัดส่ง"
                    rows={4}
                    maxLength={2000}
                  />
                  <FieldError message={fieldErrors.itemDescription} />
                </div>

                <TextareaField
                  id="additionalNote"
                  label="หมายเหตุเพิ่มเติม"
                  value={form.additionalNote}
                  onChange={(event) =>
                    onChange("additionalNote", event.target.value)
                  }
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                  rows={3}
                  maxLength={500}
                />
              </div>
            </Panel>

            <Panel stepNumber={3} title="ไฟล์แนบ">
              <div className="space-y-4">
                <label
                  htmlFor="attachments"
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
                      แตะเพื่อเลือกไฟล์
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

                <FieldError message={fieldErrors.attachments} />

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

            <Panel stepNumber={4} title="ข้อมูลผู้รับ">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <TextField
                    id="receiverName"
                    label="ชื่อ-นามสกุล"
                    required
                    value={receiver.name}
                    onChange={(event) =>
                      updateReceiverAddress("name", event.target.value)
                    }
                    placeholder="สมหญิง ใจดี"
                    maxLength={120}
                  />
                  <FieldError message={fieldErrors.receiverName} />
                </div>

                <div className="sm:col-span-2">
                  <TextField
                    id="receiverPhone"
                    label="เบอร์โทรศัพท์"
                    required
                    value={receiver.phone}
                    onChange={(event) =>
                      handleReceiverPhoneChange(event.target.value)
                    }
                    placeholder="012-345-6789"
                    inputMode="numeric"
                    maxLength={12}
                  />
                  <FieldError message={fieldErrors.receiverPhone} />
                </div>

                <div>
                  <SelectField
                    id="receiverProvince"
                    label="จังหวัด"
                    required
                    value={receiver.province}
                    onChange={(event) =>
                      updateReceiverAddress("province", event.target.value)
                    }
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.receiverProvince} />
                </div>

                <div>
                  <SelectField
                    id="receiverDistrict"
                    label="เขต/อำเภอ"
                    required
                    value={receiver.district}
                    onChange={(event) =>
                      updateReceiverAddress("district", event.target.value)
                    }
                    disabled={!receiver.province}
                  >
                    <option value="">เลือกเขต/อำเภอ</option>
                    {receiverGeo.districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.receiverDistrict} />
                </div>

                <div>
                  <SelectField
                    id="receiverSubdistrict"
                    label="แขวง/ตำบล"
                    required
                    value={receiver.subdistrict}
                    onChange={(event) =>
                      updateReceiverAddress("subdistrict", event.target.value)
                    }
                    disabled={!receiver.district}
                  >
                    <option value="">เลือกแขวง/ตำบล</option>
                    {receiverGeo.subdistricts.map((subdistrict) => (
                      <option key={subdistrict} value={subdistrict}>
                        {subdistrict}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.receiverSubdistrict} />
                </div>

                <div>
                  <TextField
                    id="receiverPostalCode"
                    label="รหัสไปรษณีย์"
                    required
                    value={receiver.postalCode}
                    disabled={!receiver.subdistrict}
                    readOnly
                    maxLength={10}
                  />
                  <FieldError message={fieldErrors.receiverPostalCode} />
                </div>

                <div className="sm:col-span-2">
                  <TextField
                    id="receiverHouseNo"
                    label="บ้านเลขที่"
                    required
                    value={receiver.houseNo}
                    onChange={(event) =>
                      updateReceiverAddress("houseNo", event.target.value)
                    }
                    placeholder="99/123"
                    maxLength={120}
                  />
                  <FieldError message={fieldErrors.receiverHouseNo} />
                </div>

                <TextField
                  id="receiverRoad"
                  label="ถนน"
                  value={receiver.road ?? ""}
                  onChange={(event) =>
                    updateReceiverAddress("road", event.target.value)
                  }
                  placeholder="สุขุมวิท"
                  maxLength={120}
                />

                <TextField
                  id="receiverSoi"
                  label="ซอย"
                  value={receiver.soi ?? ""}
                  onChange={(event) =>
                    updateReceiverAddress("soi", event.target.value)
                  }
                  placeholder="สุขุมวิท 24"
                  maxLength={120}
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  id="receiverExtra"
                  label="รายละเอียดเพิ่มเติม"
                  value={receiver.extra ?? ""}
                  onChange={(event) =>
                    updateReceiverAddress("extra", event.target.value)
                  }
                  placeholder="ส่งที่นิติบุคคลชั้น 1 ฝากพัสดุ"
                  rows={2}
                  maxLength={200}
                />
              </div>
            </Panel>

            <Panel stepNumber={5} title="ขอบเขตการจัดส่ง">
              <div className="mt grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id="outsideBkkMetro"
                  label="นอกเขตกรุงเทพและปริมณฑล"
                  value={outsideBkkMetro ? "ใช่" : "ไม่ใช่"}
                  disabled
                />

                {requiresDeliveryService ? (
                  <SelectField
                    id="deliveryService"
                    label="บริการจัดส่ง"
                    required
                    value={form.deliveryService}
                    onChange={(event) =>
                      onChange(
                        "deliveryService",
                        event.target.value as DeliveryService,
                      )
                    }
                  >
                    {deliveryServiceOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
              </div>

              {requiresDeliveryServiceOther ? (
                <div className="mt-4">
                  <TextField
                    id="deliveryServiceOther"
                    label="บริการจัดส่งอื่น"
                    required
                    value={form.deliveryServiceOther}
                    onChange={(event) =>
                      onChange("deliveryServiceOther", event.target.value)
                    }
                    placeholder="โปรดระบุบริการจัดส่ง"
                    maxLength={120}
                  />
                  <FieldError message={fieldErrors.deliveryServiceOther} />
                </div>
              ) : null}
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
                  กรุณาตรวจสอบข้อมูลก่อนส่งคำขอ
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:w-auto">
                  <div className="flex items-center gap-2 sm:order-1">
                    <Link
                      href="/"
                      className="w-full sm:w-auto inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 shadow-sm"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e2d4c] px-10 py-3 text-sm font-bold text-white transition hover:bg-[#1a4a7a] disabled:opacity-60 sm:w-auto shadow-lg"
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
                        ส่งคำขอเมสเซนเจอร์
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
