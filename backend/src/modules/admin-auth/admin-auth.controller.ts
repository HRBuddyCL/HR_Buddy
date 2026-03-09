import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RateLimitPolicy } from '../../common/security/rate-limit.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminSession } from './admin-session.decorator';
import { AdminSessionGuard } from './admin-session.guard';
import type { AdminSessionPrincipal } from './admin-session.types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @RateLimitPolicy('adminLogin')
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto.username, dto.password);
  }

  @UseGuards(AdminSessionGuard)
  @Post('logout')
  logout(
    @Headers('authorization') authorization?: string,
    @Headers('x-admin-session-token') headerToken?: string,
  ) {
    return this.adminAuthService.logout(
      this.extractToken(authorization, headerToken),
    );
  }

  @UseGuards(AdminSessionGuard)
  @Get('me')
  me(@AdminSession() session: AdminSessionPrincipal) {
    return session;
  }

  private extractToken(authorization?: string, headerToken?: string) {
    const bearer = this.extractBearerToken(authorization);

    if (bearer) {
      return bearer;
    }

    const fromHeader = headerToken?.trim();

    if (fromHeader) {
      return fromHeader;
    }

    throw new BadRequestException({
      code: 'ADMIN_SESSION_TOKEN_REQUIRED',
      message:
        'Admin session token is required via Authorization Bearer token or x-admin-session-token header',
    });
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    if (!authorization.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }
}
