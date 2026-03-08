import { Body, Controller, Post } from '@nestjs/common';
import { RateLimitPolicy } from '../../common/security/rate-limit.decorator';
import { AuthOtpService } from './auth-otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth-otp')
export class AuthOtpController {
  constructor(private readonly authOtpService: AuthOtpService) {}

  @RateLimitPolicy('otpSend')
  @Post('send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authOtpService.sendOtp(dto);
  }

  @RateLimitPolicy('otpVerify')
  @Post('verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authOtpService.verifyOtp(dto);
  }
}
