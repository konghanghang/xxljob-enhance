import { apiClient } from './client';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  UserInfo,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRolesRequest,
  UserRoleAssignment,
  RoleInfo,
  CreateRoleRequest,
  UpdateRoleRequest,
  SetJobPermissionRequest,
  BatchSetPermissionsRequest,
  JobPermissionInfo,
  JobPageResult,
  JobGroup,
  ExecuteJobRequest,
  UpdateJobRequest,
  LogPageResult,
  LogQueryParams,
  AuditLog,
  AuditQueryParams,
  AuditStats,
  AuditStatsQueryParams,
} from '../types/api';

/**
 * API Service Layer
 * Provides typed methods for all backend API endpoints
 */

// ============ Auth API ============
export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  refresh: (data: RefreshTokenRequest) =>
    apiClient.post<RefreshTokenResponse>('/auth/refresh', data),

  logout: () => apiClient.post('/auth/logout'),

  getProfile: () => apiClient.get<UserInfo>('/auth/profile'),
};

// ============ Users API ============
export const usersApi = {
  getAll: () => apiClient.get<UserInfo[]>('/users'),

  getById: (id: number) => apiClient.get<UserInfo>(`/users/${id}`),

  create: (data: CreateUserRequest) =>
    apiClient.post<UserInfo>('/users', data),

  update: (id: number, data: UpdateUserRequest) =>
    apiClient.patch<UserInfo>(`/users/${id}`, data),

  remove: (id: number) => apiClient.delete(`/users/${id}`),

  hardDelete: (id: number) => apiClient.delete(`/users/${id}/hard`),

  getRoles: (id: number) => apiClient.get<UserRoleAssignment[]>(`/users/${id}/roles`),

  assignRoles: (id: number, data: AssignRolesRequest) =>
    apiClient.post(`/users/${id}/roles`, data),

  addRole: (userId: number, roleId: number) =>
    apiClient.post(`/users/${userId}/roles/${roleId}`),

  removeRole: (userId: number, roleId: number) =>
    apiClient.delete(`/users/${userId}/roles/${roleId}`),
};

// ============ Roles API ============
export const rolesApi = {
  getAll: () => apiClient.get<RoleInfo[]>('/roles'),

  getById: (id: number) => apiClient.get<RoleInfo>(`/roles/${id}`),

  create: (data: CreateRoleRequest) =>
    apiClient.post<RoleInfo>('/roles', data),

  update: (id: number, data: UpdateRoleRequest) =>
    apiClient.patch<RoleInfo>(`/roles/${id}`, data),

  remove: (id: number) => apiClient.delete(`/roles/${id}`),

  getPermissions: (id: number) =>
    apiClient.get<JobPermissionInfo[]>(`/roles/${id}/permissions`),

  setJobPermission: (id: number, data: SetJobPermissionRequest) =>
    apiClient.post(`/roles/${id}/permissions`, data),

  batchSetPermissions: (id: number, data: BatchSetPermissionsRequest) =>
    apiClient.put(`/roles/${id}/permissions`, data),

  getUsers: (id: number) => apiClient.get<UserInfo[]>(`/roles/${id}/users`),
};

// ============ Jobs API ============
export const jobsApi = {
  getList: (params: {
    jobGroup: number;
    start?: number;
    length?: number;
  }) => apiClient.get<JobPageResult>('/jobs', { params }),

  getGroups: () => apiClient.get<JobGroup[]>('/jobs/groups'),

  getById: (id: number) => apiClient.get<any>(`/jobs/${id}`),

  trigger: (id: number, data?: ExecuteJobRequest) =>
    apiClient.post(`/jobs/${id}/trigger`, data),

  start: (id: number) => apiClient.post(`/jobs/${id}/start`),

  stop: (id: number) => apiClient.post(`/jobs/${id}/stop`),

  update: (id: number, data: UpdateJobRequest) =>
    apiClient.patch(`/jobs/${id}`, data),

  getLogs: (id: number, params?: LogQueryParams) =>
    apiClient.get<LogPageResult>(`/jobs/${id}/logs`, { params }),

  getLogDetail: (jobId: number, logId: number) =>
    apiClient.get<any>(`/jobs/${jobId}/logs/${logId}`),
};

// ============ Audit API ============
export const auditApi = {
  getLogs: (params?: AuditQueryParams) =>
    apiClient.get<{ data: AuditLog[]; total: number; page: number; pageSize: number }>('/audit', { params }),

  getStats: (params?: AuditStatsQueryParams) =>
    apiClient.get<AuditStats>('/audit/stats', { params }),

  getUserRecentLogs: (userId: number, limit?: number) =>
    apiClient.get<AuditLog[]>(`/audit/user/${userId}/recent`, {
      params: { limit },
    }),

  getJobRecentLogs: (jobId: number, limit?: number) =>
    apiClient.get<AuditLog[]>(`/audit/job/${jobId}/recent`, {
      params: { limit },
    }),
};

// ============ Health API ============
export const healthApi = {
  check: () => apiClient.get<{ status: string; timestamp: string; uptime: number }>('/health'),

  detailedCheck: () =>
    apiClient.get<{
      status: string;
      timestamp: string;
      uptime: number;
      checks: {
        database: { status: string; message: string };
        xxlJob: { status: string; message: string };
      };
    }>('/health/detailed'),
};
