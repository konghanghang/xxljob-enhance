import { SetMetadata } from '@nestjs/common';

export const ADMIN_KEY = 'require_admin';

/**
 * Decorator to require admin access
 * Must be used with AdminGuard
 *
 * @example
 * @RequireAdmin()
 * @Post('users')
 * async createUser(@Body() dto: CreateUserDto) { ... }
 */
export const RequireAdmin = () => SetMetadata(ADMIN_KEY, true);
