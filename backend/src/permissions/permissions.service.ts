import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface JobPermission {
  jobId: number;
  appName: string;
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
}

export interface UserPermissions {
  isAdmin: boolean;
  permissions: JobPermission[];
}

/**
 * Permissions Service
 * Handles permission calculation and authorization logic
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions for a user (merged from all roles)
   * Uses OR logic: if any role grants permission, user has that permission
   * @param userId - User ID
   * @returns UserPermissions object with all job permissions
   */
  async getUserPermissions(userId: number): Promise<UserPermissions> {
    // Get user with admin status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user) {
      return { isAdmin: false, permissions: [] };
    }

    // Admin has all permissions
    if (user.isAdmin) {
      return { isAdmin: true, permissions: [] };
    }

    // Get all role permissions for this user
    const rolePermissions = await this.prisma.roleJobPermission.findMany({
      where: {
        role: {
          users: {
            some: {
              userId: userId,
            },
          },
        },
      },
      select: {
        jobId: true,
        appName: true,
        canView: true,
        canExecute: true,
        canEdit: true,
      },
    });

    // Merge permissions by jobId using OR logic
    const permissionMap = new Map<number, JobPermission>();

    for (const perm of rolePermissions) {
      const existing = permissionMap.get(perm.jobId);

      if (existing) {
        // OR merge: any role grants permission = user has permission
        permissionMap.set(perm.jobId, {
          jobId: perm.jobId,
          appName: perm.appName,
          canView: existing.canView || perm.canView,
          canExecute: existing.canExecute || perm.canExecute,
          canEdit: existing.canEdit || perm.canEdit,
        });
      } else {
        permissionMap.set(perm.jobId, {
          jobId: perm.jobId,
          appName: perm.appName,
          canView: perm.canView,
          canExecute: perm.canExecute,
          canEdit: perm.canEdit,
        });
      }
    }

    return {
      isAdmin: false,
      permissions: Array.from(permissionMap.values()),
    };
  }

  /**
   * Check if user has specific permission for a job
   * @param userId - User ID
   * @param jobId - Job ID
   * @param permission - Permission type ('view' | 'execute' | 'edit')
   * @returns true if user has permission, false otherwise
   */
  async hasJobPermission(
    userId: number,
    jobId: number,
    permission: 'view' | 'execute' | 'edit',
  ): Promise<boolean> {
    // Get user with admin status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Admin has all permissions
    if (user.isAdmin) {
      return true;
    }

    // Check if any of user's roles grant this permission
    const permissionCount = await this.prisma.roleJobPermission.count({
      where: {
        jobId: jobId,
        role: {
          users: {
            some: {
              userId: userId,
            },
          },
        },
        // Check the specific permission based on type
        ...(permission === 'view' && { canView: true }),
        ...(permission === 'execute' && { canExecute: true }),
        ...(permission === 'edit' && { canEdit: true }),
      },
    });

    return permissionCount > 0;
  }

  /**
   * Check if user is admin
   * @param userId - User ID
   * @returns true if user is admin, false otherwise
   */
  async isAdmin(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isActive: true },
    });

    return user?.isActive && user?.isAdmin || false;
  }

  /**
   * Get all jobs that user can access (has at least view permission)
   * @param userId - User ID
   * @returns Array of job IDs
   */
  async getUserAccessibleJobs(userId: number): Promise<number[]> {
    const userPermissions = await this.getUserPermissions(userId);

    // Admin can access all jobs (return empty array to signal "all")
    if (userPermissions.isAdmin) {
      return [];
    }

    // Return job IDs where user has at least view permission
    return userPermissions.permissions
      .filter((perm) => perm.canView)
      .map((perm) => perm.jobId);
  }

  /**
   * Batch check permissions for multiple jobs
   * Optimized for listing jobs with permission indicators
   * @param userId - User ID
   * @param jobIds - Array of job IDs
   * @returns Map of jobId to permissions
   */
  async batchCheckPermissions(
    userId: number,
    jobIds: number[],
  ): Promise<Map<number, { canView: boolean; canExecute: boolean; canEdit: boolean }>> {
    const userPermissions = await this.getUserPermissions(userId);

    const result = new Map<number, { canView: boolean; canExecute: boolean; canEdit: boolean }>();

    // Admin has all permissions for all jobs
    if (userPermissions.isAdmin) {
      for (const jobId of jobIds) {
        result.set(jobId, { canView: true, canExecute: true, canEdit: true });
      }
      return result;
    }

    // Build permission map for requested jobs
    for (const jobId of jobIds) {
      const perm = userPermissions.permissions.find((p) => p.jobId === jobId);
      if (perm) {
        result.set(jobId, {
          canView: perm.canView,
          canExecute: perm.canExecute,
          canEdit: perm.canEdit,
        });
      } else {
        result.set(jobId, { canView: false, canExecute: false, canEdit: false });
      }
    }

    return result;
  }
}
