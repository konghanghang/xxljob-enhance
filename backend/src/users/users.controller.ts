import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, AssignRolesDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../permissions/guards/admin.guard';
import { RequireAdmin } from '../permissions/decorators/require-admin.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Users Controller
 * All routes require admin privileges
 */
@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users
   * Create a new user (admin only)
   */
  @RequireAdmin()
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  /**
   * GET /users
   * Get all users (admin only)
   * @query includeInactive - Include inactive users (default: false)
   */
  @RequireAdmin()
  @Get()
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<UserResponseDto[]> {
    const include = includeInactive === 'true';
    return this.usersService.findAll(include);
  }

  /**
   * GET /users/:id
   * Get a user by ID (admin only)
   */
  @RequireAdmin()
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  /**
   * PATCH /users/:id
   * Update a user (admin only)
   */
  @RequireAdmin()
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * DELETE /users/:id
   * Soft delete a user (admin only)
   */
  @RequireAdmin()
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.usersService.remove(id);
    return { message: `User ${id} has been deactivated` };
  }

  /**
   * DELETE /users/:id/hard
   * Permanently delete a user (admin only)
   */
  @RequireAdmin()
  @Delete(':id/hard')
  async hardDelete(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.usersService.hardDelete(id);
    return { message: `User ${id} has been permanently deleted` };
  }

  /**
   * POST /users/:id/roles
   * Assign roles to a user (admin only)
   */
  @RequireAdmin()
  @Post(':id/roles')
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRolesDto: AssignRolesDto,
    @CurrentUser() currentUser: any,
  ): Promise<{ message: string }> {
    await this.usersService.assignRoles(id, assignRolesDto.roleIds, currentUser.id);
    return { message: `Roles assigned to user ${id}` };
  }

  /**
   * GET /users/:id/roles
   * Get roles assigned to a user (admin only)
   */
  @RequireAdmin()
  @Get(':id/roles')
  async getUserRoles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserRoles(id);
  }

  /**
   * POST /users/:userId/roles/:roleId
   * Add a single role to user (admin only)
   */
  @RequireAdmin()
  @Post(':userId/roles/:roleId')
  async addRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() currentUser: any,
  ): Promise<{ message: string }> {
    await this.usersService.addRole(userId, roleId, currentUser.id);
    return { message: `Role ${roleId} added to user ${userId}` };
  }

  /**
   * DELETE /users/:userId/roles/:roleId
   * Remove a single role from user (admin only)
   */
  @RequireAdmin()
  @Delete(':userId/roles/:roleId')
  async removeRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<{ message: string }> {
    await this.usersService.removeRole(userId, roleId);
    return { message: `Role ${roleId} removed from user ${userId}` };
  }
}
