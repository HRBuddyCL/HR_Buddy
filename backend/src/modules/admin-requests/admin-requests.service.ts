import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorRole,
  Prisma,
  RequestStatus,
  RequestType,
  Urgency,
} from '@prisma/client';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { MessengerService } from '../messenger/messenger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildAdminRequestWhere } from './admin-request-query.builder';
import {
  AdminRequestCsvExportResult,
  AdminRequestDetailResponse,
  AdminRequestListResponse,
  AdminRequestSummaryResponse,
  AdminRequestXlsxExportResult,
} from './admin-requests.types';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';
import { AdminRequestsExportQueryDto } from './dto/admin-requests-export.query.dto';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import { AdminRequestsReportQueryDto } from './dto/admin-requests-report.query.dto';
import { assertDocumentPreconditions } from './rules/document-precondition.rules';
import {
  assertActionNoteRule,
  isTerminalStatus,
  normalizeNote,
} from './rules/request-action.rules';
import { assertValidTransition } from './rules/request-transition.rules';
import { buildCsv } from './utils/csv.util';

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_PAGE = 1;
const MAX_EXPORT_LIMIT = 5000;
const DEFAULT_EXPORT_LIMIT = 1000;

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  BUILDING: 'ซ่อมอาคาร',
  VEHICLE: 'ซ่อมรถ',
  MESSENGER: 'ขนส่ง',
  DOCUMENT: 'เอกสาร',
};

const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: 'ใหม่',
  APPROVED: 'อนุมัติ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  IN_TRANSIT: 'กำลังขนส่ง',
  DONE: 'เสร็จสิ้น',
  REJECTED: 'ไม่อนุมัติ',
  CANCELED: 'ยกเลิก',
};

