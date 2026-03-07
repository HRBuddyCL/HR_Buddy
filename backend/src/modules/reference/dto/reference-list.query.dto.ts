import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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
