import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { PERMISSION_KEY, PermissionType } from '../decorators/require-permission.decorator';

/**
 * Job Permission Guard
 * Verifies user has required permission for a specific job
 * Expects job ID in route params as 'jobId'
 * Requires @RequirePermission() decorator
 *
 * @example
 * @UseGuards(JwtAuthGuard, JobPermissionGuard)
 * @RequirePermission('execute')
 * @Post('jobs/:jobId/trigger')
 * async triggerJob(@Param('jobId') jobId: string) { ... }
 */
@Injectable()
export class JobPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from decorator
    const requiredPermission = this.reflector.getAllAndOverride<PermissionType>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permission required, allow access
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be populated by JwtAuthGuard
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract jobId from route params
    const jobId = request.params.jobId;

    if (!jobId) {
      throw new ForbiddenException('Job ID not found in request params');
    }

    // Parse jobId to number
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      throw new ForbiddenException('Invalid job ID format');
    }

    // Check permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      user.id,
      jobIdNum,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have '${requiredPermission}' permission for this job`,
      );
    }

    return true;
  }
}
