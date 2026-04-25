import { resolveApiBaseUrl } from "@/lib/api/base-url";
import { apiFetch, ApiError } from "@/lib/api/client";

export type AuditAction =
  | "CREATE"
  | "APPROVE"
  | "REJECT"
  | "STATUS_CHANGE"
  | "CANCEL"
  | "UPLOAD_ATTACHMENT"
  | "REPORT_PROBLEM"
  | "MESSENGER_PICKUP_EVENT";

export type AuditActorRole = "EMPLOYEE" | "ADMIN" | "MESSENGER";
export type AdminRequestType =
  | "BUILDING"
  | "VEHICLE"
  | "MESSENGER"
  | "DOCUMENT";
export type AdminRequestStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "IN_TRANSIT"
  | "DONE"
  | "REJECTED"
  | "CANCELED";
export type AdminUrgency = "NORMAL" | "HIGH" | "CRITICAL";

export type AdminAuditLogItem = {
  id: string;
  requestId: string;
  requestNo: string;
  departmentName: string | null;
  requestType: string;
  requestStatus: string;
  requestUrgency: AdminUrgency | null;
  action: AuditAction;
  fromStatus: string | null;
  toStatus: string | null;
  actorRole: AuditActorRole;
  actorDisplayName: string | null;
  actorLabel: string;
  operatorId: string | null;
  operatorName: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminAuditLogListResponse = {
  items: AdminAuditLogItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminAuditListQuery = {
  requestType?: AdminRequestType;
  requestStatus?: AdminRequestStatus;
  requestUrgency?: AdminUrgency;
  action?: AuditAction;
  actorRole?: AuditActorRole;
  operatorId?: string;
  departmentId?: string;
  requestId?: string;
  requestNo?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  limit?: number;
};

const API_BASE_URL = resolveApiBaseUrl();

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

export async function getAdminAuditLogs(query: AdminAuditListQuery = {}) {
  return apiFetch<AdminAuditLogListResponse>("/admin/audit/activity-logs", {
    method: "GET",
    tokenType: "admin",
    query,
  });
}

export async function downloadAdminAuditCsv(
  query: Omit<AdminAuditListQuery, "page"> = {},
): Promise<{ fileName: string; csv: string }> {
  const queryString = toQueryString({
    requestType: query.requestType,
    requestStatus: query.requestStatus,
    requestUrgency: query.requestUrgency,
    action: query.action,
    actorRole: query.actorRole,
    operatorId: query.operatorId,
    departmentId: query.departmentId,
    requestId: query.requestId,
    requestNo: query.requestNo,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    limit: query.limit,
  });

  const response = await fetch(
    `${API_BASE_URL}/admin/audit/activity-logs/export/csv${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      headers: {
        Accept: "text/csv",
      },
      credentials: "same-origin",
    },
  );

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
  const fileName = match?.[1] ?? "audit-activity-export.csv";

  return {
    fileName,
    csv: await response.text(),
  };
}

export async function downloadAdminAuditXlsx(
  query: Omit<AdminAuditListQuery, "page"> = {},
): Promise<{ fileName: string; xlsxBytes: Uint8Array }> {
  const queryString = toQueryString({
    requestType: query.requestType,
    requestStatus: query.requestStatus,
    requestUrgency: query.requestUrgency,
    action: query.action,
    actorRole: query.actorRole,
    operatorId: query.operatorId,
    departmentId: query.departmentId,
    requestId: query.requestId,
    requestNo: query.requestNo,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    limit: query.limit,
  });

  const response = await fetch(
    `${API_BASE_URL}/admin/audit/activity-logs/export/xlsx${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      credentials: "same-origin",
    },
  );

  if (!response.ok) {
    let message = `Failed to export xlsx (${response.status})`;

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
  const fileName = match?.[1] ?? "audit-activity-export.xlsx";

  const arrayBuffer = await response.arrayBuffer();

  return {
    fileName,
    xlsxBytes: new Uint8Array(arrayBuffer),
  };
}
