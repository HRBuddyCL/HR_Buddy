import { apiFetch } from "@/lib/api/client";

export const EMPLOYEE_NOTIFICATIONS_REFRESH_EVENT =
  "employee-notifications:refresh";

function dispatchEmployeeNotificationsRefreshEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(EMPLOYEE_NOTIFICATIONS_REFRESH_EVENT));
}

export type NotificationEventType =
  | "APPROVED"
  | "REJECTED"
  | "DONE"
  | "CANCELED"
  | "MESSENGER_BOOKED"
  | "PROBLEM_REPORTED";

export type NotificationItem = {
  id: string;
  requestId: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
};

export type NotificationListQuery = {
  isRead?: boolean;
  eventType?: NotificationEventType;
  page?: number;
  limit?: number;
};

export async function getMyNotifications(
  queryOrLimit: number | NotificationListQuery = 20,
) {
  const query =
    typeof queryOrLimit === "number" ? { limit: queryOrLimit } : queryOrLimit;

  return apiFetch<NotificationListResponse>("/notifications/my", {
    method: "GET",
    tokenType: "employee",
    query,
  });
}

export async function markMyNotificationRead(id: string) {
  const result = await apiFetch<{ ok: boolean }>(`/notifications/my/${id}/read`, {
    method: "PATCH",
    tokenType: "employee",
  });

  dispatchEmployeeNotificationsRefreshEvent();
  return result;
}

export async function markMyNotificationsReadAll() {
  const result = await apiFetch<{ updated: number }>("/notifications/my/read-all", {
    method: "PATCH",
    tokenType: "employee",
  });

  dispatchEmployeeNotificationsRefreshEvent();
  return result;
}
