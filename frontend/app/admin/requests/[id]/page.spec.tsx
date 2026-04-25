import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  getAdminRequestDetail: vi.fn(),
  updateAdminRequestStatus: vi.fn(),
  getAdminOperators: vi.fn(),
  issueAdminAttachmentUploadTicket: vi.fn(),
  completeAdminAttachmentUpload: vi.fn(),
  getAdminAttachmentDownloadUrl: vi.fn(),
  uploadFileToPresignedUrl: vi.fn(),
  downloadFileFromPresignedUrl: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.useParams(),
}));

vi.mock("@/components/guards/route-guard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/video-preview-modal", () => ({
  VideoPreviewModal: ({ open }: { open: boolean }) =>
    open ? <div>Video preview</div> : null,
}));

vi.mock("@/lib/attachments/download", () => ({
  downloadFileFromPresignedUrl: (...args: unknown[]) =>
    mocks.downloadFileFromPresignedUrl(...args),
}));

vi.mock("@/lib/api/admin-settings", () => ({
  getAdminOperators: (...args: unknown[]) => mocks.getAdminOperators(...args),
}));

vi.mock("@/lib/api/admin-requests", () => ({
  getAdminRequestDetail: (...args: unknown[]) =>
    mocks.getAdminRequestDetail(...args),
  updateAdminRequestStatus: (...args: unknown[]) =>
    mocks.updateAdminRequestStatus(...args),
  issueAdminAttachmentUploadTicket: (...args: unknown[]) =>
    mocks.issueAdminAttachmentUploadTicket(...args),
  completeAdminAttachmentUpload: (...args: unknown[]) =>
    mocks.completeAdminAttachmentUpload(...args),
  getAdminAttachmentDownloadUrl: (...args: unknown[]) =>
    mocks.getAdminAttachmentDownloadUrl(...args),
  uploadFileToPresignedUrl: (...args: unknown[]) =>
    mocks.uploadFileToPresignedUrl(...args),
}));

function createBaseDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    requestNo: "REQ-0001",
    type: "BUILDING",
    status: "NEW",
    urgency: "HIGH",
    employeeName: "สมชาย ใจดี",
    phone: "0812345678",
    createdAt: "2026-04-20T10:00:00.000Z",
    latestActivityAt: "2026-04-20T11:00:00.000Z",
    closedAt: null,
    cancelReason: null,
    hrCloseNote: null,
    magicLink: null,
    department: {
      id: "dept-1",
      name: "ทรัพยากรบุคคล",
    },
    attachments: [],
    activityLogs: [],
    buildingRepairDetail: {
      building: "อาคาร A",
      floor: 3,
      locationDetail: "ห้องประชุมใหญ่",
      problemCategoryOther: null,
      description: "แอร์ไม่เย็น",
      additionalDetails: "มีน้ำหยด",
      problemCategory: {
        id: "cat-1",
        name: "ระบบปรับอากาศ",
        helperText: "ตรวจสอบคอมเพรสเซอร์",
      },
    },
    vehicleRepairDetail: null,
    messengerBookingDetail: null,
    documentRequestDetail: null,
    ...overrides,
  };
}

async function renderPage() {
  const pageModule = await import("@/app/admin/requests/[id]/page");
  render(<pageModule.default />);
}

