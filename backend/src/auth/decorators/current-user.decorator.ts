import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User decorator
 * Extracts user object from request (populated by JwtStrategy)
 * Usage: getCurrentUser(@CurrentUser() user: User)
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
