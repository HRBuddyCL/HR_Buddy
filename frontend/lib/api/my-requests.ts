import { apiFetch } from "@/lib/api/client";

export type RequestType = "BUILDING" | "VEHICLE" | "MESSENGER" | "DOCUMENT";
export type RequestStatus =
  | "NEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "IN_TRANSIT"
  | "DONE"
  | "REJECTED"
  | "CANCELED";

export type Urgency = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type MyRequestItem = {
  id: string;
  requestNo: string;
  type: RequestType;
  status: RequestStatus;
  urgency: Urgency;
  createdAt: string;
  latestActivityAt: string;
  closedAt: string | null;
};

export type RequestDetail = MyRequestItem & {
  employeeName: string;
  phone: string;
  cancelReason: string | null;
  hrCloseNote: string | null;
  department: {
    id: string;
    name: string;
  };
  attachments: Array<{
    id: string;
    fileKind: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storageKey: string;
    publicUrl: string | null;
    uploadedByRole: string;
    createdAt: string;
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    fromStatus: RequestStatus | null;
    toStatus: RequestStatus | null;
    note: string | null;
    actorRole: string;
    actorDisplayName: string | null;
    createdAt: string;
    operator: {
      id: string;
      displayName: string;
    } | null;
  }>;
  buildingRepairDetail: {
    building: string;
    floor: number;
    locationDetail: string;
    problemCategoryOther: string | null;
    description: string;
    additionalDetails: string | null;
    problemCategory: {
      id: string;
      name: string;
      helperText: string | null;
    };
  } | null;
  vehicleRepairDetail: {
    vehiclePlate: string;
    issueCategoryOther: string | null;
    symptom: string;
    additionalDetails: string | null;
    issueCategory: {
      id: string;
      name: string;
    };
  } | null;
  messengerBookingDetail: {
    pickupDatetime: string;
    itemType: string;
    itemDescription: string;
    outsideBkkMetro: boolean;
    deliveryService: string | null;
    deliveryServiceOther: string | null;
  } | null;
  documentRequestDetail: {
    siteNameRaw: string;
    documentDescription: string;
    purpose: string;
    neededDate: string;
    deliveryMethod: string;
    note: string | null;
    pickupNote: string | null;
  } | null;
};

export type MyRequestsResponse = {
  items: MyRequestItem[];
  page: number;
  limit: number;
  total: number;
};

export type MyRequestsQuery = {
  type?: RequestType;
  status?: RequestStatus;
  q?: string;
  sortBy?: "latestActivityAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export async function getMyRequests(query: MyRequestsQuery = {}) {
  return apiFetch<MyRequestsResponse>("/requests/my", {
    method: "GET",
    tokenType: "employee",
    query,
  });
}

export async function getMyRequestDetail(id: string) {
  return apiFetch<RequestDetail>(`/requests/${id}`, {
    method: "GET",
    tokenType: "employee",
  });
}

export async function cancelMyRequest(id: string, reason: string) {
  return apiFetch<{ id: string; status: RequestStatus }>(`/requests/${id}/cancel`, {
    method: "PATCH",
    tokenType: "employee",
    body: { reason },
  });
}

export async function getMyRequestAttachmentDownloadUrl(requestId: string, attachmentId: string) {
  return apiFetch<{
    attachmentId: string;
    fileName: string;
    fileKind: string;
    mimeType: string;
    fileSize: number;
    downloadUrl: string;
    expiresAt: string;
  }>(`/requests/${requestId}/attachments/${attachmentId}/download-url`, {
    method: "GET",
    tokenType: "employee",
  });
}
