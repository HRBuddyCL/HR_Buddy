import { IsOptional, IsString, Matches } from 'class-validator';

export class RequestDetailQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{9,15}$/)
  phone?: string; // ถ้าส่งมา จะ enforce ว่างานต้องเป็นของเบอร์นี้
}
