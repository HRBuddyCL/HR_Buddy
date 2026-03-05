import { RequestStatus, RequestType, SlaStatus, Urgency } from '@prisma/client';

export type AdminRequestListItem = {
  id: string;
  requestNo: string;
  type: RequestType;
  status: RequestStatus;
  urgency: Urgency;
  employeeName: string;
  phone: string;
  departmentId: string;
  createdAt: Date;
  latestActivityAt: Date;
  closedAt: Date | null;
  requestSla: { slaStatus: SlaStatus; slaDueAt: Date } | null;
};

export type AdminRequestListResponse = {
  items: AdminRequestListItem[];
  page: number;
  limit: number;
  total: number;
};

// detail ให้เป็น unknown ไปก่อน (ดีกว่า any และไม่โดน no-unsafe)
// เดี๋ยว Step 9–10 ค่อยทำ DTO detail จริง
export type AdminRequestDetailResponse = unknown;
