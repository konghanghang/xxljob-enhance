import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { ADMIN_KEY } from '../decorators/require-admin.decorator';

/**
 * Admin Guard
 * Verifies user has admin privileges
 * Requires @RequireAdmin() decorator
 *
 * @example
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * @RequireAdmin()
 * @Post('users')
 * async createUser(@Body() dto: CreateUserDto) { ... }
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if admin is required
    const requireAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If admin not required, allow access
    if (!requireAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be populated by JwtAuthGuard
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin
    const isAdmin = await this.permissionsService.isAdmin(user.id);

    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
