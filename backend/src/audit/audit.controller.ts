import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  Param,
  Delete,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditQueryDto, AuditStatsQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../permissions/guards/admin.guard';
import { RequireAdmin } from '../permissions/decorators/require-admin.decorator';

/**
 * Audit Controller
 * All routes require admin privileges
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit
   * Get audit logs with filters (admin only)
   */
  @RequireAdmin()
  @Get()
  async getAuditLogs(@Query() query: AuditQueryDto) {
    return this.auditService.findAll({
      userId: query.userId,
      jobId: query.jobId,
      action: query.action,
      result: query.result,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      skip: query.skip,
      take: query.take,
    });
  }

  /**
   * GET /audit/stats
   * Get audit log statistics (admin only)
   */
  @RequireAdmin()
  @Get('stats')
  async getStats(@Query() query: AuditStatsQueryDto) {
    return this.auditService.getStats(
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  /**
   * GET /audit/users/:userId
   * Get recent audit logs for a specific user (admin only)
   */
  @RequireAdmin()
  @Get('users/:userId')
  async getUserLogs(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.auditService.getUserRecentLogs(userId, limit || 20);
  }

  /**
   * GET /audit/jobs/:jobId
   * Get recent audit logs for a specific job (admin only)
   */
  @RequireAdmin()
  @Get('jobs/:jobId')
  async getJobLogs(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query('limit', ParseIntPipe) limit?: number,
  ) {
    return this.auditService.getJobRecentLogs(jobId, limit || 20);
  }

  /**
   * DELETE /audit/cleanup
   * Clean old audit logs (admin only)
   * @query days - Number of days to keep (default: 180)
   */
  @RequireAdmin()
  @Delete('cleanup')
  async cleanupOldLogs(@Query('days', ParseIntPipe) days?: number) {
    const deletedCount = await this.auditService.cleanOldLogs(days || 180);
    return {
      message: `Cleaned up ${deletedCount} old audit logs`,
      deletedCount,
    };
  }
}
