import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  isAdmin?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  isActive?: boolean;
  isAdmin?: boolean;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Users Service
 * Handles user CRUD operations and role management
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user
   * @param data - User creation data
   * @returns Created user without password
   */
  async create(data: CreateUserInput): Promise<UserResponse> {
    // Check if username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new ConflictException(`Username '${data.username}' already exists`);
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new ConflictException(`Email '${data.email}' already exists`);
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        email: data.email,
        isAdmin: data.isAdmin || false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Find all users
   * @param includeInactive - Whether to include inactive users (default: false)
   * @returns Array of users without passwords
   */
  async findAll(includeInactive = false): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  /**
   * Find a user by ID
   * @param id - User ID
   * @returns User without password
   */
  async findOne(id: number): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Update a user
   * @param id - User ID
   * @param data - Update data
   * @returns Updated user without password
   */
  async update(id: number, data: UpdateUserInput): Promise<UserResponse> {
    // Check if user exists
    await this.findOne(id);

    // Check email uniqueness if updating email
    if (data.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id },
        },
      });

      if (existingEmail) {
        throw new ConflictException(`Email '${data.email}' already exists`);
      }
    }

    // Hash password if updating
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Update user
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Delete a user (soft delete by setting isActive to false)
   * @param id - User ID
   */
  async remove(id: number): Promise<void> {
    // Check if user exists
    await this.findOne(id);

    // Soft delete by setting isActive to false
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete a user (permanently remove from database)
   * Use with caution - this will cascade delete user roles
   * @param id - User ID
   */
  async hardDelete(id: number): Promise<void> {
    // Check if user exists
    await this.findOne(id);

    // Hard delete
    await this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Assign roles to a user
   * @param userId - User ID
   * @param roleIds - Array of role IDs to assign
   * @param assignedBy - ID of user performing the assignment
   */
  async assignRoles(userId: number, roleIds: number[], assignedBy?: number): Promise<void> {
    // Check if user exists
    await this.findOne(userId);

    // Check if all roles exist
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      const foundIds = roles.map((r) => r.id);
      const missingIds = roleIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Roles not found: ${missingIds.join(', ')}`);
    }

    // Remove existing roles
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // Assign new roles
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
          assignedBy,
        })),
      });
    }
  }

  /**
   * Get roles assigned to a user
   * @param userId - User ID
   * @returns Array of roles with assignment info
   */
  async getUserRoles(userId: number) {
    // Check if user exists
    await this.findOne(userId);

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return userRoles.map((ur) => ({
      role: ur.role,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assignedBy,
    }));
  }

  /**
   * Add a single role to user (without removing existing roles)
   * @param userId - User ID
   * @param roleId - Role ID to add
   * @param assignedBy - ID of user performing the assignment
   */
  async addRole(userId: number, roleId: number, assignedBy?: number): Promise<void> {
    // Check if user exists
    await this.findOne(userId);

    // Check if role exists
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if already assigned
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`User already has role '${role.name}'`);
    }

    // Add role
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedBy,
      },
    });
  }

  /**
   * Remove a single role from user
   * @param userId - User ID
   * @param roleId - Role ID to remove
   */
  async removeRole(userId: number, roleId: number): Promise<void> {
    // Check if user exists
    await this.findOne(userId);

    // Delete the user role
    const result = await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(`User does not have role with ID ${roleId}`);
    }
  }
}
