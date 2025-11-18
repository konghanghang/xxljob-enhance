import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

export interface SetJobPermissionInput {
  jobId: number;
  appName: string;
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
}

export interface RoleResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithPermissions extends RoleResponse {
  permissions: {
    id: number;
    jobId: number;
    appName: string;
    canView: boolean;
    canExecute: boolean;
    canEdit: boolean;
  }[];
}

/**
 * Roles Service
 * Handles role CRUD operations and job permission management
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new role
   * @param data - Role creation data
   * @returns Created role
   */
  async create(data: CreateRoleInput): Promise<RoleResponse> {
    // Check if role name already exists
    const existingRole = await this.prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new ConflictException(`Role '${data.name}' already exists`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return role;
  }

  /**
   * Find all roles
   * @param includePermissions - Whether to include permissions (default: false)
   * @returns Array of roles
   */
  async findAll(includePermissions = false): Promise<RoleResponse[] | RoleWithPermissions[]> {
    if (includePermissions) {
      const roles = await this.prisma.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          permissions: {
            select: {
              id: true,
              jobId: true,
              appName: true,
              canView: true,
              canExecute: true,
              canEdit: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return roles;
    }

    const roles = await this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles;
  }

  /**
   * Find a role by ID
   * @param id - Role ID
   * @param includePermissions - Whether to include permissions
   * @returns Role
   */
  async findOne(id: number, includePermissions = false): Promise<RoleResponse | RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        ...(includePermissions && {
          permissions: {
            select: {
              id: true,
              jobId: true,
              appName: true,
              canView: true,
              canExecute: true,
              canEdit: true,
            },
          },
        }),
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  /**
   * Update a role
   * @param id - Role ID
   * @param data - Update data
   * @returns Updated role
   */
  async update(id: number, data: UpdateRoleInput): Promise<RoleResponse> {
    // Check if role exists
    await this.findOne(id);

    // Check name uniqueness if updating name
    if (data.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
      });

      if (existingRole) {
        throw new ConflictException(`Role name '${data.name}' already exists`);
      }
    }

    const role = await this.prisma.role.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return role;
  }

  /**
   * Delete a role
   * This will cascade delete all user-role and role-permission relationships
   * @param id - Role ID
   */
  async remove(id: number): Promise<void> {
    // Check if role exists
    await this.findOne(id);

    // Delete role (cascades to UserRole and RoleJobPermission)
    await this.prisma.role.delete({
      where: { id },
    });
  }

  /**
   * Set job permission for a role
   * Creates or updates permission for a specific job
   * @param roleId - Role ID
   * @param data - Permission data
   */
  async setJobPermission(roleId: number, data: SetJobPermissionInput): Promise<void> {
    // Check if role exists
    await this.findOne(roleId);

    // Upsert permission (create if not exists, update if exists)
    await this.prisma.roleJobPermission.upsert({
      where: {
        roleId_jobId: {
          roleId,
          jobId: data.jobId,
        },
      },
      create: {
        roleId,
        jobId: data.jobId,
        appName: data.appName,
        canView: data.canView,
        canExecute: data.canExecute,
        canEdit: data.canEdit,
      },
      update: {
        appName: data.appName,
        canView: data.canView,
        canExecute: data.canExecute,
        canEdit: data.canEdit,
      },
    });
  }

  /**
   * Get all job permissions for a role
   * @param roleId - Role ID
   * @returns Array of job permissions
   */
  async getRolePermissions(roleId: number) {
    // Check if role exists
    await this.findOne(roleId);

    const permissions = await this.prisma.roleJobPermission.findMany({
      where: { roleId },
      select: {
        id: true,
        jobId: true,
        appName: true,
        canView: true,
        canExecute: true,
        canEdit: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { jobId: 'asc' },
    });

    return permissions;
  }

  /**
   * Remove job permission from a role
   * @param roleId - Role ID
   * @param jobId - Job ID
   */
  async removeJobPermission(roleId: number, jobId: number): Promise<void> {
    // Check if role exists
    await this.findOne(roleId);

    const result = await this.prisma.roleJobPermission.deleteMany({
      where: {
        roleId,
        jobId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Permission for job ${jobId} not found in role ${roleId}`);
    }
  }

  /**
   * Batch set job permissions for a role
   * Replaces all existing permissions with the new set
   * @param roleId - Role ID
   * @param permissions - Array of permission data
   */
  async batchSetPermissions(roleId: number, permissions: SetJobPermissionInput[]): Promise<void> {
    // Check if role exists
    await this.findOne(roleId);

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Delete all existing permissions for this role
      await tx.roleJobPermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      if (permissions.length > 0) {
        await tx.roleJobPermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            jobId: p.jobId,
            appName: p.appName,
            canView: p.canView,
            canExecute: p.canExecute,
            canEdit: p.canEdit,
          })),
        });
      }
    });
  }

  /**
   * Get users assigned to a role
   * @param roleId - Role ID
   * @returns Array of users with this role
   */
  async getRoleUsers(roleId: number) {
    // Check if role exists
    await this.findOne(roleId);

    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    return userRoles.map((ur) => ({
      user: ur.user,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assignedBy,
    }));
  }
}