describe("admin request detail page", () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ id: "req-1" });
    mocks.getAdminOperators.mockReset();
    mocks.getAdminRequestDetail.mockReset();
    mocks.updateAdminRequestStatus.mockReset();
    mocks.issueAdminAttachmentUploadTicket.mockReset();
    mocks.completeAdminAttachmentUpload.mockReset();
    mocks.getAdminAttachmentDownloadUrl.mockReset();
    mocks.uploadFileToPresignedUrl.mockReset();
    mocks.downloadFileFromPresignedUrl.mockReset();

    mocks.getAdminOperators.mockResolvedValue({
      items: [{ id: "op-1", displayName: "ผู้ดูแลระบบ A" }],
    });
    mocks.getAdminRequestDetail.mockResolvedValue(createBaseDetail());
    mocks.updateAdminRequestStatus.mockResolvedValue({
      id: "req-1",
      status: "APPROVED",
    });
    mocks.issueAdminAttachmentUploadTicket.mockResolvedValue({
      uploadToken: "upload-token-1",
      storageKey: "attachments/contract.pdf",
      uploadUrl: "https://upload.example.com",
      uploadMethod: "PUT",
      uploadHeaders: {},
      expiresAt: "2026-04-25T00:00:00.000Z",
    });
    mocks.uploadFileToPresignedUrl.mockResolvedValue(undefined);
    mocks.completeAdminAttachmentUpload.mockResolvedValue({ id: "att-new-1" });
  });

  it("renders building request details", async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("อาคาร A")).toBeInTheDocument();
    });

    expect(screen.getByText("อาคาร A")).toBeInTheDocument();
    expect(screen.getByText("ห้องประชุมใหญ่")).toBeInTheDocument();
    expect(screen.getByText("แอร์ไม่เย็น")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบคอมเพรสเซอร์")).toBeInTheDocument();
    expect(screen.queryByText("รายละเอียดคำขอ")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload attachment")).not.toBeInTheDocument();
  });

  it("shows persisted messenger magic link from request detail", async () => {
    const pickupDatetime = "2026-04-21T09:00:00.000Z";
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "MESSENGER",
        magicLink: {
          url: "https://example.com/magic-link",
          expiresAt: "2026-04-21T10:00:00.000Z",
        },
        buildingRepairDetail: null,
        messengerBookingDetail: {
          pickupDatetime,
          itemType: "DOCUMENT",
          itemDescription: "แฟ้มสัญญา",
          outsideBkkMetro: false,
          deliveryService: "POST",
          deliveryServiceOther: null,
          senderAddress: null,
          receiverAddress: {
            name: "ปลายทาง",
            phone: "0899999999",
            province: "กรุงเทพมหานคร",
            district: "จตุจักร",
            subdistrict: "ลาดยาว",
            postalCode: "10900",
            houseNo: "99/9",
            soi: null,
            road: "พหลโยธิน",
            extra: null,
          },
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("ลิงก์สำหรับเมสเซนเจอร์")).toBeInTheDocument();
    });

    expect(
      screen.getByText("https://example.com/magic-link"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดลิงก์" })).toHaveAttribute(
      "href",
      "https://example.com/magic-link",
    );
    expect(screen.queryByText("ต้นทาง")).not.toBeInTheDocument();
    expect(screen.getAllByText("ปลายทาง").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        new Intl.DateTimeFormat("th-TH", {
          dateStyle: "medium",
        }).format(new Date(pickupDatetime)),
      ),
    ).toBeInTheDocument();
  });

  it("allows emergency DONE for messenger in transit and hides canceled", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "MESSENGER",
        status: "IN_TRANSIT",
        buildingRepairDetail: null,
        messengerBookingDetail: {
          pickupDatetime: "2026-04-21T09:00:00.000Z",
          itemType: "DOCUMENT",
          itemDescription: "แฟ้มสัญญา",
          outsideBkkMetro: false,
          deliveryService: "POST",
          deliveryServiceOther: null,
          senderAddress: null,
          receiverAddress: {
            name: "ปลายทาง",
            phone: "0899999999",
            province: "กรุงเทพมหานคร",
            district: "จตุจักร",
            subdistrict: "ลาดยาว",
            postalCode: "10900",
            houseNo: "99/9",
            soi: null,
            road: "พหลโยธิน",
            extra: null,
          },
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(document.getElementById("targetStatus")).toBeTruthy();
    });

    const nextStatus = document.getElementById(
      "targetStatus",
    ) as HTMLSelectElement;
    const optionValues = Array.from(nextStatus.options).map(
      (option) => option.value,
    );

    expect(optionValues).toContain("DONE");
    expect(optionValues).not.toContain("CANCELED");
  });

  it("requires pickup note before completing pickup document requests", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        documentRequestDetail: {
          siteNameRaw: "ไซต์ A",
          siteNameNormalized: "ไซต์ A",
          documentDescription: "หนังสือรับรอง",
          purpose: "ยื่นราชการ",
          neededDate: "2026-04-30",
          deliveryMethod: "PICKUP",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    const pickupNoteInput = document.getElementById(
      "pickupNote",
    ) as HTMLInputElement;
    expect(pickupNoteInput).toBeInTheDocument();
    expect(pickupNoteInput.required).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "อัปเดตสถานะ" }));

    expect(mocks.updateAdminRequestStatus).not.toHaveBeenCalled();
  });

  it("requires note when rejecting or canceling requests", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "BUILDING",
        status: "NEW",
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "CANCELED" },
    });

    const noteInput = document.getElementById("note") as HTMLTextAreaElement;
    expect(noteInput).toBeInTheDocument();
    expect(noteInput.required).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "อัปเดตสถานะ" }));

    expect(mocks.updateAdminRequestStatus).not.toHaveBeenCalled();
  });

  it("submits digital attachment id when completing digital document requests", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        attachments: [
          {
            id: "att-1",
            fileKind: "DOCUMENT",
            fileName: "contract.pdf",
            mimeType: "application/pdf",
            fileSize: 2048,
            storageKey: "files/contract.pdf",
            publicUrl: null,
            uploadedByRole: "ADMIN",
            createdAt: "2026-04-20T12:00:00.000Z",
          },
        ],
        documentRequestDetail: {
          siteNameRaw: "ไซต์ B",
          siteNameNormalized: "ไซต์ B",
          documentDescription: "สำเนาสัญญา",
          purpose: "ส่งลูกค้า",
          neededDate: "2026-04-30",
          deliveryMethod: "DIGITAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });
    fireEvent.change(document.getElementById("note")!, {
      target: { value: "ส่งไฟล์ให้ผู้ขอแล้ว" },
    });

    fireEvent.submit(document.querySelector("form")!);
    const confirmButtons = Array.from(
      document.querySelectorAll("button[type='button']"),
    ).filter((button) => button.className.includes("bg-[#0e2d4c]"));
    expect(confirmButtons.length).toBeGreaterThan(0);
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(mocks.updateAdminRequestStatus).toHaveBeenCalledWith("req-1", {
        status: "DONE",
        operatorId: "op-1",
        note: "ส่งไฟล์ให้ผู้ขอแล้ว",
        pickupNote: undefined,
        digitalFileAttachmentId: "att-1",
      });
    });
  });

  it("does not show manual completion upload for digital delivery", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        documentRequestDetail: {
          siteNameRaw: "Site C",
          siteNameNormalized: "Site C",
          documentDescription: "Certificate",
          purpose: "Internal use",
          neededDate: "2026-04-30",
          deliveryMethod: "DIGITAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    expect(
      document.getElementById("completionAttachmentFile"),
    ).not.toBeInTheDocument();

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    expect(document.getElementById("digitalDocumentUpload")).toBeInTheDocument();
    expect(
      document.getElementById("completionAttachmentFile"),
    ).not.toBeInTheDocument();

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "CANCELED" },
    });

    expect(
      document.getElementById("completionAttachmentFile"),
    ).not.toBeInTheDocument();
  });

  it("requires at least one digital document file before completing digital document request", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        attachments: [],
        documentRequestDetail: {
          siteNameRaw: "Site H",
          siteNameNormalized: "Site H",
          documentDescription: "Letter",
          purpose: "Digital send",
          neededDate: "2026-04-30",
          deliveryMethod: "DIGITAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(document.getElementById("targetStatus")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    fireEvent.submit(document.querySelector("form")!);

    expect(mocks.updateAdminRequestStatus).not.toHaveBeenCalled();
  });

  it("does not show manual completion upload for pickup delivery", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        documentRequestDetail: {
          siteNameRaw: "Site D",
          siteNameNormalized: "Site D",
          documentDescription: "Receipt",
          purpose: "Pickup",
          neededDate: "2026-04-30",
          deliveryMethod: "PICKUP",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    expect(
      document.getElementById("completionAttachmentFile"),
    ).not.toBeInTheDocument();
  });

  it("does not show completion upload for postal delivery even when DONE is selected", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        documentRequestDetail: {
          siteNameRaw: "Site E",
          siteNameNormalized: "Site E",
          documentDescription: "Invoice",
          purpose: "Postal",
          neededDate: "2026-04-30",
          deliveryMethod: "POSTAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: {
            name: "Receiver",
            phone: "0899999999",
            province: "Bangkok",
            district: "Chatuchak",
            subdistrict: "Lat Yao",
            postalCode: "10900",
            houseNo: "99/9",
            soi: null,
            road: "Phahon Yothin",
            extra: null,
          },
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("จัดการสถานะ")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    expect(
      document.getElementById("completionAttachmentFile"),
    ).not.toBeInTheDocument();
  });

  it("rejects non-document file types for digital document upload", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        documentRequestDetail: {
          siteNameRaw: "Site F",
          siteNameNormalized: "Site F",
          documentDescription: "Certificate",
          purpose: "Internal use",
          neededDate: "2026-04-30",
          deliveryMethod: "DIGITAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(document.getElementById("targetStatus")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    const uploadInput = document.getElementById(
      "digitalDocumentUpload",
    ) as HTMLInputElement;
    expect(uploadInput).toBeInTheDocument();

    const invalidFile = new File(["img"], "photo.png", { type: "image/png" });
    fireEvent.change(uploadInput, {
      target: { files: [invalidFile] },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/รองรับเฉพาะ PDF, Word หรือ Excel เท่านั้น/),
      ).toBeInTheDocument();
    });
    expect(mocks.issueAdminAttachmentUploadTicket).not.toHaveBeenCalled();

  });

  it("queues valid digital document files before confirming status update", async () => {
    mocks.getAdminRequestDetail.mockResolvedValueOnce(
      createBaseDetail({
        type: "DOCUMENT",
        status: "APPROVED",
        buildingRepairDetail: null,
        attachments: [],
        documentRequestDetail: {
          siteNameRaw: "Site G",
          siteNameNormalized: "Site G",
          documentDescription: "Tax form",
          purpose: "Finance",
          neededDate: "2026-04-30",
          deliveryMethod: "DIGITAL",
          note: null,
          pickupNote: null,
          digitalFileAttachmentId: null,
          deliveryAddress: null,
          digitalFileAttachment: null,
        },
      }),
    );

    await renderPage();

    await waitFor(() => {
      expect(document.getElementById("targetStatus")).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById("targetStatus")!, {
      target: { value: "DONE" },
    });

    const uploadInput = document.getElementById(
      "digitalDocumentUpload",
    ) as HTMLInputElement;
    const pdfFile = new File(["pdf"], "contract.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(uploadInput, {
      target: { files: [pdfFile] },
    });

    expect(screen.getAllByText("contract.pdf").length).toBeGreaterThan(0);
    expect(mocks.issueAdminAttachmentUploadTicket).not.toHaveBeenCalled();
  });
});




