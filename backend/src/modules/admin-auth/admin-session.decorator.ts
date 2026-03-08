import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminSessionPrincipal } from './admin-session.types';

type AdminRequestContext = {
  adminSession?: AdminSessionPrincipal;
};

export const AdminSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminSessionPrincipal => {
    const request = ctx.switchToHttp().getRequest<AdminRequestContext>();

    return request.adminSession as AdminSessionPrincipal;
  },
);
