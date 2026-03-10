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

export async function getAdminNotifications(limit = 20) {
  return apiFetch<AdminNotificationListResponse>("/admin/notifications", {
    method: "GET",
    tokenType: "admin",
    query: { limit },
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
