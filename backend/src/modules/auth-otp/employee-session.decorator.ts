import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { EmployeeSessionPrincipal } from './employee-session.types';

type EmployeeRequestContext = {
  employeeSession?: EmployeeSessionPrincipal;
};

export const EmployeeSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EmployeeSessionPrincipal => {
    const request = ctx.switchToHttp().getRequest<EmployeeRequestContext>();

    return request.employeeSession as EmployeeSessionPrincipal;
  },
);
