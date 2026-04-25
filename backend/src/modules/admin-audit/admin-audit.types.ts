import {
  ActivityAction,
  ActorRole,
  RequestStatus,
  RequestType,
  Urgency,
} from '@prisma/client';

export type AdminAuditLogItem = {
  id: string;
  requestId: string;
  requestNo: string;
  departmentName: string | null;
  requestType: RequestType;
  requestStatus: RequestStatus;
  requestUrgency: Urgency;
  action: ActivityAction;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  actorRole: ActorRole;
  actorDisplayName: string | null;
  actorLabel: string;
  operatorId: string | null;
  operatorName: string | null;
  note: string | null;
  createdAt: Date;
};

export type AdminAuditLogListResponse = {
  items: AdminAuditLogItem[];
  page: number;
  limit: number;
  total: number;
};

export type AdminAuditCsvExportResult = {
  fileName: string;
  rowCount: number;
  csvContent: string;
};

export type AdminAuditXlsxExportResult = {
  fileName: string;
  rowCount: number;
  xlsxContent: Buffer;
};
