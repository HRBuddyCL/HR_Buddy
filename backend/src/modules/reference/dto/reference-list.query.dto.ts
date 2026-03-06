import { RequestType, Urgency } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { parseOptionalBooleanQuery } from './query-transformers';

export class ReferenceListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class SlaPoliciesQueryDto extends ReferenceListQueryDto {
  @IsOptional()
  @IsEnum(RequestType)
  type?: RequestType;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;
}