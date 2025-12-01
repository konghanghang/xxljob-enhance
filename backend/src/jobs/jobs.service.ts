import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { XxlJobService } from '../xxljob/xxljob.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { XxlJob, XxlJobPageResult, XxlJobLogPageResult } from '../xxljob/interfaces/xxljob.interface';

/**
 * Jobs Service
 * Provides permission-filtered access to xxl-job tasks
 * Combines XxlJobService (xxl-job API) with PermissionsService (RBAC)
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly xxlJobService: XxlJobService,
    private readonly permissionsService: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get job list filtered by user permissions
   * @param userId - User ID
   * @param jobGroup - Job group ID (executor)
   * @param start - Pagination start
   * @param length - Pagination length
   * @returns Filtered job list
   */
  async getJobList(
    userId: number,
    jobGroup: number,
    start = 0,
    length = 10,
  ): Promise<XxlJobPageResult> {
    // Get user permissions first
    const userPermissions = await this.permissionsService.getUserPermissions(userId);

    // Admin can see all jobs - pass through pagination params directly
    if (userPermissions.isAdmin) {
      return this.xxlJobService.getJobList({
        jobGroup,
        start,
        length,
      });
    }

    // For non-admin users, we need to fetch all jobs first to filter by permissions
    // This is necessary because we can't filter on xxl-job side
    const allJobs = await this.xxlJobService.getJobList({
      jobGroup,
      start: 0,
      length: 10000, // Fetch a large number to get all jobs
    });

    // Filter jobs by permissions (only show jobs user can view)
    const accessibleJobIds = new Set(
      userPermissions.permissions.filter((p) => p.canView).map((p) => p.jobId),
    );

    const filteredJobs = allJobs.data.filter((job) => accessibleJobIds.has(job.id));

    // Paginate filtered results
    const paginatedJobs = filteredJobs.slice(start, start + length);

    return {
      recordsTotal: filteredJobs.length,
      recordsFiltered: filteredJobs.length,
      data: paginatedJobs,
    };
  }

  /**
   * Get job detail with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   * @returns Job detail
   */
  async getJobDetail(userId: number, jobId: number, jobGroup: number): Promise<XxlJob> {
    // Check view permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'view',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to view job ${jobId}`);
    }

    // Get job list and find specific job
    const jobList = await this.xxlJobService.getJobList({ jobGroup, start: 0, length: 1000 });
    const job = jobList.data.find((j) => j.id === jobId);

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return job;
  }

  /**
   * Trigger job execution with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   * @param executorParam - Executor parameters
   * @param addressList - Specific executor addresses
   */
  async triggerJob(
    userId: number,
    jobId: number,
    executorParam?: string,
    addressList?: string,
  ): Promise<void> {
    // Check execute permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'execute',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to execute job ${jobId}`);
    }

    // Trigger job via xxl-job API
    await this.xxlJobService.triggerJob(jobId, executorParam, addressList);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        jobId,
        action: 'EXECUTE_JOB',
        target: `Job ${jobId}`,
        result: 'SUCCESS',
        message: `Triggered job execution${executorParam ? ` with params: ${executorParam}` : ''}`,
      },
    });
  }

  /**
   * Start job (enable scheduling) with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   */
  async startJob(userId: number, jobId: number): Promise<void> {
    // Check edit permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'edit',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to start job ${jobId}`);
    }

    await this.xxlJobService.startJob(jobId);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        jobId,
        action: 'START_JOB',
        target: `Job ${jobId}`,
        result: 'SUCCESS',
        message: 'Started job scheduling',
      },
    });
  }

  /**
   * Stop job (disable scheduling) with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   */
  async stopJob(userId: number, jobId: number): Promise<void> {
    // Check edit permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'edit',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to stop job ${jobId}`);
    }

    await this.xxlJobService.stopJob(jobId);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        jobId,
        action: 'STOP_JOB',
        target: `Job ${jobId}`,
        result: 'SUCCESS',
        message: 'Stopped job scheduling',
      },
    });
  }

  /**
   * Update job configuration with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   * @param updateData - Update data
   */
  async updateJob(userId: number, jobId: number, updateData: any): Promise<void> {
    // Check edit permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'edit',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to edit job ${jobId}`);
    }

    await this.xxlJobService.updateJob({ id: jobId, ...updateData });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        jobId,
        action: 'EDIT_JOB',
        target: `Job ${jobId}`,
        result: 'SUCCESS',
        message: `Updated job configuration: ${JSON.stringify(updateData)}`,
      },
    });
  }

  /**
   * Get job execution logs with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   * @param start - Pagination start
   * @param length - Pagination length
   * @returns Job logs
   */
  async getJobLogs(
    userId: number,
    jobId: number,
    start = 0,
    length = 10,
  ): Promise<XxlJobLogPageResult> {
    // Check view permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'view',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to view logs for job ${jobId}`);
    }

    return this.xxlJobService.getJobLogs({ jobId, start, length });
  }

  /**
   * Get log detail with permission check
   * @param userId - User ID
   * @param jobId - Job ID
   * @param logId - Log ID
   * @param fromLineNum - Start line number
   * @returns Log detail
   */
  async getLogDetail(userId: number, jobId: number, logId: number, fromLineNum = 0): Promise<any> {
    // Check view permission
    const hasPermission = await this.permissionsService.hasJobPermission(
      userId,
      jobId,
      'view',
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to view logs for job ${jobId}`);
    }

    return this.xxlJobService.getLogDetail(logId, fromLineNum);
  }

  /**
   * Get job groups (executors) that user can access
   * @param userId - User ID
   * @returns Accessible job groups
   */
  async getAccessibleJobGroups(userId: number) {
    // Get all job groups
    const allGroups = await this.xxlJobService.getJobGroups();

    // Get user permissions
    const userPermissions = await this.permissionsService.getUserPermissions(userId);

    // Admin can access all groups
    if (userPermissions.isAdmin) {
      return allGroups;
    }

    // Get unique appNames from user permissions
    const accessibleAppNames = new Set(
      userPermissions.permissions.filter((p) => p.canView).map((p) => p.appName),
    );

    // Filter groups by accessible appNames
    return allGroups.filter((group) => accessibleAppNames.has(group.appname));
  }

  /**
   * Get user's job permissions with details
   * @param userId - User ID
   * @param jobIds - Job IDs to check (optional)
   * @returns Permission details for jobs
   */
  async getUserJobPermissions(userId: number, jobIds?: number[]) {
    const userPermissions = await this.permissionsService.getUserPermissions(userId);

    if (userPermissions.isAdmin) {
      // Admin has all permissions
      return {
        isAdmin: true,
        permissions: jobIds
          ? jobIds.map((jobId) => ({
              jobId,
              canView: true,
              canExecute: true,
              canEdit: true,
            }))
          : [],
      };
    }

    if (jobIds) {
      // Filter by specific job IDs
      return {
        isAdmin: false,
        permissions: userPermissions.permissions.filter((p) => jobIds.includes(p.jobId)),
      };
    }

    return userPermissions;
  }
}
