"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
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
  createDocumentRequest,
  type AddressPayload,
  type CreateDocumentRequestPayload,
  type DeliveryMethod,
  type Urgency,
} from "@/lib/api/requests";
import {
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/form-controls";
import ConfirmModal from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { ErrorToast } from "@/components/ui/error-toast";

const urgencyOptions: Array<{
  value: Urgency;
  label: string;
  description: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  icon: string;
  iconBg: string;
}> = [
  {
    value: "NORMAL",
    label: "ปกติ",
    description: "เอกสารคาดว่าจะแล้วเสร็จภายในประมาณ 1 สัปดาห์",
    color: "text-blue-600",
    activeBg: "bg-blue-600 text-white",
    activeBorder: "border-blue-600",
    icon: "🗂️",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    value: "HIGH",
    label: "สูง",
    description: "เอกสารคาดว่าจะแล้วเสร็จภายในประมาณ 3-4 วัน",
    color: "text-orange-600",
    activeBg: "bg-orange-600 text-white",
    activeBorder: "border-orange-600",
    icon: "⏱️",
    iconBg: "bg-orange-100 text-orange-700",
  },
  {
    value: "CRITICAL",
    label: "เร่งด่วน",
    description: "เอกสารคาดว่าจะแล้วเสร็จภายในประมาณ 1-2 วัน",
    color: "text-red-600",
    activeBg: "bg-red-600 text-white",
    activeBorder: "border-red-600",
    icon: "🚨",
    iconBg: "bg-red-100 text-red-700",
  },
];

const deliveryMethodOptions: Array<{ value: DeliveryMethod; label: string }> = [
  { value: "DIGITAL", label: "ดิจิทัล" },
  { value: "POSTAL", label: "ไปรษณีย์" },
  { value: "PICKUP", label: "รับด้วยตนเอง" },
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

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  urgency: Urgency;
  siteNameRaw: string;
  documentDescription: string;
  purpose: string;
  deliveryMethod: DeliveryMethod;
  note: string;
};

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
  urgency: "NORMAL",
  siteNameRaw: "",
  documentDescription: "",
  purpose: "",
  deliveryMethod: "DIGITAL",
  note: "",
};

const emptyGeoState: AddressGeoState = {
  districts: [],
  subdistricts: [],
};

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

