import { apiFetch, ApiError } from "@/lib/api/client";
import { getAuthToken } from "@/lib/auth/tokens";

export type AdminRequestType = "BUILDING" | "VEHICLE" | "MESSENGER" | "DOCUMENT";
export type AdminRequestStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "IN_TRANSIT"
  | "DONE"
  | "REJECTED"
  | "CANCELED";

export type AdminUrgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type AdminRequestListItem = {
  id: string;
  requestNo: string;
  type: AdminRequestType;
  status: AdminRequestStatus;
  urgency: AdminUrgency;
  employeeName: string;
  phone: string;
  departmentId: string;
  createdAt: string;
  latestActivityAt: string;
  closedAt: string | null;
};

export type AdminRequestListResponse = {
  items: AdminRequestListItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminRequestSummaryResponse = {
  total: number;
  byStatus: Record<AdminRequestStatus, number>;
  byType: Record<AdminRequestType, number>;
  byDay: Array<{ date: string; total: number }>;
};

export type AdminRequestListQuery = {
  type?: AdminRequestType;
  status?: AdminRequestStatus;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  limit?: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

function toQueryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

export async function getAdminRequests(query: AdminRequestListQuery = {}) {
  return apiFetch<AdminRequestListResponse>("/admin/requests", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function getAdminRequestSummary(
  query: Omit<AdminRequestListQuery, "page" | "limit"> = {},
) {
  return apiFetch<AdminRequestSummaryResponse>("/admin/requests/report/summary", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function downloadAdminRequestsCsv(
  query: Omit<AdminRequestListQuery, "page"> = {},
): Promise<{ fileName: string; csv: string }> {
  const token = getAuthToken("admin");

  if (!token) {
    throw new ApiError(401, null, "Admin session token is missing");
  }

  const queryString = toQueryString({
    type: query.type,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    limit: query.limit,
  });

  const response = await fetch(`${API_BASE_URL}/admin/requests/export/csv${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });

  if (!response.ok) {
    let message = `Failed to export csv (${response.status})`;

    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(", ");
      } else if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // noop
    }

    throw new ApiError(response.status, null, message);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] ?? "requests-export.csv";

  return {
    fileName,
    csv: await response.text(),
  };
}
