import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  getMessengerLink: vi.fn(),
  updateMessengerLinkStatus: vi.fn(),
  reportMessengerProblem: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.useParams(),
}));

vi.mock("@/lib/api/messenger-link", () => ({
  getMessengerLink: (...args: unknown[]) => mocks.getMessengerLink(...args),
  updateMessengerLinkStatus: (...args: unknown[]) =>
    mocks.updateMessengerLinkStatus(...args),
  reportMessengerProblem: (...args: unknown[]) =>
    mocks.reportMessengerProblem(...args),
}));

async function renderPage() {
  const pageModule = await import("@/app/messenger/link/[token]/page");
  render(<pageModule.default />);
}

const baseDetail = {
  request: {
    id: "req-1",
    requestNo: "HRB-20260424-0001",
    type: "MESSENGER" as const,
    status: "APPROVED" as const,
    urgency: "HIGH" as const,
    employeeName: "ธนารักษ์ ทรัพย์สิริชล",
    phone: "0811111111",
    latestActivityAt: "2026-04-24T08:00:00.000Z",
  },
  messengerDetail: {
    pickupDatetime: "2026-04-24T08:00:00.000Z",
    itemType: "DOCUMENT" as const,
    itemDescription: "เอกสารสัญญา",
    outsideBkkMetro: false,
    deliveryService: null,
    deliveryServiceOther: null,
    senderAddress: null,
    receiverAddress: {
      id: "addr-1",
      name: "ปลายทาง A",
      phone: "0899999999",
      province: "กรุงเทพมหานคร",
      district: "บางรัก",
      subdistrict: "สีลม",
      postalCode: "10500",
      houseNo: "100/1",
      soi: null,
      road: "สีลม",
      extra: null,
    },
  },
  attachments: [],
  expiresAt: "2099-12-31T23:59:59.000Z",
};

describe("messenger magic link page", () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ token: "token-abc" });
    mocks.getMessengerLink.mockReset();
    mocks.updateMessengerLinkStatus.mockReset();
    mocks.reportMessengerProblem.mockReset();

    mocks.getMessengerLink.mockResolvedValue(baseDetail);
    mocks.updateMessengerLinkStatus.mockResolvedValue({
      id: "req-1",
      requestNo: "HRB-20260424-0001",
      status: "IN_TRANSIT",
    });
    mocks.reportMessengerProblem.mockResolvedValue({ ok: true });
  });

  it("renders thai labels and current sections", async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("รายละเอียดงาน")).toBeInTheDocument();
    });

    expect(screen.getByText("จัดการงาน")).toBeInTheDocument();
    expect(screen.getByText((value) => value.includes("สูง"))).toBeInTheDocument();
    expect(screen.getByText("ประเภทสิ่งของ")).toBeInTheDocument();
    expect(screen.getByText("เอกสาร")).toBeInTheDocument();
    expect(screen.getByText("วันที่จัดส่ง")).toBeInTheDocument();
    expect(screen.queryByText("บันทึกกิจกรรมรับงาน")).not.toBeInTheDocument();
  });

  it("opens confirm modal and updates status", async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("อัปเดตสถานะงาน")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /อัปเดตเป็น/ }));

    await waitFor(() => {
      expect(screen.getByText("ยืนยันการเปลี่ยนสถานะงาน")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /ยืนยันเปลี่ยนสถานะ/ }));

    await waitFor(() => {
      expect(mocks.updateMessengerLinkStatus).toHaveBeenCalledWith(
        "token-abc",
        expect.objectContaining({ status: "IN_TRANSIT" }),
      );
    });
  });

  it("maps backend error code to thai message", async () => {
    mocks.updateMessengerLinkStatus.mockRejectedValue(
      new ApiError(
        400,
        { code: "MAGIC_LINK_EXPIRED", message: "Magic link is expired" },
        "failed",
      ),
    );

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("อัปเดตสถานะงาน")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /อัปเดตเป็น/ }));
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันเปลี่ยนสถานะ/ }));

    await waitFor(() => {
      expect(screen.getByText("ลิงก์นี้หมดอายุแล้ว")).toBeInTheDocument();
    });
  });
});
