import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminAuditLogs: vi.fn(),
  downloadAdminAuditXlsx: vi.fn(),
  listAdminDepartments: vi.fn(),
  listAdminOperators: vi.fn(),
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

vi.mock("@/components/guards/route-guard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api/admin-audit", () => ({
  getAdminAuditLogs: (...args: unknown[]) => mocks.getAdminAuditLogs(...args),
  downloadAdminAuditXlsx: (...args: unknown[]) =>
    mocks.downloadAdminAuditXlsx(...args),
}));

vi.mock("@/lib/api/admin-settings", () => ({
  listAdminDepartments: (...args: unknown[]) =>
    mocks.listAdminDepartments(...args),
  listAdminOperators: (...args: unknown[]) => mocks.listAdminOperators(...args),
}));

async function renderPage() {
  const pageModule = await import("@/app/admin/audit/page");
  render(<pageModule.default />);
}

function getInputById(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}

describe("admin audit page", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.getAdminAuditLogs.mockReset();
    mocks.downloadAdminAuditXlsx.mockReset();
    mocks.listAdminDepartments.mockReset();
    mocks.listAdminOperators.mockReset();

    mocks.getAdminAuditLogs.mockResolvedValue({
      items: [],
      page: 1,
      limit: 50,
      total: 0,
    });
    mocks.downloadAdminAuditXlsx.mockResolvedValue({
      fileName: "audit.xlsx",
      xlsxBytes: new Uint8Array([1, 2, 3]),
    });
    mocks.listAdminDepartments.mockResolvedValue({ items: [] });
    mocks.listAdminOperators.mockResolvedValue({ items: [] });
  });

  it("debounces quick search before requesting new logs", async () => {
    await renderPage();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    mocks.getAdminAuditLogs.mockClear();

    fireEvent.change(getInputById("q"), {
      target: { value: "REQ-0001" },
    });

    expect(mocks.getAdminAuditLogs).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
    });

    expect(mocks.getAdminAuditLogs).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    expect(mocks.getAdminAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ q: "REQ-0001" }),
    );
  });

  it("filters logs by request urgency", async () => {
    await renderPage();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    mocks.getAdminAuditLogs.mockClear();

    const urgencySelect = document.getElementById(
      "requestUrgency",
    ) as HTMLSelectElement;

    fireEvent.change(urgencySelect, {
      target: { value: "CRITICAL" },
    });

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    expect(mocks.getAdminAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ requestUrgency: "CRITICAL" }),
    );
  });

  it("shows date range validation and blocks invalid fetch", async () => {
    await renderPage();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    mocks.getAdminAuditLogs.mockClear();

    fireEvent.change(getInputById("dateTo"), {
      target: { value: "2026-04-10" },
    });

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    mocks.getAdminAuditLogs.mockClear();

    fireEvent.change(getInputById("dateFrom"), {
      target: { value: "2026-04-20" },
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          /\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14/,
        ),
      ).toBeInTheDocument();
    });

    expect(mocks.getAdminAuditLogs).not.toHaveBeenCalled();
  });

  it("blocks xlsx export when date range is invalid", async () => {
    await renderPage();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalled();
    });

    fireEvent.change(getInputById("dateFrom"), {
      target: { value: "2026-04-20" },
    });
    fireEvent.change(getInputById("dateTo"), {
      target: { value: "2026-04-10" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01 Excel/,
      }),
    );

    expect(mocks.downloadAdminAuditXlsx).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByText(
          /\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14/,
        ),
      ).toBeInTheDocument();
    });
  });

  it("applies month quick presets and requests logs with matching date range", async () => {
    await renderPage();

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    mocks.getAdminAuditLogs.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49/,
      }),
    );

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    const currentMonthCall = mocks.getAdminAuditLogs.mock.calls.at(-1)?.[0] as
      | { dateFrom?: string; dateTo?: string }
      | undefined;
    expect(currentMonthCall?.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(currentMonthCall?.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const [currentFromYear, currentFromMonth, currentFromDay] = (
      currentMonthCall?.dateFrom ?? ""
    )
      .split("-")
      .map(Number);
    const [currentToYear, currentToMonth] = (currentMonthCall?.dateTo ?? "")
      .split("-")
      .map(Number);

    expect(currentFromDay).toBe(1);
    expect(currentFromMonth).toBe(currentToMonth);
    expect(currentFromYear).toBe(currentToYear);

    mocks.getAdminAuditLogs.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: /\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E49\u0E27/,
      }),
    );

    await waitFor(() => {
      expect(mocks.getAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    const previousMonthCall = mocks.getAdminAuditLogs.mock.calls.at(-1)?.[0] as
      | { dateFrom?: string; dateTo?: string }
      | undefined;
    const [, prevFromMonth, prevFromDay] = (previousMonthCall?.dateFrom ?? "")
      .split("-")
      .map(Number);
    const [, prevToMonth, prevToDay] = (previousMonthCall?.dateTo ?? "")
      .split("-")
      .map(Number);

    expect(prevFromDay).toBe(1);
    expect(prevToDay).toBeGreaterThanOrEqual(28);
    expect(prevToDay).toBeLessThanOrEqual(31);
    expect(prevFromMonth).toBe(prevToMonth);
  });

  it("renders summary in list and full fields in audit detail modal", async () => {
    mocks.getAdminAuditLogs.mockResolvedValueOnce({
      items: [
        {
          id: "log-1",
          requestId: "req-1",
          requestNo: "REQ-000001",
          departmentName: "ทรัพยากรบุคคล",
          requestType: "BUILDING",
          requestStatus: "IN_PROGRESS",
          requestUrgency: "HIGH",
          action: "STATUS_CHANGE",
          fromStatus: "NEW",
          toStatus: "IN_PROGRESS",
          actorRole: "ADMIN",
          actorDisplayName: "ผู้ดูแลระบบ A",
          actorLabel: "ผู้ดูแลระบบ A",
          operatorId: "op-1",
          operatorName: "ช่างสมชาย",
          note: "ทดสอบ",
          createdAt: "2026-04-23T02:00:00.000Z",
        },
      ],
      page: 1,
      limit: 50,
      total: 1,
    });

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("REQ-000001")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14/,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19/,
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/\u0E17\u0E35\u0E48\u0E21\u0E32/)).toBeInTheDocument();
    expect(
      screen.getByText(/\u0E41\u0E1C\u0E07\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E01\u0E48\u0E2D\u0E19/)).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /\u0E43\u0E2B\u0E21\u0E48.*\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23/,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A/,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/\(.*op-1\)/)).toBeInTheDocument();
  });
});
