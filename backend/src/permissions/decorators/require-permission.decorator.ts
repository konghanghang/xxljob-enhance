import { SetMetadata } from '@nestjs/common';

export type PermissionType = 'view' | 'execute' | 'edit';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator to require specific job permission
 * Must be used with JobPermissionGuard
 * Job ID should be extracted from request params (e.g., :jobId)
 *
 * @param permission - Permission type required ('view' | 'execute' | 'edit')
 *
 * @example
 * @RequirePermission('execute')
 * @Post('jobs/:jobId/trigger')
 * async triggerJob(@Param('jobId') jobId: string) { ... }
 */
export const RequirePermission = (permission: PermissionType) =>
  SetMetadata(PERMISSION_KEY, permission);
