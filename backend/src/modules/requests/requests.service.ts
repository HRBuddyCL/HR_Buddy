import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActorRole,
  Prisma,
  RequestStatus,
  RequestType,
  SlaStatus,
  Urgency,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import {
  assertBuildingOtherRule,
  assertBuildingRefsExist,
} from './rules/building.rules';
import {
  assertVehicleOtherRule,
  assertVehicleRefsExist,
} from './rules/vehicle.rules';
import { assertMessengerDeliveryRule } from './rules/messenger.rules';
import { assertDocumentCreateRule } from './rules/document.rules';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

/**
 * NOTE: requestNo ใน schema ไม่มี default
 * ตอนนี้ generate แบบ deterministic-ish ให้ unique พอใช้ dev
 * ถ้าโปรเจคมี format จริง (เช่น HRB-YYYYMM-000123) ค่อยเปลี่ยนทีหลัง
 */
function generateRequestNo(now = new Date()) {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HRB-${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

function normalizeSiteName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

type Tx = Prisma.TransactionClient;
type DetailCreator = (tx: Tx, requestId: string) => Promise<void>;

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core transaction creator:
   * - validate common refs (department)
   * - create Request
   * - call feature detailCreator (create detail table)
   * - create CREATE log
   * - create SLA
   * - update latestActivityAt
   * - return minimal response
   */
  private async createRequestCore(params: {
    type: RequestType;
    urgency: Urgency;
    employeeName: string;
    departmentId: string;
    phone: string;
    detailCreator: DetailCreator;
  }) {
    const { type, urgency, employeeName, departmentId, phone, detailCreator } =
      params;

    return this.prisma.$transaction(async (tx) => {
      // common FK validate: department
      const dept = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!dept) {
        throw new BadRequestException({
          code: 'INVALID_DEPARTMENT_ID',
          message: 'Invalid departmentId',
        });
      }

      // 1) create Request
      const request = await tx.request.create({
        data: {
          requestNo: generateRequestNo(),
          type,
          status: RequestStatus.NEW,
          urgency,
          employeeName,
          departmentId,
          phone,
        },
      });

      // 2) feature-specific detail
      await detailCreator(tx, request.id);

      // 3) log CREATE (common)
      await tx.requestActivityLog.create({
        data: {
          requestId: request.id,
          action: ActivityAction.CREATE,
          actorRole: ActorRole.EMPLOYEE,
        },
      });

      // 4) SLA (common)
      const policy = await tx.slaPolicy.findFirst({
        where: {
          requestType: type,
          urgency,
          isActive: true,
        },
        orderBy: { id: 'desc' },
      });

      const slaStartAt = request.createdAt;
      const resolveMinutes = policy?.resolveWithinMinutes ?? 0;
      const slaDueAt =
        resolveMinutes > 0
          ? new Date(slaStartAt.getTime() + resolveMinutes * 60_000)
          : slaStartAt;

      await tx.requestSla.create({
        data: {
          requestId: request.id,
          slaStartAt,
          slaDueAt,
          slaStatus: SlaStatus.ON_TRACK,
          lastCalculatedAt: new Date(),
        },
      });

      // 5) latestActivityAt (common)
      await tx.request.update({
        where: { id: request.id },
        data: { latestActivityAt: new Date() },
        select: { id: true },
      });

      return {
        id: request.id,
        requestNo: request.requestNo,
        status: request.status,
      };
    });
  }

  // -----------------------------
  // Feature: BUILDING
  // -----------------------------
  async createBuilding(dto: CreateBuildingRequestDto) {
    // feature rule: other requires text
    assertBuildingOtherRule(dto);

    return this.createRequestCore({
      type: RequestType.BUILDING,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      detailCreator: async (tx, requestId) => {
        // feature FK validate: problemCategory
        await assertBuildingRefsExist(tx, dto);

        await tx.buildingRepairDetail.create({
          data: {
            requestId,
            building: dto.building,
            floor: dto.floor,
            locationDetail: dto.locationDetail,

            problemCategoryId: dto.problemCategoryId,
            problemCategoryOther: dto.problemCategoryOther ?? null,

            description: dto.description,
            additionalDetails: dto.additionalDetails ?? null,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: VEHICLE
  // -----------------------------
  async createVehicle(dto: CreateVehicleRequestDto) {
    assertVehicleOtherRule(dto);

    return this.createRequestCore({
      type: RequestType.VEHICLE,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      detailCreator: async (tx, requestId) => {
        await assertVehicleRefsExist(tx, dto);

        await tx.vehicleRepairDetail.create({
          data: {
            requestId,
            vehiclePlate: dto.vehiclePlate,
            issueCategoryId: dto.issueCategoryId,
            issueCategoryOther: dto.issueCategoryOther ?? null,
            symptom: dto.symptom,
            additionalDetails: dto.additionalDetails ?? null,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: MESSENGER
  // -----------------------------
  async createMessenger(dto: CreateMessengerRequestDto) {
    assertMessengerDeliveryRule(dto);

    return this.createRequestCore({
      type: RequestType.MESSENGER,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,

      detailCreator: async (tx, requestId) => {
        const sender = await tx.address.create({
          data: dto.sender,
        });

        const receiver = await tx.address.create({
          data: dto.receiver,
        });

        await tx.messengerBookingDetail.create({
          data: {
            requestId,
            pickupDatetime: new Date(dto.pickupDatetime),

            itemType: dto.itemType,
            itemDescription: dto.itemDescription,

            outsideBkkMetro: dto.outsideBkkMetro,

            deliveryService: dto.deliveryService ?? null,
            deliveryServiceOther: dto.deliveryServiceOther ?? null,

            senderAddressId: sender.id,
            receiverAddressId: receiver.id,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: DOCUMENT
  // -----------------------------
  async createDocument(dto: CreateDocumentRequestDto) {
    assertDocumentCreateRule(dto);

    const siteNameNormalized = normalizeSiteName(dto.siteNameRaw);

    return this.createRequestCore({
      type: RequestType.DOCUMENT,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      detailCreator: async (tx, requestId) => {
        // POSTAL: สร้าง address snapshot แล้วผูก deliveryAddressId
        let deliveryAddressId: string | null = null;

        if (dto.deliveryMethod === 'POSTAL') {
          const addr = await tx.address.create({
            data: {
              name: dto.deliveryAddress!.name,
              phone: dto.deliveryAddress!.phone,
              province: dto.deliveryAddress!.province,
              district: dto.deliveryAddress!.district,
              subdistrict: dto.deliveryAddress!.subdistrict,
              postalCode: dto.deliveryAddress!.postalCode,
              houseNo: dto.deliveryAddress!.houseNo,
              soi: dto.deliveryAddress!.soi ?? null,
              road: dto.deliveryAddress!.road ?? null,
              extra: dto.deliveryAddress!.extra ?? null,
            },
          });
          deliveryAddressId = addr.id;
        }

        await tx.documentRequestDetail.create({
          data: {
            requestId,
            siteNameRaw: dto.siteNameRaw,
            siteNameNormalized,

            documentDescription: dto.documentDescription,
            purpose: dto.purpose,
            neededDate: new Date(dto.neededDate),

            deliveryMethod: dto.deliveryMethod,
            note: dto.note ?? null,

            deliveryAddressId, // POSTAL เท่านั้น
            digitalFileAttachmentId: null, // HR จะอัปโหลดตอน DONE (admin action step ถัดไป)
            pickupNote: null, // HR จะใส่ตอน DONE (PICKUP)
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: MY REQUESTS
  // -----------------------------
  async getMyRequests(phone: string) {
    const items = await this.prisma.request.findMany({
      where: { phone },
      orderBy: { latestActivityAt: 'desc' },
      select: {
        id: true,
        requestNo: true,
        type: true,
        status: true,
        urgency: true,
        createdAt: true,
        latestActivityAt: true,
        closedAt: true,
        requestSla: { select: { slaStatus: true, slaDueAt: true } },
      },
      take: 100,
    });

    return { items };
  }

  // -----------------------------
  // Feature: REQUEST DETAIL
  // -----------------------------
  async getRequestDetail(id: string, phone?: string) {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        requestSla: true,
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
      },
    });

    if (!req) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (phone && req.phone !== phone) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your request',
      });
    }

    return req;
  }
}
