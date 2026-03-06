import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminSession } from './admin-session.decorator';
import { AdminSessionGuard } from './admin-session.guard';
import type { AdminSessionPrincipal } from './admin-session.types';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto.username, dto.password);
  }

  @UseGuards(AdminSessionGuard)
  @Get('me')
  me(@AdminSession() session: AdminSessionPrincipal) {
    return session;
  }
}
