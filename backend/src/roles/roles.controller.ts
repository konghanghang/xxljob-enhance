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
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  SetJobPermissionDto,
  BatchSetPermissionsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../permissions/guards/admin.guard';
import { RequireAdmin } from '../permissions/decorators/require-admin.decorator';

/**
 * Roles Controller
 * All routes require admin privileges
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * POST /roles
   * Create a new role (admin only)
   */
  @RequireAdmin()
  @Post()
  async create(@Body() createRoleDto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(createRoleDto);
  }

  /**
   * GET /roles
   * Get all roles (admin only)
   * @query includePermissions - Include job permissions (default: false)
   */
  @RequireAdmin()
  @Get()
  async findAll(@Query('includePermissions') includePermissions?: string) {
    const include = includePermissions === 'true';
    return this.rolesService.findAll(include);
  }

  /**
   * GET /roles/:id
   * Get a role by ID (admin only)
   * @query includePermissions - Include job permissions (default: false)
   */
  @RequireAdmin()
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includePermissions') includePermissions?: string,
  ) {
    const include = includePermissions === 'true';
    return this.rolesService.findOne(id, include);
  }

  /**
   * PATCH /roles/:id
   * Update a role (admin only)
   */
  @RequireAdmin()
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(id, updateRoleDto);
  }

  /**
   * DELETE /roles/:id
   * Delete a role (admin only)
   */
  @RequireAdmin()
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.rolesService.remove(id);
    return { message: `Role ${id} has been deleted` };
  }

  /**
   * POST /roles/:id/permissions
   * Set job permission for a role (admin only)
   */
  @RequireAdmin()
  @Post(':id/permissions')
  async setJobPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() setPermissionDto: SetJobPermissionDto,
  ): Promise<{ message: string }> {
    await this.rolesService.setJobPermission(id, setPermissionDto);
    return { message: `Permission for job ${setPermissionDto.jobId} set successfully` };
  }

  /**
   * GET /roles/:id/permissions
   * Get all job permissions for a role (admin only)
   */
  @RequireAdmin()
  @Get(':id/permissions')
  async getRolePermissions(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getRolePermissions(id);
  }

  /**
   * DELETE /roles/:roleId/permissions/:jobId
   * Remove job permission from a role (admin only)
   */
  @RequireAdmin()
  @Delete(':roleId/permissions/:jobId')
  async removeJobPermission(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
  ): Promise<{ message: string }> {
    await this.rolesService.removeJobPermission(roleId, jobId);
    return { message: `Permission for job ${jobId} removed from role ${roleId}` };
  }

  /**
   * POST /roles/:id/permissions/batch
   * Batch set job permissions for a role (admin only)
   * Replaces all existing permissions
   */
  @RequireAdmin()
  @Post(':id/permissions/batch')
  async batchSetPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() batchDto: BatchSetPermissionsDto,
  ): Promise<{ message: string }> {
    await this.rolesService.batchSetPermissions(id, batchDto.permissions);
    return {
      message: `Batch set ${batchDto.permissions.length} permissions for role ${id}`,
    };
  }

  /**
   * GET /roles/:id/users
   * Get users assigned to a role (admin only)
   */
  @RequireAdmin()
  @Get(':id/users')
  async getRoleUsers(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getRoleUsers(id);
  }
}
