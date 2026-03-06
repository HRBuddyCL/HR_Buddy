import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminSessionPrincipal } from './admin-session.types';

export const AdminSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminSessionPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.adminSession;
  },
);
