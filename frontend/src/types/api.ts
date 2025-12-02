/**
 * API Type Definitions
 * Matches backend DTOs and response structures
 */

// ============ Auth Types ============
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

// ============ User Types ============
export interface UserInfo {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  isAdmin?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  email?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface AssignRolesRequest {
  roleIds: number[];
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface UserRoleAssignment {
  role: RoleInfo;
  assignedAt: string;
  assignedBy: number | null;
}

// ============ Role Types ============
export interface RoleInfo {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

export interface SetJobPermissionRequest {
  jobId: number;
  appName: string;
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
}

export interface BatchSetPermissionsRequest {
  permissions: SetJobPermissionRequest[];
}

export interface JobPermissionInfo {
  jobId: number;
  appName: string;
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
}

// ============ Job Types ============
export interface XxlJob {
  id: number;
  jobGroup: number;
  jobDesc: string;
  author: string;
  alarmEmail: string;
  scheduleType: string;
  scheduleConf: string;
  misfireStrategy: string;
  executorRouteStrategy: string;
  executorHandler: string;
  executorParam: string;
  executorBlockStrategy: string;
  executorTimeout: number;
  executorFailRetryCount: number;
  glueType: string;
  glueSource: string;
  glueRemark: string;
  glueUpdatetime: string;
  childJobId: string;
  triggerStatus: number;
  triggerLastTime: number;
  triggerNextTime: number;
}

export interface JobPageResult {
  recordsTotal: number;
  recordsFiltered: number;
  data: XxlJob[];
}

export interface JobGroup {
  id: number;
  appname: string;
  title: string;
  addressType: number;
  addressList: string;
  updateTime: string;
}

export interface ExecuteJobRequest {
  executorParam?: string;
  addressList?: string;
}

export interface UpdateJobRequest {
  jobDesc?: string;
  author?: string;
  alarmEmail?: string;
  scheduleConf?: string;
  executorParam?: string;
}

// ============ Log Types ============
export interface XxlJobLog {
  id: number;
  jobId: number;
  jobGroup: number;
  executorAddress: string;
  executorHandler: string;
  executorParam: string;
  executorShardingParam: string;
  executorFailRetryCount: number;
  triggerTime: string;
  triggerCode: number;
  triggerMsg: string;
  handleTime: string;
  handleCode: number;
  handleMsg: string;
}

export interface LogPageResult {
  recordsTotal: number;
  recordsFiltered: number;
  data: XxlJobLog[];
}

export interface LogQueryParams {
  start?: number;
  length?: number;
  logStatus?: number;
}

// ============ Audit Types ============
export interface AuditLog {
  id: number;
  userId: number;
  jobId: number | null;
  action: string;
  target: string;
  result: string;
  message: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditQueryParams {
  userId?: number;
  jobId?: number;
  action?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditStatsQueryParams {
  startDate?: string;
  endDate?: string;
}

export interface AuditStats {
  totalLogs: number;
  actionStats: { action: string; _count: { action: number } }[];
  resultStats: { result: string; _count: { result: number } }[];
  topUsers: { userId: number; username: string; count: number }[];
  topJobs: { jobId: number; count: number }[];
}

// ============ Error Response ============
export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  message: string | string[];
}
