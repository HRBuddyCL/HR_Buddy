import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCsv } from '../admin-requests/utils/csv.util';
import { buildAdminAuditWhere } from './admin-audit-query.builder';
import {
  AdminAuditCsvExportResult,
  AdminAuditLogListResponse,
  AdminAuditXlsxExportResult,
} from './admin-audit.types';
import { AdminAuditExportQueryDto } from './dto/admin-audit-export.query.dto';
import { AdminAuditListQueryDto } from './dto/admin-audit-list.query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const DEFAULT_EXPORT_LIMIT = 2000;
const MAX_EXPORT_LIMIT = 10000;

const REQUEST_TYPE_LABEL_MAP: Record<string, string> = {
  BUILDING: 'ซ่อมอาคาร',
  VEHICLE: 'ซ่อมรถ',
  MESSENGER: 'ขนส่ง',
  DOCUMENT: 'เอกสาร',
};

const REQUEST_STATUS_LABEL_MAP: Record<string, string> = {
  NEW: 'ใหม่',
  APPROVED: 'อนุมัติ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  IN_TRANSIT: 'กำลังขนส่ง',
  DONE: 'เสร็จสิ้น',
  REJECTED: 'ไม่อนุมัติ',
  CANCELED: 'ยกเลิก',
};

const REQUEST_URGENCY_LABEL_MAP: Record<string, string> = {
  NORMAL: 'ปกติ',
  HIGH: 'สูง',
  CRITICAL: 'เร่งด่วน',
};

const ACTION_LABEL_MAP: Record<string, string> = {
  CREATE: 'สร้างคำขอ',
  APPROVE: 'อนุมัติ',
  REJECT: 'ไม่อนุมัติ',
  STATUS_CHANGE: 'เปลี่ยนสถานะ',
  CANCEL: 'ยกเลิกคำขอ',
  UPLOAD_ATTACHMENT: 'อัปโหลดไฟล์',
  REPORT_PROBLEM: 'รายงานปัญหา',
  MESSENGER_PICKUP_EVENT: 'อัปเดตงานขนส่ง',
};

const ACTOR_ROLE_LABEL_MAP: Record<string, string> = {
  EMPLOYEE: 'พนักงาน',
  ADMIN: 'ผู้ดูแล',
  MESSENGER: 'แมสเซนเจอร์',
};

const RISK_LABEL_MAP: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'ปกติ',
  MEDIUM: 'สำคัญ',
  HIGH: 'เสี่ยงสูง',
};

