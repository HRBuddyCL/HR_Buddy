import { DeliveryMethod, Prisma, Urgency } from '@prisma/client';
import { CreateBuildingRequestDto } from '../dto/create-building-request.dto';
import { CreateDocumentRequestDto } from '../dto/create-document-request.dto';
import { CreateMessengerRequestDto } from '../dto/create-messenger-request.dto';
import { CreateVehicleRequestDto } from '../dto/create-vehicle-request.dto';

export type RequestDedupeCandidate = Prisma.RequestGetPayload<{
  include: {
    buildingRepairDetail: true;
    vehicleRepairDetail: true;
    messengerBookingDetail: {
      include: {
        senderAddress: true;
        receiverAddress: true;
      };
    };
    documentRequestDetail: {
      include: {
        deliveryAddress: true;
      };
    };
  };
}>;

type AddressInput = {
  name: string;
  phone: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  houseNo: string;
  soi?: string;
  road?: string;
  extra?: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function normalizeDateTime(value: string | Date) {
  return new Date(value).toISOString();
}

export function normalizeSiteName(raw: string) {
  return normalizeText(raw);
}

function matchesBaseFields(
  candidate: RequestDedupeCandidate,
  dto: {
    employeeName: string;
    departmentId: string;
    departmentOther?: string | null;
    phone: string;
    urgency: string;
  },
) {
  return (
    normalizeText(candidate.employeeName) === normalizeText(dto.employeeName) &&
    candidate.departmentId === dto.departmentId &&
    normalizeOptionalText(candidate.departmentOther) ===
      normalizeOptionalText(dto.departmentOther) &&
    normalizePhone(candidate.phone) === normalizePhone(dto.phone) &&
    candidate.urgency === dto.urgency
  );
}

function equalsAddress(
  input: AddressInput,
  existing?: {
    name: string;
    phone: string;
    province: string;
    district: string;
    subdistrict: string;
    postalCode: string;
    houseNo: string;
    soi: string | null;
    road: string | null;
    extra: string | null;
  } | null,
) {
  if (!existing) {
    return false;
  }

  return (
    normalizeText(existing.name) === normalizeText(input.name) &&
    normalizePhone(existing.phone) === normalizePhone(input.phone) &&
    normalizeText(existing.province) === normalizeText(input.province) &&
    normalizeText(existing.district) === normalizeText(input.district) &&
    normalizeText(existing.subdistrict) === normalizeText(input.subdistrict) &&
    normalizeText(existing.postalCode) === normalizeText(input.postalCode) &&
    normalizeText(existing.houseNo) === normalizeText(input.houseNo) &&
    normalizeOptionalText(existing.soi) === normalizeOptionalText(input.soi) &&
    normalizeOptionalText(existing.road) ===
      normalizeOptionalText(input.road) &&
    normalizeOptionalText(existing.extra) === normalizeOptionalText(input.extra)
  );
}

export function isDuplicateBuildingRequest(
  dto: CreateBuildingRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  return recentRequests.some((candidate) => {
    const detail = candidate.buildingRepairDetail;

    if (!detail || !matchesBaseFields(candidate, dto)) {
      return false;
    }

    return (
      detail.building === dto.building &&
      detail.floor === dto.floor &&
      detail.problemCategoryId === dto.problemCategoryId &&
      normalizeText(detail.locationDetail) ===
        normalizeText(dto.locationDetail) &&
      normalizeText(detail.description) === normalizeText(dto.description) &&
      normalizeOptionalText(detail.problemCategoryOther) ===
        normalizeOptionalText(dto.problemCategoryOther) &&
      normalizeOptionalText(detail.additionalDetails) ===
        normalizeOptionalText(dto.additionalDetails)
    );
  });
}

export function isDuplicateVehicleRequest(
  dto: CreateVehicleRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  const normalizedDto = {
    ...dto,
    urgency: Urgency.NORMAL,
  };

  return recentRequests.some((candidate) => {
    const detail = candidate.vehicleRepairDetail;

    if (!detail || !matchesBaseFields(candidate, normalizedDto)) {
      return false;
    }

    return (
      normalizeText(detail.vehiclePlate) ===
        normalizeText(normalizedDto.vehiclePlate) &&
      detail.issueCategoryId === normalizedDto.issueCategoryId &&
      normalizeText(detail.symptom) === normalizeText(normalizedDto.symptom) &&
      normalizeOptionalText(detail.issueCategoryOther) ===
        normalizeOptionalText(normalizedDto.issueCategoryOther) &&
      normalizeOptionalText(detail.additionalDetails) ===
        normalizeOptionalText(normalizedDto.additionalDetails)
    );
  });
}
export function isDuplicateMessengerRequest(
  dto: CreateMessengerRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  const normalizedDto = {
    ...dto,
    urgency: Urgency.NORMAL,
  };

  return recentRequests.some((candidate) => {
    const detail = candidate.messengerBookingDetail;

    if (!detail || !matchesBaseFields(candidate, normalizedDto)) {
      return false;
    }

    return (
      normalizeDateTime(detail.pickupDatetime) ===
        normalizeDateTime(normalizedDto.pickupDatetime) &&
      detail.itemType === normalizedDto.itemType &&
      normalizeText(detail.itemDescription) ===
        normalizeText(normalizedDto.itemDescription) &&
      detail.outsideBkkMetro === normalizedDto.outsideBkkMetro &&
      (detail.deliveryService ?? null) ===
        (normalizedDto.deliveryService ?? null) &&
      normalizeOptionalText(detail.deliveryServiceOther) ===
        normalizeOptionalText(normalizedDto.deliveryServiceOther) &&
      equalsAddress(normalizedDto.receiver, detail.receiverAddress)
    );
  });
}
export function isDuplicateDocumentRequest(
  dto: CreateDocumentRequestDto,
  recentRequests: RequestDedupeCandidate[],
) {
  const normalizedDto = {
    ...dto,
    urgency:
      dto.deliveryMethod === DeliveryMethod.POSTAL
        ? Urgency.NORMAL
        : dto.urgency,
  };

  return recentRequests.some((candidate) => {
    const detail = candidate.documentRequestDetail;

    if (!detail || !matchesBaseFields(candidate, normalizedDto)) {
      return false;
    }

    const sameCore =
      normalizeSiteName(detail.siteNameNormalized) ===
        normalizeSiteName(normalizedDto.siteNameRaw) &&
      normalizeText(detail.documentDescription) ===
        normalizeText(normalizedDto.documentDescription) &&
      normalizeText(detail.purpose) === normalizeText(normalizedDto.purpose) &&
      normalizeDateTime(detail.neededDate) ===
        normalizeDateTime(normalizedDto.neededDate) &&
      detail.deliveryMethod === normalizedDto.deliveryMethod &&
      normalizeOptionalText(detail.note) ===
        normalizeOptionalText(normalizedDto.note);

    if (!sameCore) {
      return false;
    }

    if (normalizedDto.deliveryMethod !== DeliveryMethod.POSTAL) {
      return !detail.deliveryAddress;
    }

    if (!normalizedDto.deliveryAddress) {
      return false;
    }

    return equalsAddress(normalizedDto.deliveryAddress, detail.deliveryAddress);
  });
}
