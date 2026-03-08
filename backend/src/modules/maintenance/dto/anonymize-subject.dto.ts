import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class AnonymizeSubjectDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsPhoneNumber('TH')
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