@Injectable()
export class AdminAuditService {
  private readonly thaiCsvDateTimeFormatter = new Intl.DateTimeFormat(
    'th-TH-u-ca-buddhist-nu-latn',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    },
  );

  constructor(private readonly prisma: PrismaService) {}

  private toRequestTypeLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return REQUEST_TYPE_LABEL_MAP[value] ?? value;
  }

  private toRequestStatusLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return REQUEST_STATUS_LABEL_MAP[value] ?? value;
  }

  private toRequestUrgencyLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return REQUEST_URGENCY_LABEL_MAP[value] ?? value;
  }

  private toActionLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return ACTION_LABEL_MAP[value] ?? value;
  }

  private toActorRoleLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return ACTOR_ROLE_LABEL_MAP[value] ?? value;
  }

  private toSourceLabel(actorRole: string | null | undefined): string {
    if (actorRole === 'MESSENGER') {
      return 'Magic Link';
    }

    if (actorRole === 'ADMIN') {
      return 'แผงผู้ดูแล';
    }

    return 'พอร์ทัลพนักงาน';
  }

  private toOutcomeLabel(action: string | null | undefined): string {
    if (action === 'REJECT') {
      return 'ไม่อนุมัติ';
    }

    if (action === 'CANCEL') {
      return 'ยกเลิก';
    }

    return 'สำเร็จ';
  }

  private toRiskLevel(
    action: string | null | undefined,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (action === 'CANCEL' || action === 'REJECT') {
      return 'HIGH';
    }

    if (action === 'STATUS_CHANGE' || action === 'REPORT_PROBLEM') {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private toRiskLabel(action: string | null | undefined): string {
    return RISK_LABEL_MAP[this.toRiskLevel(action)];
  }

  private toChangeSummary(log: {
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
  }): string {
    if (log.fromStatus || log.toStatus) {
      return `${this.toRequestStatusLabel(log.fromStatus)} ไปยัง ${this.toRequestStatusLabel(log.toStatus)}`;
    }

    if (log.note?.trim()) {
      return log.note.trim();
    }

    return '-';
  }

  private formatThaiDateTime(value: Date | null): string {
    if (!value) {
      return '-';
    }

    const parts = this.thaiCsvDateTimeFormatter.formatToParts(value);
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
    const second = parts.find((part) => part.type === 'second')?.value ?? '00';

    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  }

  private formatFilterSummary(q: AdminAuditExportQueryDto): string {
    const parts: string[] = [];

    if (q.requestType) {
      parts.push(`ประเภทคำขอ: ${this.toRequestTypeLabel(q.requestType)}`);
    }

    if (q.requestStatus) {
      parts.push(`สถานะคำขอ: ${this.toRequestStatusLabel(q.requestStatus)}`);
    }

    if (q.requestUrgency) {
      parts.push(
        `ระดับความเร่งด่วน: ${this.toRequestUrgencyLabel(q.requestUrgency)}`,
      );
    }

    if (q.requestNo?.trim()) {
      parts.push(`เลขคำขอ: ${q.requestNo.trim()}`);
    }

    if (q.action) {
      parts.push(`การกระทำ: ${this.toActionLabel(q.action)}`);
    }

    if (q.actorRole) {
      parts.push(`บทบาทผู้ทำรายการ: ${this.toActorRoleLabel(q.actorRole)}`);
    }

    if (q.operatorId?.trim()) {
      parts.push(`รหัสผู้รับผิดชอบ: ${q.operatorId.trim()}`);
    }

    if (q.departmentId?.trim()) {
      parts.push(`แผนก: ${q.departmentId.trim()}`);
    }

    if (q.dateFrom) {
      parts.push(`วันที่เริ่มต้น: ${q.dateFrom}`);
    }

    if (q.dateTo) {
      parts.push(`วันที่สิ้นสุด: ${q.dateTo}`);
    }

    if (q.q?.trim()) {
      parts.push(`คำค้นหา: ${q.q.trim()}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'ทั้งหมด';
  }

  async list(q: AdminAuditListQueryDto): Promise<AdminAuditLogListResponse> {
    const where = buildAdminAuditWhere(q);

    const page = q.page ?? DEFAULT_PAGE;
    const limit = Math.min(q.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      this.prisma.requestActivityLog.count({ where }),
      this.prisma.requestActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          request: {
            select: {
              id: true,
              requestNo: true,
              type: true,
              status: true,
              urgency: true,
              employeeName: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          operator: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      }),
    ]);

    const items = logs.map((log) => {
      const actorLabel =
        log.operator?.displayName ??
        log.actorDisplayName ??
        (log.actorRole === 'EMPLOYEE'
          ? log.request.employeeName
          : log.actorRole);

      return {
        id: log.id,
        requestId: log.request.id,
        requestNo: log.request.requestNo,
        departmentName: log.request.department?.name ?? null,
        requestType: log.request.type,
        requestStatus: log.request.status,
        requestUrgency: log.request.urgency,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        actorRole: log.actorRole,
        actorDisplayName: log.actorDisplayName,
        actorLabel,
        operatorId: log.operator?.id ?? null,
        operatorName: log.operator?.displayName ?? null,
        note: log.note,
        createdAt: log.createdAt,
      };
    });

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async exportCsv(
    q: AdminAuditExportQueryDto,
  ): Promise<AdminAuditCsvExportResult> {
    const where = buildAdminAuditWhere(q);
    const limit = Math.min(q.limit ?? DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

    const logs = await this.prisma.requestActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        request: {
          select: {
            requestNo: true,
            type: true,
            status: true,
            employeeName: true,
          },
        },
        operator: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const headers = [
      'createdAt',
      'requestNo',
      'requestType',
      'requestStatus',
      'action',
      'fromStatus',
      'toStatus',
      'actorRole',
      'actorDisplayName',
      'operatorId',
      'operatorName',
      'note',
    ];

    const rows = logs.map((log) => [
      log.createdAt,
      log.request.requestNo,
      log.request.type,
      log.request.status,
      log.action,
      log.fromStatus,
      log.toStatus,
      log.actorRole,
      log.actorDisplayName,
      log.operator?.id ?? null,
      log.operator?.displayName ?? null,
      log.note,
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return {
      fileName: `audit-activity-export-${timestamp}.csv`,
      rowCount: logs.length,
      csvContent: buildCsv(headers, rows),
    };
  }

  async exportXlsx(
    q: AdminAuditExportQueryDto,
  ): Promise<AdminAuditXlsxExportResult> {
    const where = buildAdminAuditWhere(q);
    const limit = Math.min(q.limit ?? DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

    const logs = await this.prisma.requestActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        request: {
          select: {
            id: true,
            requestNo: true,
            type: true,
            status: true,
            employeeName: true,
          },
        },
        operator: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const workbook = new Workbook();
    workbook.creator = 'HR Buddy';
    workbook.lastModifiedBy = 'HR Buddy';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Audit Logs');
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    };

    const columns = [
      { header: 'ลำดับ', width: 8 },
      { header: 'วันเวลา', width: 24 },
      { header: 'เลขคำขอ', width: 18 },
      { header: 'ประเภทคำขอ', width: 16 },
      { header: 'สถานะคำขอ', width: 16 },
      { header: 'ที่มา', width: 16 },
      { header: 'ผลลัพธ์', width: 14 },
      { header: 'ความเสี่ยง', width: 12 },
      { header: 'การกระทำ', width: 20 },
      { header: 'สถานะก่อน', width: 16 },
      { header: 'สถานะหลัง', width: 16 },
      { header: 'บทบาทผู้ทำรายการ', width: 20 },
      { header: 'ชื่อผู้ทำรายการ', width: 24 },
      { header: 'ผู้รับผิดชอบ', width: 22 },
      { header: 'รหัสติดตาม', width: 28 },
      { header: 'สรุปการเปลี่ยนแปลง', width: 34 },
      { header: 'หมายเหตุ', width: 36 },
    ];

    const totalColumns = columns.length;
    const metadataRows = [
      ['Generated at', this.formatThaiDateTime(new Date())],
      ['Filters', this.formatFilterSummary(q)],
      ['Total rows', `${logs.length}`],
    ] as const;

    const headerRowIndex = metadataRows.length + 4;

    worksheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    worksheet.columns = columns.map((column) => ({ width: column.width }));

    worksheet.mergeCells(1, 1, 1, totalColumns);
    worksheet.getCell(1, 1).value = 'รายงานบันทึกการใช้งานผู้ดูแลระบบ';
    worksheet.getCell(1, 1).font = {
      bold: true,
      size: 18,
      color: { argb: 'FFFFFFFF' },
    };
    worksheet.getCell(1, 1).alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    worksheet.getCell(1, 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    worksheet.getRow(1).height = 32;

    metadataRows.forEach((values, index) => {
      const rowIndex = index + 3;
      worksheet.getCell(rowIndex, 1).value = values[0];
      worksheet.getCell(rowIndex, 1).font = {
        bold: true,
        color: { argb: 'FF1E293B' },
      };
      worksheet.getCell(rowIndex, 1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      worksheet.getCell(rowIndex, 1).alignment = {
        vertical: 'middle',
        horizontal: 'left',
      };
      worksheet.mergeCells(rowIndex, 2, rowIndex, totalColumns);
      worksheet.getCell(rowIndex, 2).value = values[1];
      worksheet.getCell(rowIndex, 2).alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
      };

      for (let columnIndex = 1; columnIndex <= totalColumns; columnIndex += 1) {
        const cell = worksheet.getCell(rowIndex, columnIndex);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.values = columns.map((column) => column.header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 24;

    for (let columnIndex = 1; columnIndex <= totalColumns; columnIndex += 1) {
      const cell = headerRow.getCell(columnIndex);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4ED8' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
        right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      };
    }

    if (logs.length === 0) {
      const rowIndex = headerRowIndex + 1;
      worksheet.mergeCells(rowIndex, 1, rowIndex, totalColumns);
      const emptyCell = worksheet.getCell(rowIndex, 1);
      emptyCell.value = 'ไม่พบบันทึกที่ตรงกับตัวกรองที่เลือก';
      emptyCell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      emptyCell.font = {
        italic: true,
        color: { argb: 'FF64748B' },
      };
      emptyCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    } else {
      logs.forEach((log, index) => {
        const actorLabel =
          log.operator?.displayName ??
          log.actorDisplayName ??
          (log.actorRole === 'EMPLOYEE'
            ? log.request.employeeName
            : log.actorRole);

        const row = worksheet.addRow([
          index + 1,
          this.formatThaiDateTime(log.createdAt),
          log.request.requestNo,
          this.toRequestTypeLabel(log.request.type),
          this.toRequestStatusLabel(log.request.status),
          this.toSourceLabel(log.actorRole),
          this.toOutcomeLabel(log.action),
          this.toRiskLabel(log.action),
          this.toActionLabel(log.action),
          this.toRequestStatusLabel(log.fromStatus),
          this.toRequestStatusLabel(log.toStatus),
          this.toActorRoleLabel(log.actorRole),
          actorLabel,
          log.operator?.displayName ?? '-',
          log.id,
          this.toChangeSummary(log),
          log.note ?? '-',
        ]);

        row.height = 21;
        const isAlternateRow = index % 2 === 1;

        for (
          let columnIndex = 1;
          columnIndex <= totalColumns;
          columnIndex += 1
        ) {
          const cell = row.getCell(columnIndex);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };

          cell.alignment = {
            vertical: 'middle',
            horizontal:
              columnIndex === 1 ||
              columnIndex === 6 ||
              columnIndex === 7 ||
              columnIndex === 8 ||
              columnIndex === 9
                ? 'center'
                : 'left',
          };

          if (isAlternateRow) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        }
      });
    }

    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: totalColumns },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const xlsxContent = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      fileName: `audit-activity-export-${timestamp}.xlsx`,
      rowCount: logs.length,
      xlsxContent,
    };
  }
}
