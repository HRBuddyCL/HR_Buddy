import { RequestStatus, RequestType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const SORTABLE_FIELDS = ['latestActivityAt', 'createdAt'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

type MyRequestSortField = (typeof SORTABLE_FIELDS)[number];
type MyRequestSortOrder = (typeof SORT_ORDERS)[number];

export class MyRequestsQueryDto {
  @IsOptional()
  @IsEnum(RequestType)
  type?: RequestType;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsDateString()
  createdDateFrom?: string;

  @IsOptional()
  @IsDateString()
  createdDateTo?: string;

  @IsOptional()
  @IsDateString()
  closedDateFrom?: string;

  @IsOptional()
  @IsDateString()
  closedDateTo?: string;

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: MyRequestSortField;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: MyRequestSortOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
