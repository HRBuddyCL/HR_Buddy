import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { AdminRequestFilterQueryDto } from './admin-request-filter.query.dto';

export class AdminRequestsQueryDto extends AdminRequestFilterQueryDto {
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
