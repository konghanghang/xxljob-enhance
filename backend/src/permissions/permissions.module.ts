import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JobPermissionGuard } from './guards/job-permission.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  providers: [PermissionsService, JobPermissionGuard, AdminGuard],
  exports: [PermissionsService, JobPermissionGuard, AdminGuard],
})
export class PermissionsModule {}
