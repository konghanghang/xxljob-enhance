import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogInput {
  userId: number;
  jobId?: number;
  action: string;
  target?: string;
  result: string;
  message?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  userId?: number;
  jobId?: number;
  action?: string;
  result?: string;
  startDate?: Date;
  endDate?: Date;
  skip?: number;
  take?: number;
}

/**
 * Audit Service
 * Handles audit log creation and querying
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   * @param data - Audit log data
   */
  async log(data: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        jobId: data.jobId,
        action: data.action,
        target: data.target,
        result: data.result,
        message: data.message,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Find all audit logs with filters
   * @param query - Query parameters
   * @returns Audit logs
   */
  async findAll(query: AuditLogQuery = {}) {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.jobId) {
      where.jobId = query.jobId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.result) {
      where.result = query.result;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip || 0,
        take: query.take || 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      data: logs,
    };
  }

  /**
   * Get audit log statistics
   * @param startDate - Start date for statistics
   * @param endDate - End date for statistics
   * @returns Statistics
   */
  async getStats(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [
      totalLogs,
      actionStats,
      resultStats,
      topUsers,
      topJobs,
    ] = await Promise.all([
      // Total logs count
      this.prisma.auditLog.count({ where }),

      // Group by action
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),

      // Group by result
      this.prisma.auditLog.groupBy({
        by: ['result'],
        where,
        _count: { result: true },
        orderBy: { _count: { result: 'desc' } },
      }),

      // Top users by activity
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),

      // Top jobs by activity
      this.prisma.auditLog.groupBy({
        by: ['jobId'],
        where: {
          ...where,
          jobId: { not: null },
        },
        _count: { jobId: true },
        orderBy: { _count: { jobId: 'desc' } },
        take: 10,
      }),
    ]);

    // Get user details for top users
    const userIds = topUsers.map((u) => u.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const topUsersWithDetails = topUsers.map((u) => ({
      userId: u.userId,
      username: users.find((user) => user.id === u.userId)?.username || 'Unknown',
      count: u._count.userId,
    }));

    return {
      totalLogs,
      actionStats: actionStats.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
      resultStats: resultStats.map((r) => ({
        result: r.result,
        count: r._count.result,
      })),
      topUsers: topUsersWithDetails,
      topJobs: topJobs.map((j) => ({
        jobId: j.jobId!,
        count: j._count.jobId,
      })),
    };
  }

  /**
   * Clean old logs (older than specified days)
   * @param days - Number of days to keep (default: 180, i.e., 6 months)
   * @returns Number of deleted logs
   */
  async cleanOldLogs(days = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get recent logs for a user
   * @param userId - User ID
   * @param limit - Number of logs to return
   * @returns Recent audit logs
   */
  async getUserRecentLogs(userId: number, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get recent logs for a job
   * @param jobId - Job ID
   * @param limit - Number of logs to return
   * @returns Recent audit logs
   */
  async getJobRecentLogs(jobId: number, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: { jobId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }
}
