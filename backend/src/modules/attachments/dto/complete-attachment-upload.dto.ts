import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteAttachmentUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  uploadToken!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  operatorId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  uploadSessionToken?: string;
}
