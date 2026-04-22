import { apiFetch } from "@/lib/api/client";

export type AdminNotificationItem = {
  id: string;
  requestId: string | null;
  eventType: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type AdminNotificationListResponse = {
  items: AdminNotificationItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminNotificationListQuery = {
  page?: number;
  limit?: number;
  isRead?: boolean;
  eventType?: string;
};

export async function getAdminNotifications(
  query: AdminNotificationListQuery = {},
) {
  const { page, limit = 20, isRead, eventType } = query;

  return apiFetch<AdminNotificationListResponse>("/admin/notifications", {
    method: "GET",
    tokenType: "admin",
    query: { page, limit, isRead, eventType },
  });
}

export async function markAdminNotificationRead(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/notifications/${id}/read`, {
    method: "PATCH",
    tokenType: "admin",
  });
}

export async function markAdminNotificationsReadAll() {
  return apiFetch<{ updated: number }>("/admin/notifications/read-all", {
    method: "PATCH",
    tokenType: "admin",
  });
}
