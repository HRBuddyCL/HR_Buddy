"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  Button,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/form-controls";

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
    phone: address.phone.trim(),
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

function isValidPhone(value: string) {
  return /^\+?\d{9,15}$/.test(value.trim());
}

function validateAddress(
  sectionName: string,
  address: AddressState,
  options?: { requireContact: boolean },
) {
  const requireContact = options?.requireContact ?? true;

  if (requireContact && !address.name.trim()) {
    return `กรุณากรอกชื่อผู้${sectionName}`;
  }

  if (requireContact && !isValidPhone(address.phone)) {
    return `เบอร์โทรผู้${sectionName} ต้องเป็นตัวเลข 9-15 หลัก และอาจขึ้นต้นด้วย + ได้`;
  }

  if (!address.province.trim()) {
    return `กรุณาเลือกจังหวัดผู้${sectionName}`;
  }

  if (!address.district.trim()) {
    return `กรุณาเลือกเขต/อำเภอผู้${sectionName}`;
  }

  if (!address.subdistrict.trim()) {
    return `กรุณาเลือกแขวง/ตำบลผู้${sectionName}`;
  }

  if (!address.postalCode.trim()) {
    return `กรุณากรอกรหัสไปรษณีย์ผู้${sectionName}`;
  }

  if (!address.houseNo.trim()) {
    return `กรุณากรอกบ้านเลขที่ผู้${sectionName}`;
  }

  return null;
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

export default function Page() {
  const router = useRouter();

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
  };

  const updateReceiverAddress = <K extends keyof AddressState>(
    key: K,
    value: AddressState[K],
  ) => {
    setReceiver((prev) => ({ ...prev, [key]: value }));
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

  const validateBeforeSubmit = () => {
    if (!form.employeeName.trim()) {
      return "กรุณากรอกชื่อพนักงาน";
    }

    if (!form.departmentId) {
      return "กรุณาเลือกหน่วยงาน";
    }
    if (isOtherDepartment && !form.departmentOther.trim()) {
      return "กรุณาระบุชื่อหน่วยงานอื่น";
    }

    if (!isValidPhone(form.phone)) {
      return "เบอร์โทรต้องเป็นตัวเลข 9-15 หลัก และอาจขึ้นต้นด้วย + ได้";
    }

    if (!form.pickupDate) {
      return "กรุณาเลือกวันที่รับงาน";
    }

    if (Number.isNaN(new Date(`${form.pickupDate}T00:00:00`).getTime())) {
      return "วันที่รับงานไม่ถูกต้อง";
    }

    if (!form.itemDescription.trim()) {
      return "กรุณากรอกรายละเอียดสิ่งของ";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      return `รองรับสูงสุด ${MAX_ATTACHMENTS} ไฟล์เท่านั้น`;
    }

    const attachmentCandidatesResult =
      prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      return attachmentCandidatesResult.message;
    }

    if (requiresDeliveryServiceOther && !form.deliveryServiceOther.trim()) {
      return "กรุณาระบุบริการจัดส่งอื่น";
    }

    const receiverError = validateAddress("รับ", receiver);
    if (receiverError) {
      return receiverError;
    }

    return null;
  };

  const handleReset = () => {
    setForm(initialFormState);
    setReceiver(createInitialAddressState());
    setReceiverGeo(emptyGeoState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
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
  };

  const handleRemoveAttachment = (targetKey: string) => {
    setAttachmentFiles((prev) =>
      prev.filter((file) => fileKey(file) !== targetKey),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const attachmentCandidatesResult =
      prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      setErrorMessage(attachmentCandidatesResult.message);
      return;
    }

    const payload: CreateMessengerRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: form.phone.trim(),
      pickupDatetime: new Date(`${form.pickupDate}T00:00:00`).toISOString(),
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

    setSubmitting(true);
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

      router.push(`/requests/success/${encodeURIComponent(result.requestNo)}`);
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
        setErrorMessage("ส่งคำขอเมสเซนเจอร์ไม่สำเร็จ");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          แบบฟอร์มคำขอใช้บริการ Messenger
        </h1>
        <p className="mt-3 text-slate-700">
          สร้างคำขอเมสเซนเจอร์ พร้อมข้อมูลผู้ส่งและผู้รับ โดยหน้านี้เชื่อมต่อ
          API หน่วยงาน, ข้อมูลพื้นที่ และการสร้างคำขอเรียบร้อยแล้ว
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">
            กำลังโหลดข้อมูลหน่วยงานและพื้นที่...
          </p>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="employeeName"
                label="ชื่อพนักงาน"
                required
                value={form.employeeName}
                onChange={(event) =>
                  onChange("employeeName", event.target.value)
                }
                placeholder="Thanaruk T."
                maxLength={120}
              />

              <TextField
                id="phone"
                label="เบอร์โทร"
                required
                value={form.phone}
                onChange={(event) => onChange("phone", event.target.value)}
                placeholder="+66812345678"
                maxLength={20}
              />

              <SelectField
                id="departmentId"
                label="หน่วยงาน"
                required
                value={form.departmentId}
                onChange={(event) =>
                  onChange("departmentId", event.target.value)
                }
              >
                <option value="">เลือกหน่วยงาน</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectField>

              {isOtherDepartment ? (
                <TextField
                  id="departmentOther"
                  label="หน่วยงานอื่น"
                  required
                  value={form.departmentOther}
                  onChange={(event) =>
                    onChange("departmentOther", event.target.value)
                  }
                  placeholder="โปรดระบุชื่อหน่วยงาน"
                  maxLength={120}
                />
              ) : null}
              <TextField
                id="pickupDate"
                label="วันที่รับงาน"
                required
                type="date"
                value={form.pickupDate}
                onChange={(event) => onChange("pickupDate", event.target.value)}
              />

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

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">ไฟล์แนบ</h2>
              <p className="mt-1 text-sm text-slate-600">
                รองรับไฟล์รูปภาพ วิดีโอ และเอกสาร สูงสุด {MAX_ATTACHMENTS} ไฟล์
              </p>

              <div className="mt-4">
                <input
                  id="attachments"
                  type="file"
                  multiple
                  accept={attachmentAccept}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    handleAttachmentPick(selected);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {attachmentNotice ? (
                <p className="mt-3 text-sm text-amber-700">
                  {attachmentNotice}
                </p>
              ) : null}

              {attachmentFiles.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {attachmentFiles.map((file) => {
                    const key = fileKey(file);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <span className="truncate pr-3 text-slate-700">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => handleRemoveAttachment(key)}
                        >
                          ลบ
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">
                จุดส่งของ
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField
                  id="receiverName"
                  label="ชื่อผู้รับ"
                  required
                  value={receiver.name}
                  onChange={(event) =>
                    updateReceiverAddress("name", event.target.value)
                  }
                  maxLength={120}
                />

                <TextField
                  id="receiverPhone"
                  label="เบอร์โทรผู้รับ"
                  required
                  value={receiver.phone}
                  onChange={(event) =>
                    updateReceiverAddress("phone", event.target.value)
                  }
                  maxLength={20}
                />

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

                <TextField
                  id="receiverPostalCode"
                  label="รหัสไปรษณีย์"
                  required
                  value={receiver.postalCode}
                  readOnly
                  maxLength={10}
                />

                <TextField
                  id="receiverHouseNo"
                  label="บ้านเลขที่"
                  required
                  value={receiver.houseNo}
                  onChange={(event) =>
                    updateReceiverAddress("houseNo", event.target.value)
                  }
                  maxLength={120}
                />

                <TextField
                  id="receiverSoi"
                  label="ซอย"
                  value={receiver.soi ?? ""}
                  onChange={(event) =>
                    updateReceiverAddress("soi", event.target.value)
                  }
                  maxLength={120}
                />

                <TextField
                  id="receiverRoad"
                  label="ถนน"
                  value={receiver.road ?? ""}
                  onChange={(event) =>
                    updateReceiverAddress("road", event.target.value)
                  }
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
                  rows={2}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">
                ขอบเขตการจัดส่ง
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                ระบบจะคำนวณขอบเขตจากจังหวัดของผู้รับอัตโนมัติ
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting || loadingReferences}>
                {submitting ? "กำลังส่ง..." : "ส่งคำขอ"}
              </Button>
              <Button
                type="button"
                className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                onClick={handleReset}
                disabled={submitting}
              >
                ล้างข้อมูล
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
