import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AdminRequestFilterQueryDto } from './admin-request-filter.query.dto';

export class AdminRequestsExportQueryDto extends AdminRequestFilterQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
