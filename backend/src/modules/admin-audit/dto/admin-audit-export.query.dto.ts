import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AdminAuditFilterQueryDto } from './admin-audit-filter.query.dto';

export class AdminAuditExportQueryDto extends AdminAuditFilterQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}
