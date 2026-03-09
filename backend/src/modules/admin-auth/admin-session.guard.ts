import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import type { AdminSessionPrincipal } from './admin-session.types';

type AdminRequestContext = {
  headers?: {
    authorization?: string;
    'x-admin-session-token'?: string | string[];
  };
  adminSession?: AdminSessionPrincipal;
};

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequestContext>();

    const token = this.extractToken(
      request.headers?.authorization,
      request.headers?.['x-admin-session-token'],
    );

    if (!token) {
      throw new UnauthorizedException({
        code: 'ADMIN_SESSION_TOKEN_REQUIRED',
        message: 'Missing admin session token',
      });
    }

    const session = await this.adminAuthService.verifySessionToken(token);

    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_OR_EXPIRED_ADMIN_SESSION',
        message: 'Invalid or expired admin session token',
      });
    }

    request.adminSession = session;

    return true;
  }

  private extractToken(
    authorization?: string,
    headerToken?: string | string[],
  ): string | null {
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      return token.length > 0 ? token : null;
    }

    if (typeof headerToken === 'string') {
      const token = headerToken.trim();
      return token.length > 0 ? token : null;
    }

    return null;
  }
}
