import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MyRequestsQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{9,15}$/)
  phone!: string;
}
