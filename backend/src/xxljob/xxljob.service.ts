import { Injectable, OnModuleInit, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  XxlJobApiResponse,
  XxlJob,
  XxlJobPageResult,
  XxlJobGroup,
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
    const queryParams = new URLSearchParams();
    queryParams.append('jobGroup', params.jobGroup.toString());
    queryParams.append('triggerStatus', (params.triggerStatus ?? -1).toString());
    if (params.jobDesc) queryParams.append('jobDesc', params.jobDesc);
    if (params.executorHandler) queryParams.append('executorHandler', params.executorHandler);
    if (params.author) queryParams.append('author', params.author);
    queryParams.append('start', (params.start ?? 0).toString());
    queryParams.append('length', (params.length ?? 10).toString());

    const response = await this.axiosInstance.post<XxlJobApiResponse<XxlJobPageResult>>(
      '/jobinfo/pageList',
      queryParams,
      {
        headers: { Cookie: this.cookie },
      },
    );

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to get job list', 500);
    }

    return response.data.content;
  }

  /**
   * Get job groups (executors)
   */
  async getJobGroups(): Promise<XxlJobGroup[]> {
    const response = await this.axiosInstance.post<XxlJobApiResponse<XxlJobGroup[]>>(
      '/jobgroup/pageList',
      new URLSearchParams({ start: '0', length: '100' }),
      {
        headers: { Cookie: this.cookie },
      },
    );

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to get job groups', 500);
    }

    return response.data.content;
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
   * Get job execution logs
   * @param jobId - Job ID
   * @param logStatus - Log status (1: success, 2: failed, 3: running)
   * @param filterTime - Filter by time range
   * @param start - Pagination start
   * @param length - Pagination length
   */
  async getJobLogs(params: {
    jobId: number;
    logStatus?: number;
    filterTime?: string;
    start?: number;
    length?: number;
  }): Promise<XxlJobLogPageResult> {
    const queryParams = new URLSearchParams();
    queryParams.append('jobId', params.jobId.toString());
    if (params.logStatus) queryParams.append('logStatus', params.logStatus.toString());
    if (params.filterTime) queryParams.append('filterTime', params.filterTime);
    queryParams.append('start', (params.start ?? 0).toString());
    queryParams.append('length', (params.length ?? 10).toString());

    const response = await this.axiosInstance.post<XxlJobApiResponse<XxlJobLogPageResult>>(
      '/joblog/pageList',
      queryParams,
      {
        headers: { Cookie: this.cookie },
      },
    );

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to get job logs', 500);
    }

    return response.data.content;
  }

  /**
   * Get detailed log content
   * @param logId - Log ID
   * @param fromLineNum - Start line number for incremental loading
   */
  async getLogDetail(logId: number, fromLineNum: number = 0): Promise<any> {
    const params = new URLSearchParams();
    params.append('logId', logId.toString());
    params.append('fromLineNum', fromLineNum.toString());

    const response = await this.axiosInstance.post<XxlJobApiResponse>(
      '/joblog/logDetailCat',
      params,
      {
        headers: { Cookie: this.cookie },
      },
    );

    if (response.data.code !== 200) {
      throw new HttpException(response.data.msg || 'Failed to get log detail', 500);
    }

    return response.data.content;
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
