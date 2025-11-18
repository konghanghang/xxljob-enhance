/**
 * xxl-job API Response wrapper
 */
export interface XxlJobApiResponse<T = any> {
  code: number;
  msg: string;
  content: T;
}

/**
 * xxl-job Job Info
 */
export interface XxlJob {
  id: number;
  jobGroup: number;
  jobDesc: string;
  addTime?: string;
  updateTime?: string;
  author?: string;
  alarmEmail?: string;
  scheduleType: string; // CRON, FIX_RATE
  scheduleConf: string; // cron expression or interval
  misfireStrategy: string; // DO_NOTHING, FIRE_ONCE_NOW
  executorRouteStrategy: string; // FIRST, LAST, ROUND, RANDOM, etc.
  executorHandler: string;
  executorParam?: string;
  executorBlockStrategy: string; // SERIAL_EXECUTION, DISCARD_LATER, COVER_EARLY
  executorTimeout: number;
  executorFailRetryCount: number;
  glueType: string; // BEAN, GLUE_GROOVY, GLUE_SHELL, etc.
  glueSource?: string;
  glueRemark?: string;
  glueUpdatetime?: string;
  childJobId?: string;
  triggerStatus: number; // 0: stopped, 1: running
  triggerLastTime?: number;
  triggerNextTime?: number;
}

/**
 * xxl-job Job Page Result
 */
export interface XxlJobPageResult {
  recordsTotal: number;
  recordsFiltered: number;
  data: XxlJob[];
}

/**
 * xxl-job Job Group (Executor)
 */
export interface XxlJobGroup {
  id: number;
  appname: string;
  title: string;
  addressType: number; // 0: auto, 1: manual
  addressList?: string;
  updateTime?: string;
}

/**
 * xxl-job Log Info
 */
export interface XxlJobLog {
  id: number;
  jobGroup: number;
  jobId: number;
  executorAddress?: string;
  executorHandler?: string;
  executorParam?: string;
  executorShardingParam?: string;
  executorFailRetryCount: number;
  triggerTime?: string;
  triggerCode: number;
  triggerMsg?: string;
  handleTime?: string;
  handleCode: number;
  handleMsg?: string;
  alarmStatus: number; // 0: default, 1: no need alarm, 2: alarmed, 3: alarm failed
}

/**
 * xxl-job Log Page Result
 */
export interface XxlJobLogPageResult {
  recordsTotal: number;
  recordsFiltered: number;
  data: XxlJobLog[];
}

/**
 * xxl-job Trigger Job Request
 */
export interface TriggerJobRequest {
  id: number;
  executorParam?: string;
  addressList?: string;
}

/**
 * xxl-job Update Job Request
 */
export interface UpdateJobRequest {
  id: number;
  jobGroup?: number;
  jobDesc?: string;
  author?: string;
  alarmEmail?: string;
  scheduleType?: string;
  scheduleConf?: string;
  misfireStrategy?: string;
  executorRouteStrategy?: string;
  executorHandler?: string;
  executorParam?: string;
  executorBlockStrategy?: string;
  executorTimeout?: number;
  executorFailRetryCount?: number;
  glueType?: string;
  glueSource?: string;
  glueRemark?: string;
  childJobId?: string;
}

/**
 * xxl-job Login Request
 */
export interface LoginRequest {
  userName: string;
  password: string;
}
