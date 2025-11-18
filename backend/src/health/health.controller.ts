import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XxlJobService } from '../xxljob/xxljob.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Health Check Controller
 * Provides system health status endpoints
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xxlJobService: XxlJobService,
  ) {}

  /**
   * GET /health
   * Basic health check
   */
  @Public()
  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * GET /health/detailed
   * Detailed health check with dependency status
   */
  @Public()
  @Get('detailed')
  async detailedCheck() {
    const checks = {
      database: await this.checkDatabase(),
      xxlJob: await this.checkXxlJob(),
    };

    const isHealthy = Object.values(checks).every((check) => check.status === 'ok');

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        message: 'Database connection successful',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Database connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Check xxl-job-admin connectivity
   */
  private async checkXxlJob() {
    try {
      const isHealthy = await this.xxlJobService.healthCheck();
      return {
        status: isHealthy ? 'ok' : 'error',
        message: isHealthy
          ? 'xxl-job-admin connection successful'
          : 'xxl-job-admin connection failed',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `xxl-job-admin connection failed: ${error.message}`,
      };
    }
  }
}
