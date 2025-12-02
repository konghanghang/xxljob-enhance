import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobQueryDto, ExecuteJobDto, UpdateJobDto, LogQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JobPermissionGuard } from '../permissions/guards/job-permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Jobs Controller
 * Provides permission-protected task operations
 */
@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * GET /jobs
   * Get job list filtered by user permissions
   */
  @Get()
  async getJobs(@CurrentUser() user: any, @Query() query: JobQueryDto) {
    return this.jobsService.getJobList(
      user.id,
      query.jobGroup,
      query.start || 0,
      query.length || 10,
    );
  }

  /**
   * GET /jobs/groups
   * Get accessible job groups (executors)
   */
  @Get('groups')
  async getJobGroups(@CurrentUser() user: any) {
    return this.jobsService.getAccessibleJobGroups(user.id);
  }

  /**
   * GET /jobs/permissions
   * Get user's job permissions
   */
  @Get('permissions')
  async getJobPermissions(@CurrentUser() user: any, @Query('jobIds') jobIds?: string) {
    const jobIdArray = jobIds ? jobIds.split(',').map(Number) : undefined;
    return this.jobsService.getUserJobPermissions(user.id, jobIdArray);
  }

  /**
   * GET /jobs/:jobId
   * Get job detail (requires view permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('view')
  @Get(':jobId')
  async getJob(
    @CurrentUser() user: any,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query('jobGroup', ParseIntPipe) jobGroup: number,
  ) {
    return this.jobsService.getJobDetail(user.id, jobId, jobGroup);
  }

  /**
   * POST /jobs/:jobId/trigger
   * Trigger job execution (requires execute permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('execute')
  @Post(':jobId/trigger')
  async triggerJob(
    @CurrentUser() user: any,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body() executeDto: ExecuteJobDto,
  ) {
    await this.jobsService.triggerJob(
      user.id,
      jobId,
      executeDto.executorParam,
      executeDto.addressList,
    );
    return { message: `Job ${jobId} triggered successfully` };
  }

  /**
   * POST /jobs/:jobId/start
   * Start job scheduling (requires edit permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('edit')
  @Post(':jobId/start')
  async startJob(@CurrentUser() user: any, @Param('jobId', ParseIntPipe) jobId: number) {
    await this.jobsService.startJob(user.id, jobId);
    return { message: `Job ${jobId} started successfully` };
  }

  /**
   * POST /jobs/:jobId/stop
   * Stop job scheduling (requires edit permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('edit')
  @Post(':jobId/stop')
  async stopJob(@CurrentUser() user: any, @Param('jobId', ParseIntPipe) jobId: number) {
    await this.jobsService.stopJob(user.id, jobId);
    return { message: `Job ${jobId} stopped successfully` };
  }

  /**
   * PATCH /jobs/:jobId
   * Update job configuration (requires edit permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('edit')
  @Patch(':jobId')
  async updateJob(
    @CurrentUser() user: any,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body() updateDto: UpdateJobDto,
  ) {
    await this.jobsService.updateJob(user.id, jobId, updateDto);
    return { message: `Job ${jobId} updated successfully` };
  }

  /**
   * GET /jobs/:jobId/logs
   * Get job execution logs (requires view permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('view')
  @Get(':jobId/logs')
  async getJobLogs(
    @CurrentUser() user: any,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query() query: LogQueryDto,
  ) {
    return this.jobsService.getJobLogs(
      user.id,
      jobId,
      query.start || 0,
      query.length || 10,
    );
  }

  /**
   * GET /jobs/:jobId/logs/:logId
   * Get log detail (requires view permission)
   */
  @UseGuards(JobPermissionGuard)
  @RequirePermission('view')
  @Get(':jobId/logs/:logId')
  async getLogDetail(
    @CurrentUser() user: any,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Param('logId', ParseIntPipe) logId: number,
    @Query('fromLineNum', new ParseIntPipe({ optional: true })) fromLineNum?: number,
  ) {
    return this.jobsService.getLogDetail(user.id, jobId, logId, fromLineNum || 0);
  }
}