const URGENCY_LABEL: Record<Urgency, string> = {
  NORMAL: 'ปกติ',
  HIGH: 'สูง',
  CRITICAL: 'เร่งด่วน',
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class AdminRequestsService {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly messengerService: MessengerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private formatAsSpreadsheetText(value: string): string {
    const escapedValue = value.replace(/"/g, '""');
    return `="${escapedValue}"`;
  }

  private getDateTimePart(
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): string {
    return parts.find((part) => part.type === type)?.value ?? '';
  }

  private formatTypeLabel(type: RequestType): string {
    return REQUEST_TYPE_LABEL[type] ?? type;
  }

  private formatStatusLabel(status: RequestStatus): string {
    return REQUEST_STATUS_LABEL[status] ?? status;
  }

  private formatUrgencyLabel(urgency: Urgency): string {
    return URGENCY_LABEL[urgency] ?? urgency;
  }

  private toCsvLine(values: string[]): string {
    return values
      .map((value) => {
        if (/[",\r\n]/.test(value)) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return value;
      })
      .join(',');
  }

  private formatFilterSummary(q: AdminRequestsExportQueryDto): string {
    const parts: string[] = [];

    if (q.type) {
      parts.push(`ประเภท: ${this.formatTypeLabel(q.type)}`);
    }

    if (q.status) {
      parts.push(`สถานะ: ${this.formatStatusLabel(q.status)}`);
    }

    if (q.dateFrom) {
      parts.push(`ตั้งแต่วันที่: ${q.dateFrom}`);
    }

    if (q.dateTo) {
      parts.push(`ถึงวันที่: ${q.dateTo}`);
    }

    if (q.q?.trim()) {
      parts.push(`คำค้นหา: ${q.q.trim()}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'ทั้งหมด';
  }

  private formatPhoneForExcel(phone: string | null): string {
    return phone?.trim() ?? '';
  }

  private formatThaiDateTime(value: Date | null): string {
    if (!value) {
      return '';
    }

    const parts = this.thaiCsvDateTimeFormatter.formatToParts(value);
    const day = this.getDateTimePart(parts, 'day');
    const month = this.getDateTimePart(parts, 'month');
    const year = this.getDateTimePart(parts, 'year');
    const hour = this.getDateTimePart(parts, 'hour');
    const minute = this.getDateTimePart(parts, 'minute');
    const second = this.getDateTimePart(parts, 'second');

    return `${day}/${month}/${year} ${hour}:${minute}:${second} น.`;
  }

  private async getExportItems(q: AdminRequestsExportQueryDto) {
    const where = buildAdminRequestWhere(q);
    const limit = Math.min(q.limit ?? DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

    return this.prisma.request.findMany({
      where,
      orderBy: { latestActivityAt: 'desc' },
      take: limit,
      select: {
        requestNo: true,
        type: true,
        status: true,
        urgency: true,
        employeeName: true,
        phone: true,
        department: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        latestActivityAt: true,
        closedAt: true,
      },
    });
  }

  private formatPhoneForCsv(phone: string | null): string {
    const normalizedPhone = phone?.trim();

    if (!normalizedPhone) {
      return '';
    }

    return this.formatAsSpreadsheetText(normalizedPhone);
  }

  private formatThaiDateTimeForCsv(value: Date | null): string {
    return this.formatAsSpreadsheetText(this.formatThaiDateTime(value));
  }

  async list(q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    const where = buildAdminRequestWhere(q);

    const limit = Math.min(q.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const page = q.page ?? DEFAULT_PAGE;
    const skip = (page - 1) * limit;

    const total = await this.prisma.request.count({ where });

    const items = await this.prisma.request.findMany({
      where,
      orderBy: { latestActivityAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        requestNo: true,
        type: true,
        status: true,
        urgency: true,
        employeeName: true,
        phone: true,
        departmentId: true,
        createdAt: true,
        latestActivityAt: true,
        closedAt: true,
      },
    });

    return { items, page, limit, total };
  }

  async summary(
    q: AdminRequestsReportQueryDto,
  ): Promise<AdminRequestSummaryResponse> {
    const where = buildAdminRequestWhere(q);

    const rows = await this.prisma.request.findMany({
      where,
      select: {
        status: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const byStatus = Object.values(RequestStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<RequestStatus, number>,
    );

    const byType = Object.values(RequestType).reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<RequestType, number>,
    );

    const byDayMap = rows.reduce<Record<string, number>>((acc, row) => {
      byStatus[row.status] += 1;
      byType[row.type] += 1;

      const key = row.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;

      return acc;
    }, {});

    const byDay = Object.entries(byDayMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, total: count }));

    return {
      total: rows.length,
      byStatus,
      byType,
      byDay,
    };
  }

  async exportCsv(
    q: AdminRequestsExportQueryDto,
  ): Promise<AdminRequestCsvExportResult> {
    const items = await this.getExportItems(q);

    const headers = [
      'ลำดับ',
      'เลขคำขอ',
      'ประเภทคำขอ',
      'สถานะ',
      'ความเร่งด่วน',
      'ผู้แจ้ง',
      'เบอร์โทร',
      'หน่วยงาน',
      'วันที่สร้าง',
      'อัปเดตล่าสุด',
      'วันที่ปิดงาน',
    ];

    const rowsForCsv = items.map((item, index) => [
      index + 1,
      item.requestNo,
      this.formatTypeLabel(item.type),
      this.formatStatusLabel(item.status),
      this.formatUrgencyLabel(item.urgency),
      item.employeeName,
      this.formatPhoneForCsv(item.phone),
      item.department.name,
      this.formatThaiDateTimeForCsv(item.createdAt),
      this.formatThaiDateTimeForCsv(item.latestActivityAt),
      this.formatThaiDateTimeForCsv(item.closedAt),
    ]);

    const reportMetadataRows = [
      ['รายงานคำขอฝ่ายผู้ดูแลระบบ', ''],
      ['วันที่ออกรายงาน', this.formatThaiDateTimeForCsv(new Date())],
      ['จำนวนรายการ', String(items.length)],
      ['ตัวกรองที่ใช้', this.formatFilterSummary(q)],
      ['', ''],
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const metadataCsv = reportMetadataRows
      .map(([label, value]) => this.toCsvLine([label, value]))
      .join('\n');
    const tableCsv = buildCsv(headers, rowsForCsv);
    const csvBody = `${metadataCsv}\n${tableCsv}`;

    return {
      fileName: `requests-export-${timestamp}.csv`,
      rowCount: items.length,
      // Prefix UTF-8 BOM so spreadsheet apps (e.g., Excel) render Thai correctly.
      csvContent: `\uFEFF${csvBody}`,
    };
  }

  async exportXlsx(
    q: AdminRequestsExportQueryDto,
  ): Promise<AdminRequestXlsxExportResult> {
    const items = await this.getExportItems(q);
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('รายงานคำขอ', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    const columns = [
      { header: 'ลำดับ', width: 8 },
      { header: 'เลขคำขอ', width: 18 },
      { header: 'ประเภทคำขอ', width: 16 },
      { header: 'สถานะ', width: 18 },
      { header: 'ความเร่งด่วน', width: 14 },
      { header: 'ผู้แจ้ง', width: 24 },
      { header: 'เบอร์โทร', width: 16 },
      { header: 'หน่วยงาน', width: 22 },
      { header: 'วันที่สร้าง', width: 24 },
      { header: 'อัปเดตล่าสุด', width: 24 },
      { header: 'วันที่ปิดงาน', width: 24 },
    ];

    worksheet.columns = columns.map((column) => ({ width: column.width }));
    worksheet.mergeCells(1, 1, 1, columns.length);
    worksheet.getCell(1, 1).value = 'รายงานคำขอฝ่ายผู้ดูแลระบบ';
    worksheet.getCell(1, 1).font = {
      bold: true,
      size: 16,
      color: { argb: 'FF0F172A' },
    };
    worksheet.getCell(1, 1).alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    worksheet.getRow(1).height = 28;

    const metadataRows = [
      ['วันที่ออกรายงาน', this.formatThaiDateTime(new Date())],
      ['จำนวนรายการ', String(items.length)],
      ['ตัวกรองที่ใช้', this.formatFilterSummary(q)],
    ];

    metadataRows.forEach((values, index) => {
      const rowIndex = index + 2;
      worksheet.getCell(rowIndex, 1).value = values[0];
      worksheet.getCell(rowIndex, 1).font = {
        bold: true,
        color: { argb: 'FF334155' },
      };
      worksheet.mergeCells(rowIndex, 2, rowIndex, columns.length);
      worksheet.getCell(rowIndex, 2).value = values[1];
      worksheet.getCell(rowIndex, 2).alignment = { wrapText: true };
    });

    const headerRowIndex = 6;
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.values = columns.map((column) => column.header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 22;

    for (let columnIndex = 1; columnIndex <= columns.length; columnIndex += 1) {
      const cell = headerRow.getCell(columnIndex);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }

    items.forEach((item, index) => {
      const row = worksheet.addRow([
        index + 1,
        item.requestNo,
        this.formatTypeLabel(item.type),
        this.formatStatusLabel(item.status),
        this.formatUrgencyLabel(item.urgency),
        item.employeeName,
        this.formatPhoneForExcel(item.phone),
        item.department.name,
        this.formatThaiDateTime(item.createdAt),
        this.formatThaiDateTime(item.latestActivityAt),
        this.formatThaiDateTime(item.closedAt),
      ]);

      const isAlternateRow = index % 2 === 1;
      row.height = 20;

      for (
        let columnIndex = 1;
        columnIndex <= columns.length;
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
            columnIndex === 1 || columnIndex === 4 || columnIndex === 5
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

    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: columns.length },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      fileName: `requests-report-${timestamp}.xlsx`,
      rowCount: items.length,
      xlsxContent: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }

  async detail(id: string): Promise<AdminRequestDetailResponse> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        activityLogs: {
          orderBy: { createdAt: 'asc' },
          include: { operator: true },
        },
        buildingRepairDetail: { include: { problemCategory: true } },
        vehicleRepairDetail: { include: { issueCategory: true } },
        messengerBookingDetail: {
          include: { senderAddress: true, receiverAddress: true },
        },
        documentRequestDetail: {
          include: { deliveryAddress: true, digitalFileAttachment: true },
        },
        magicLink: true,
      },
    });

    if (!req) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }

    return req;
  }

  async updateStatus(id: string, dto: AdminRequestActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const operatorId = dto.operatorId.trim();
      if (!operatorId) {
        throw new BadRequestException({
          code: 'INVALID_OPERATOR_ID',
          message: 'Invalid operatorId',
        });
      }

      await this.acquireRequestMutationLock(tx, id);

      const req = await tx.request.findUnique({
        where: { id },
        select: {
          type: true,
          status: true,
          requestNo: true,
          phone: true,
          documentRequestDetail: {
            select: {
              deliveryMethod: true,
              deliveryAddressId: true,
              digitalFileAttachmentId: true,
              pickupNote: true,
            },
          },
        },
      });

      if (!req) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      const operator = await tx.operator.findUnique({
        where: { id: operatorId },
        select: { id: true, isActive: true, displayName: true },
      });

      if (!operator) {
        throw new BadRequestException({
          code: 'INVALID_OPERATOR_ID',
          message: 'Invalid operatorId',
        });
      }

      if (!operator.isActive) {
        throw new BadRequestException({
          code: 'OPERATOR_INACTIVE',
          message: 'operatorId is inactive',
        });
      }

      assertValidTransition(req.type, req.status, dto.status);

      const normalizedNote = normalizeNote(dto.note);
      assertActionNoteRule(dto.status, normalizedNote);

      if (req.type === RequestType.DOCUMENT) {
        const detail = req.documentRequestDetail;

        if (!detail) {
          throw new BadRequestException({
            code: 'DOCUMENT_DETAIL_NOT_FOUND',
            message: 'Document detail not found for this request',
          });
        }

        let nextDigitalFileAttachmentId = detail.digitalFileAttachmentId;
        let nextPickupNote = detail.pickupNote;

        if (dto.digitalFileAttachmentId !== undefined) {
          const attachment = await tx.requestAttachment.findUnique({
            where: { id: dto.digitalFileAttachmentId },
            select: { id: true, requestId: true, fileKind: true },
          });

          if (!attachment || attachment.requestId !== id) {
            throw new BadRequestException({
              code: 'INVALID_DIGITAL_FILE_ATTACHMENT_ID',
              message:
                'digitalFileAttachmentId must refer to an attachment of this request',
            });
          }

          if (attachment.fileKind !== 'DOCUMENT') {
            throw new BadRequestException({
              code: 'DIGITAL_FILE_ATTACHMENT_MUST_BE_DOCUMENT',
              message: 'digitalFileAttachmentId must be a DOCUMENT file kind',
            });
          }

          nextDigitalFileAttachmentId = dto.digitalFileAttachmentId;
        }

        if (dto.pickupNote !== undefined) {
          nextPickupNote = dto.pickupNote.trim() ? dto.pickupNote.trim() : null;
        }

        assertDocumentPreconditions({
          toStatus: dto.status,
          deliveryMethod: detail.deliveryMethod,
          deliveryAddressId: detail.deliveryAddressId,
          digitalFileAttachmentId: nextDigitalFileAttachmentId,
          pickupNote: nextPickupNote,
        });

        if (
          dto.pickupNote !== undefined ||
          dto.digitalFileAttachmentId !== undefined
        ) {
          await tx.documentRequestDetail.update({
            where: { requestId: id },
            data: {
              pickupNote:
                dto.pickupNote !== undefined ? nextPickupNote : undefined,
              digitalFileAttachmentId:
                dto.digitalFileAttachmentId !== undefined
                  ? nextDigitalFileAttachmentId
                  : undefined,
            },
          });
        }
      }

      let magicLinkPayload: { url: string; expiresAt: Date } | null = null;

      if (
        req.type === RequestType.MESSENGER &&
        dto.status === RequestStatus.APPROVED
      ) {
        const generated =
          await this.messengerService.createOrRotateMagicLinkForRequest(tx, id);

        magicLinkPayload = {
          url: generated.url,
          expiresAt: generated.expiresAt,
        };
      }

      await tx.request.update({
        where: { id },
        data: {
          status: dto.status,
          latestActivityAt: new Date(),
          closedAt: isTerminalStatus(dto.status) ? new Date() : null,
        },
      });

      if (req.type === RequestType.MESSENGER && isTerminalStatus(dto.status)) {
        await this.messengerService.revokeMagicLinkForRequest(tx, id);
      }

      await tx.requestActivityLog.create({
        data: {
          requestId: id,
          action: 'STATUS_CHANGE',
          fromStatus: req.status,
          toStatus: dto.status,
          actorRole: 'ADMIN',
          operatorId,
          actorDisplayName: operator.displayName,
          note: normalizedNote,
        },
      });

      await this.notificationsService.notifyEmployeeStatusChange(
        {
          requestId: id,
          requestNo: req.requestNo,
          phone: req.phone,
          status: dto.status,
          note: normalizedNote,
          actorRole: ActorRole.ADMIN,
        },
        tx,
      );

      return {
        id,
        status: dto.status,
        ...(magicLinkPayload ? { magicLink: magicLinkPayload } : {}),
      };
    });
  }
  private async acquireRequestMutationLock(tx: Tx, requestId: string) {
    const lockKey = `request_mutation:${requestId}`;

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }
}