function isValidRequesterPhone(value: string) {
  return extractPhoneDigits(value).length === 10;
}

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
  const [provinces, setProvinces] = useState<string[]>([]);
  const [addressGeo, setAddressGeo] = useState<AddressGeoState>(emptyGeoState);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [address, setAddress] = useState<AddressState>(
    createInitialAddressState(),
  );

  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const isPostal = useMemo(
    () => form.deliveryMethod === "POSTAL",
    [form.deliveryMethod],
  );
  const isOtherDepartment = useMemo(
    () => form.departmentId === "dept_other",
    [form.departmentId],
  );
  const selectedUrgencyOption = useMemo(
    () =>
      urgencyOptions.find((option) => option.value === form.urgency) ?? null,
    [form.urgency],
  );
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

  useEffect(() => {
    if (isPostal) {
      return;
    }

    setAddress(createInitialAddressState());
    setAddressGeo(emptyGeoState);
  }, [isPostal]);

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!isPostal || !address.province) {
        setAddressGeo(emptyGeoState);
        return;
      }

      setAddressGeo(emptyGeoState);
      setAddress((prev) => ({
        ...prev,
        district: "",
        subdistrict: "",
        postalCode: "",
      }));

      try {
        const districts = await getGeoDistricts(address.province);

        if (!active) {
          return;
        }

        setAddressGeo({ districts, subdistricts: [] });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดเขต/อำเภอได้");
        }
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [address.province, isPostal]);

  useEffect(() => {
    let active = true;

    async function loadSubdistricts() {
      if (!isPostal || !address.province || !address.district) {
        setAddressGeo((prev) => ({ ...prev, subdistricts: [] }));
        setAddress((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));
        return;
      }

      setAddressGeo((prev) => ({ ...prev, subdistricts: [] }));
      setAddress((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));

      try {
        const subdistricts = await getGeoSubdistricts(
          address.province,
          address.district,
        );

        if (!active) {
          return;
        }

        setAddressGeo((prev) => ({ ...prev, subdistricts }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("ไม่สามารถโหลดแขวง/ตำบลได้");
        }
      }
    }

    void loadSubdistricts();

    return () => {
      active = false;
    };
  }, [address.province, address.district, isPostal]);

  useEffect(() => {
    let active = true;

    async function loadPostalCode() {
      if (
        !isPostal ||
        !address.province ||
        !address.district ||
        !address.subdistrict
      ) {
        setAddress((prev) => ({ ...prev, postalCode: "" }));
        return;
      }

      try {
        const result = await getGeoPostalCode(
          address.province,
          address.district,
          address.subdistrict,
        );

        if (!active) {
          return;
        }

        setAddress((prev) => ({
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
          setErrorMessage("ไม่สามารถโหลดรหัสไปรษณีย์ได้");
        }
      }
    }

    void loadPostalCode();

    return () => {
      active = false;
    };
  }, [address.province, address.district, address.subdistrict, isPostal]);

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

  const onAddressChange = <K extends keyof AddressState>(
    key: K,
    value: AddressState[K],
  ) => {
    setAddress((prev) => ({ ...prev, [key]: value }));

    const addressFieldErrorMap: Partial<Record<keyof AddressState, string>> = {
      name: "addressName",
      phone: "addressPhone",
      province: "addressProvince",
      district: "addressDistrict",
      subdistrict: "addressSubdistrict",
      postalCode: "addressPostalCode",
      houseNo: "addressHouseNo",
    };

    const mappedField = addressFieldErrorMap[key];
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

  const handleAddressPhoneChange = (value: string) => {
    onAddressChange("phone", formatPhoneDisplay(value));
    if (fieldErrors.addressPhone) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.addressPhone;
        return next;
      });
    }
  };

  const clearPostalAddressErrors = () => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      const postalErrorKeys = [
        "addressName",
        "addressPhone",
        "addressProvince",
        "addressDistrict",
        "addressSubdistrict",
        "addressPostalCode",
        "addressHouseNo",
      ];

      let changed = false;
      for (const key of postalErrorKeys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
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
      errors.departmentOther = "กรุณาระบุชื่อแผนกอื่น";
    }

    if (!isValidRequesterPhone(form.phone)) {
      errors.phone = "หมายเลขโทรศัพท์ต้องมีตัวเลข 10 หลัก";
    }

    if (!form.siteNameRaw.trim()) {
      errors.siteNameRaw = "กรุณากรอกชื่อไซต์/หน่วยงาน";
    }

    if (!form.documentDescription.trim()) {
      errors.documentDescription = "กรุณากรอกรายละเอียดเอกสาร";
    }

    if (!form.purpose.trim()) {
      errors.purpose = "กรุณากรอกวัตถุประสงค์";
    }

    if (isPostal) {
      if (!address.name.trim()) {
        errors.addressName = "กรุณากรอกชื่อผู้รับ";
      }

      if (!isValidPhone(address.phone)) {
        errors.addressPhone = "หมายเลขโทรศัพท์ผู้รับ ต้องมีตัวเลข 10 หลัก";
      }

      if (!address.province.trim()) {
        errors.addressProvince = "กรุณาเลือกจังหวัดผู้รับ";
      }

      if (address.province.trim() && !address.district.trim()) {
        errors.addressDistrict = "กรุณาเลือกเขต/อำเภอผู้รับ";
      } else if (address.district.trim() && !address.subdistrict.trim()) {
        errors.addressSubdistrict = "กรุณาเลือกแขวง/ตำบลผู้รับ";
      }

      if (!address.houseNo.trim()) {
        errors.addressHouseNo = "กรุณากรอกบ้านเลขที่ผู้รับ";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const doReset = () => {
    setShowConfirmReset(false);
    setForm(initialFormState);
    setAddress(createInitialAddressState());
    setAddressGeo(emptyGeoState);
    setErrorMessage(null);
    setFieldErrors({});
  };

  const performSubmit = async () => {
    setShowConfirmSubmit(false);
    setSubmitting(true);
    setErrorMessage(null);

    const payload: CreateDocumentRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: extractPhoneDigits(form.phone),
      urgency: isPostal ? "NORMAL" : form.urgency,
      siteNameRaw: form.siteNameRaw.trim(),
      documentDescription: form.documentDescription.trim(),
      purpose: form.purpose.trim(),
      deliveryMethod: form.deliveryMethod,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isPostal) {
      payload.deliveryAddress = normalizeAddress(address);
    }

    try {
      const result = await createDocumentRequest(payload);
      document.cookie = `hrb_success_request_no=${encodeURIComponent(result.requestNo)}; Path=/; Max-Age=600; SameSite=Lax`;
      document.cookie =
        "hrb_success_attachments=; Path=/; Max-Age=0; SameSite=Lax";
      router.push("/requests/success");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถส่งคำขอเอกสารได้");
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
            <span className="text-slate-600">คำขอเอกสาร</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]">
              <span className="text-2xl">📄</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2d4c] sm:text-2xl">
                แบบฟอร์มคำขอเอกสาร
              </h1>
              <p className="text-sm text-slate-500">
                กรอกข้อมูลให้ครบถ้วนและเลือกวิธีรับเอกสารให้ชัดเจน
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

            <Panel stepNumber={2} title="รายละเอียดเอกสาร">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <TextField
                      id="siteNameRaw"
                      label="ชื่อไซต์ / หน่วยงาน"
                      required
                      value={form.siteNameRaw}
                      onChange={(event) =>
                        onChange("siteNameRaw", event.target.value)
                      }
                      placeholder="HO / Site A / Site B / ฯลฯ"
                      maxLength={200}
                    />
                    <FieldError message={fieldErrors.siteNameRaw} />
                  </div>

                  <SelectField
                    id="deliveryMethod"
                    label="วิธีรับเอกสาร"
                    required
                    value={form.deliveryMethod}
                    onChange={(event) => {
                      const nextDeliveryMethod = event.target
                        .value as DeliveryMethod;

                      if (form.deliveryMethod === "POSTAL") {
                        clearPostalAddressErrors();
                      }

                      onChange("deliveryMethod", nextDeliveryMethod);
                      if (
                        nextDeliveryMethod === "POSTAL" &&
                        form.urgency !== "NORMAL"
                      ) {
                        onChange("urgency", "NORMAL");
                      }
                    }}
                  >
                    {deliveryMethodOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                </div>

                {!isPostal ? (
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-slate-700">
                      ระดับความเร่งด่วน{" "}
                      <span className="ml-0.5 text-[#b62026]">*</span>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {urgencyOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onChange("urgency", option.value)}
                          className={`w-full flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-all duration-150 ${
                            form.urgency === option.value
                              ? `${option.activeBg} ${option.activeBorder} shadow-sm`
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${
                              form.urgency === option.value
                                ? "bg-white/20"
                                : option.iconBg
                            }`}
                            aria-hidden
                          >
                            {option.icon}
                          </span>
                          <span className="whitespace-nowrap text-center text-sm font-bold">
                            {option.label}
                          </span>
                          <span
                            className={`text-center text-[11px] leading-4 ${
                              form.urgency === option.value
                                ? "text-white/90"
                                : "text-slate-500"
                            }`}
                          >
                            {option.value === "NORMAL"
                              ? "ประมาณ 1 สัปดาห์"
                              : option.value === "HIGH"
                                ? "ประมาณ 3-4 วัน"
                                : "ประมาณ 1-2 วัน"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {selectedUrgencyOption ? (
                      <p
                        className={`mt-2 text-sm font-medium ${selectedUrgencyOption.color}`}
                      >
                        {selectedUrgencyOption.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <TextareaField
                    id="documentDescription"
                    label="รายละเอียดเอกสาร"
                    required
                    value={form.documentDescription}
                    onChange={(event) =>
                      onChange("documentDescription", event.target.value)
                    }
                    placeholder="อธิบายรายละเอียดเอกสารที่ต้องการ"
                    rows={4}
                    maxLength={2000}
                  />
                  <FieldError message={fieldErrors.documentDescription} />
                </div>

                <div>
                  <TextareaField
                    id="purpose"
                    label="วัตถุประสงค์"
                    required
                    value={form.purpose}
                    onChange={(event) =>
                      onChange("purpose", event.target.value)
                    }
                    placeholder="ระบุวัตถุประสงค์ในการใช้งานเอกสาร"
                    rows={3}
                    maxLength={500}
                  />
                  <FieldError message={fieldErrors.purpose} />
                </div>

                <TextareaField
                  id="note"
                  label="หมายเหตุ"
                  value={form.note}
                  onChange={(event) => onChange("note", event.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  rows={3}
                  maxLength={2000}
                />
              </div>
            </Panel>

            {isPostal ? (
              <Panel stepNumber={3} title="ข้อมูลที่อยู่จัดส่ง">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <TextField
                      id="addressName"
                      label="ชื่อ-นามสกุล"
                      required
                      value={address.name}
                      onChange={(event) =>
                        onAddressChange("name", event.target.value)
                      }
                      placeholder="สมหญิง ใจดี"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.addressName} />
                  </div>

                  <div className="sm:col-span-2">
                    <TextField
                      id="addressPhone"
                      label="เบอร์โทรศัพท์"
                      required
                      value={address.phone}
                      onChange={(event) =>
                        handleAddressPhoneChange(event.target.value)
                      }
                      placeholder="012-345-6789"
                      inputMode="numeric"
                      maxLength={12}
                    />
                    <FieldError message={fieldErrors.addressPhone} />
                  </div>

                  <div>
                    <SelectField
                      id="addressProvince"
                      label="จังหวัด"
                      required
                      value={address.province}
                      onChange={(event) =>
                        onAddressChange("province", event.target.value)
                      }
                    >
                      <option value="">เลือกจังหวัด</option>
                      {provinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </SelectField>
                    <FieldError message={fieldErrors.addressProvince} />
                  </div>

                  <div>
                    <SelectField
                      id="addressDistrict"
                      label="เขต/อำเภอ"
                      required
                      value={address.district}
                      onChange={(event) =>
                        onAddressChange("district", event.target.value)
                      }
                      disabled={!address.province}
                    >
                      <option value="">เลือกเขต/อำเภอ</option>
                      {addressGeo.districts.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </SelectField>
                    <FieldError message={fieldErrors.addressDistrict} />
                  </div>

                  <div>
                    <SelectField
                      id="addressSubdistrict"
                      label="แขวง/ตำบล"
                      required
                      value={address.subdistrict}
                      onChange={(event) =>
                        onAddressChange("subdistrict", event.target.value)
                      }
                      disabled={!address.district}
                    >
                      <option value="">เลือกแขวง/ตำบล</option>
                      {addressGeo.subdistricts.map((subdistrict) => (
                        <option key={subdistrict} value={subdistrict}>
                          {subdistrict}
                        </option>
                      ))}
                    </SelectField>
                    <FieldError message={fieldErrors.addressSubdistrict} />
                  </div>

                  <div>
                    <TextField
                      id="addressPostalCode"
                      label="รหัสไปรษณีย์"
                      required
                      readOnly
                      disabled={!address.subdistrict}
                      value={address.postalCode}
                      onChange={(event) =>
                        onAddressChange("postalCode", event.target.value)
                      }
                      maxLength={10}
                    />
                    <FieldError message={fieldErrors.addressPostalCode} />
                  </div>

                  <div className="sm:col-span-2">
                    <TextField
                      id="addressHouseNo"
                      label="บ้านเลขที่"
                      required
                      value={address.houseNo}
                      onChange={(event) =>
                        onAddressChange("houseNo", event.target.value)
                      }
                      placeholder="99/123"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.addressHouseNo} />
                  </div>

                  <TextField
                    id="addressRoad"
                    label="ถนน"
                    value={address.road ?? ""}
                    onChange={(event) =>
                      onAddressChange("road", event.target.value)
                    }
                    placeholder="สุขุมวิท"
                    maxLength={120}
                  />

                  <TextField
                    id="addressSoi"
                    label="ซอย"
                    value={address.soi ?? ""}
                    onChange={(event) =>
                      onAddressChange("soi", event.target.value)
                    }
                    placeholder="สุขุมวิท 24"
                    maxLength={120}
                  />
                </div>

                <div className="mt-4">
                  <TextareaField
                    id="addressExtra"
                    label="รายละเอียดเพิ่มเติม"
                    value={address.extra ?? ""}
                    onChange={(event) =>
                      onAddressChange("extra", event.target.value)
                    }
                    placeholder="ส่งที่นิติบุคคลชั้น 1 ฝากพัสดุ"
                    rows={2}
                    maxLength={200}
                  />
                </div>
              </Panel>
            ) : null}

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
                        ส่งคำขอเอกสาร
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
    </main>
  );
}
