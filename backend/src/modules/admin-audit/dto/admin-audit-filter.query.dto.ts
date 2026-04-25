import {
  ActivityAction,
  ActorRole,
  RequestStatus,
  RequestType,
  Urgency,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminAuditFilterQueryDto {
  @IsOptional()
  @IsEnum(RequestType)
  requestType?: RequestType;

  @IsOptional()
  @IsEnum(RequestStatus)
  requestStatus?: RequestStatus;

  @IsOptional()
  @IsEnum(Urgency)
  requestUrgency?: Urgency;

  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @IsOptional()
  @IsEnum(ActorRole)
  actorRole?: ActorRole;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestNo?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
