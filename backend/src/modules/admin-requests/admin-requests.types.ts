import { RequestStatus, RequestType, Urgency } from '@prisma/client';

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
};

export type AdminRequestListResponse = {
  items: AdminRequestListItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminRequestSummaryResponse = {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byType: Record<RequestType, number>;
  byDay: Array<{
    date: string;
    total: number;
  }>;
};

export type AdminRequestCsvExportResult = {
  fileName: string;
  rowCount: number;
  csvContent: string;
};

export type AdminRequestXlsxExportResult = {
  fileName: string;
  rowCount: number;
  xlsxContent: Buffer;
};

export type AdminRequestDetailResponse = unknown;
