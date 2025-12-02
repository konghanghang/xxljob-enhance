import { Injectable, OnModuleInit, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  XxlJobApiResponse,
  XxlJob,
  XxlJobPageResult,
  XxlJobGroup,
  XxlJobGroupPageResult,
  XxlJobLog,
  XxlJobLogPageResult,
  TriggerJobRequest,
  UpdateJobRequest,
} from './interfaces/xxljob.interface';

/**
 * XxlJob Service
 * Handles communication with xxl-job-admin API
 */
@Injectable()
export class XxlJobService implements OnModuleInit {
  private readonly logger = new Logger(XxlJobService.name);
  private axiosInstance: AxiosInstance;
  private adminUrl: string;
  private username: string;
  private password: string;
  private cookie: string = '';

  constructor(private readonly configService: ConfigService) {
    this.adminUrl = this.configService.get<string>('XXL_JOB_ADMIN_URL')!;
    this.username = this.configService.get<string>('XXL_JOB_USERNAME')!;
    this.password = this.configService.get<string>('XXL_JOB_PASSWORD')!;

    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.adminUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        // If 401/403, try to re-login once
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.logger.warn('Session expired, attempting re-login...');
          try {
            await this.login();
            // Retry original request with new cookie
            const config = error.config;
            config.headers['Cookie'] = this.cookie;
            return this.axiosInstance.request(config);
          } catch (loginError) {
            this.logger.error('Re-login failed', loginError);
            throw loginError;
          }
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Initialize: Auto-login on module init
   */
  async onModuleInit() {
    try {
      await this.login();
      this.logger.log('Successfully logged in to xxl-job-admin');
    } catch (error) {
      this.logger.error('Failed to login to xxl-job-admin on startup', error);
      // Don't throw - allow app to start even if xxl-job is unavailable
    }
  }

  /**
   * Login to xxl-job-admin and maintain session cookie
   */
  async login(): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append('userName', this.username);
      params.append('password', this.password);

      const response = await this.axiosInstance.post('/login', params, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Extract cookie from response
      const setCookie = response.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) {
        this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        this.logger.debug('Session cookie updated');
      } else {
        throw new Error('No cookie received from login');
      }
    } catch (error: any) {
      this.logger.error('Login failed', error.message);
      throw new HttpException('Failed to authenticate with xxl-job-admin', 500);
    }
  }

  /**
   * Get job list with pagination
   * @param jobGroup - Job group ID (executor)
   * @param triggerStatus - Filter by trigger status (-1: all, 0: stopped, 1: running)
   * @param jobDesc - Filter by job description (partial match)
   * @param executorHandler - Filter by executor handler
   * @param author - Filter by author
   * @param start - Pagination start (default: 0)
   * @param length - Pagination length (default: 10)
   */
  async getJobList(params: {
    jobGroup: number;
    triggerStatus?: number;
    jobDesc?: string;
    executorHandler?: string;
    author?: string;
    start?: number;
    length?: number;
  }): Promise<XxlJobPageResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('jobGroup', params.jobGroup.toString());
      queryParams.append('triggerStatus', (params.triggerStatus ?? -1).toString());
      if (params.jobDesc) queryParams.append('jobDesc', params.jobDesc);
      if (params.executorHandler) queryParams.append('executorHandler', params.executorHandler);
      if (params.author) queryParams.append('author', params.author);
      queryParams.append('start', (params.start ?? 0).toString());
      queryParams.append('length', (params.length ?? 10).toString());

      // Note: /jobinfo/pageList returns paginated format, not standard API response
      const response = await this.axiosInstance.post<XxlJobPageResult>(
        '/jobinfo/pageList',
        queryParams,
        {
          headers: { Cookie: this.cookie },
        },
      );

      this.logger.debug(`Got ${response.data.recordsTotal} total jobs, ${response.data.data.length} in current page`);

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get job list', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        jobGroup: params.jobGroup,
      });
      throw new HttpException('Failed to get job list', 500);
    }
  }

  /**
   * Get job groups (executors)
   */
  async getJobGroups(): Promise<XxlJobGroup[]> {
    try {
      this.logger.debug(`Fetching job groups from: ${this.adminUrl}/jobgroup/pageList`);
      this.logger.debug(`Using cookie: ${this.cookie ? 'Present' : 'Missing'}`);

      // Note: /jobgroup/pageList returns paginated format, not standard API response
      const response = await this.axiosInstance.post<XxlJobGroupPageResult>(
        '/jobgroup/pageList',
        new URLSearchParams({ start: '0', length: '100' }),
        {
          headers: { Cookie: this.cookie },
        },
      );

      this.logger.debug(`Response status: ${response.status}`);
      this.logger.debug(`Got ${response.data.recordsTotal} job groups`);

      return response.data.data;
    } catch (error: any) {
      this.logger.error('Failed to get job groups', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      throw new HttpException('Failed to get job groups', 500);
    }
  }

  /**
   * Trigger a job manually
   * @param jobId - Job ID
   * @param executorParam - Executor parameters (optional)
   * @param addressList - Specific executor addresses (optional)
   */
  async triggerJob(jobId: number, executorParam?: string, addressList?: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('id', jobId.toString());
    if (executorParam) params.append('executorParam', executorParam);
    if (addressList) params.append('addressList', addressList);

    const response = await this.axiosInstance.post<XxlJobApiResponse>(
      '/jobinfo/trigger',
      params,
      {
        headers: { Cookie: this.cookie },
      },
    );

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to trigger job', 500);
    }
  }

  /**
   * Start a job (enable scheduling)
   * @param jobId - Job ID
   */
  async startJob(jobId: number): Promise<void> {
    const params = new URLSearchParams();
    params.append('id', jobId.toString());

    const response = await this.axiosInstance.post<XxlJobApiResponse>('/jobinfo/start', params, {
      headers: { Cookie: this.cookie },
    });

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to start job', 500);
    }
  }

  /**
   * Stop a job (disable scheduling)
   * @param jobId - Job ID
   */
  async stopJob(jobId: number): Promise<void> {
    const params = new URLSearchParams();
    params.append('id', jobId.toString());

    const response = await this.axiosInstance.post<XxlJobApiResponse>('/jobinfo/stop', params, {
      headers: { Cookie: this.cookie },
    });

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to stop job', 500);
    }
  }

  /**
   * Update job configuration
   * @param jobData - Job update data
   */
  async updateJob(jobData: UpdateJobRequest): Promise<void> {
    const params = new URLSearchParams();
    Object.entries(jobData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await this.axiosInstance.post<XxlJobApiResponse>('/jobinfo/update', params, {
      headers: { Cookie: this.cookie },
    });

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to update job', 500);
    }
  }

  /**
   * Get job info by ID
   * @param jobId - Job ID
   * @returns Job info including jobGroup
   */
  async getJobInfo(jobId: number): Promise<XxlJob> {
    try {
      // Try to get from job list (using -1 to get all job groups and all trigger statuses)
      // Note: /jobinfo/pageList returns paginated format, not standard API response
      const response = await this.axiosInstance.post<XxlJobPageResult>(
        '/jobinfo/pageList',
        `jobGroup=-1&triggerStatus=-1&jobDesc=&executorHandler=&author=&start=0&length=1000`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: this.cookie,
          },
        },
      );

      // Check if response data exists
      if (!response.data || !response.data.data) {
        this.logger.error('Invalid response from xxl-job API', {
          jobId,
          response: response.data,
        });
        throw new HttpException('Invalid response from xxl-job API', 500);
      }

      const job = response.data.data.find((j: XxlJob) => j.id === jobId);
      if (!job) {
        throw new HttpException(`Job ${jobId} not found`, 404);
      }

      return job;
    } catch (error: any) {
      this.logger.error('Failed to get job info', {
        message: error.message,
        jobId,
      });
      throw new HttpException('Failed to get job info', 500);
    }
  }

  /**
   * Get job execution logs
   * @param jobGroup - Job group ID
   * @param jobId - Job ID
   * @param logStatus - Log status (1: success, 2: failed, 3: running)
   * @param filterTime - Filter by time range
   * @param start - Pagination start
   * @param length - Pagination length
   */
  async getJobLogs(params: {
    jobGroup: number;
    jobId: number;
    logStatus?: number;
    filterTime?: string;
    start?: number;
    length?: number;
  }): Promise<XxlJobLogPageResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('jobGroup', params.jobGroup.toString());
      queryParams.append('jobId', params.jobId.toString());
      // logStatus: 0=all, 1=success, 2=failed, 3=running - default to 0 (all)
      queryParams.append('logStatus', (params.logStatus ?? 0).toString());
      if (params.filterTime) queryParams.append('filterTime', params.filterTime);
      queryParams.append('start', (params.start ?? 0).toString());
      queryParams.append('length', (params.length ?? 10).toString());

      // Note: /joblog/pageList returns paginated format, not standard API response
      const response = await this.axiosInstance.post<XxlJobLogPageResult>(
        '/joblog/pageList',
        queryParams,
        {
          headers: { Cookie: this.cookie },
        },
      );

      this.logger.debug(`Got ${response.data.recordsTotal} total logs for job ${params.jobId}`);

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get job logs', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        jobId: params.jobId,
      });
      throw new HttpException('Failed to get job logs', 500);
    }
  }

  /**
   * Get detailed log content
   * @param logId - Log ID
   * @param fromLineNum - Start line number for incremental loading
   * @param triggerTime - Trigger time timestamp (required by XXL-Job API)
   */
  async getLogDetail(logId: number, fromLineNum: number = 0, triggerTime: number = 0): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('logId', logId.toString());
      params.append('fromLineNum', fromLineNum.toString());
      params.append('triggerTime', triggerTime.toString());

      const response = await this.axiosInstance.post<XxlJobApiResponse>(
        '/joblog/logDetailCat',
        params,
        {
          headers: { Cookie: this.cookie },
        },
      );

      if (response.data.code !== 200) {
        this.logger.error('XXL-Job API returned error for log detail', {
          logId,
          fromLineNum,
          triggerTime,
          responseCode: response.data.code,
          responseMsg: response.data.msg,
        });
        throw new HttpException(response.data.msg || 'Failed to get log detail', 500);
      }

      return response.data.content;
    } catch (error: any) {
      this.logger.error('Failed to get log detail', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        logId,
        fromLineNum,
        triggerTime,
      });
      throw new HttpException(error.message || 'Failed to get log detail', 500);
    }
  }

  /**
   * Health check - verify connection to xxl-job-admin
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getJobGroups();
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
}
