import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { AdminAuditFilterQueryDto } from './admin-audit-filter.query.dto';

export class AdminAuditListQueryDto extends AdminAuditFilterQueryDto {
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
