# xxljob-enhance API 文档

本文档介绍 xxljob-enhance 的 REST API 接口。

## 📚 访问 Swagger UI

系统已集成 Swagger/OpenAPI 文档，提供交互式 API 浏览和测试功能。

### 本地开发环境

启动后端服务后，访问：
```
http://localhost:3000/api-docs
```

### Docker 部署环境

```
http://your-domain:3000/api-docs
```

---

## 🔐 认证

API 使用 **JWT Bearer Token** 认证。

### 获取 Token

**端点**: `POST /auth/login`

**请求体**:
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**响应**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "isAdmin": true
  }
}
```

### 使用 Token

在后续请求中添加 Authorization header：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**在 Swagger UI 中使用**：
1. 点击右上角 "Authorize" 按钮
2. 输入 access token（不需要 "Bearer " 前缀）
3. 点击 "Authorize"
4. 现在所有受保护的接口都会自动带上此 token

---

## 📋 API 端点概览

### 1. 认证 (Authentication)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 用户登录 | ❌ |
| POST | `/auth/refresh` | 刷新 access token | ❌ |
| POST | `/auth/logout` | 用户登出 | ✅ |
| GET | `/auth/profile` | 获取当前用户信息 | ✅ |

### 2. 用户管理 (Users)

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| POST | `/users` | 创建新用户 | 管理员 |
| GET | `/users` | 获取用户列表 | 管理员 |
| GET | `/users/:id` | 获取用户详情 | 管理员 |
| PATCH | `/users/:id` | 更新用户信息 | 管理员 |
| DELETE | `/users/:id` | 删除用户 | 管理员 |

### 3. 角色管理 (Roles)

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| POST | `/roles` | 创建角色 | 管理员 |
| GET | `/roles` | 获取角色列表 | 管理员 |
| GET | `/roles/:id` | 获取角色详情 | 管理员 |
| PATCH | `/roles/:id` | 更新角色 | 管理员 |
| DELETE | `/roles/:id` | 删除角色 | 管理员 |

### 4. 权限管理 (Permissions)

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| POST | `/roles/:roleId/permissions` | 为角色分配任务权限 | 管理员 |
| GET | `/roles/:roleId/permissions` | 获取角色的任务权限 | 管理员 |
| DELETE | `/roles/:roleId/permissions/:permissionId` | 删除角色权限 | 管理员 |
| GET | `/users/:userId/permissions` | 获取用户的所有任务权限 | 认证用户 |

### 5. 任务管理 (Jobs)

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/jobs` | 获取任务列表（过滤用户可见任务） | 认证用户 |
| GET | `/jobs/:id` | 获取任务详情 | view 权限 |
| POST | `/jobs/:id/trigger` | 触发任务执行 | execute 权限 |
| POST | `/jobs/:id/start` | 启动任务 | edit 权限 |
| POST | `/jobs/:id/stop` | 停止任务 | edit 权限 |
| GET | `/jobs/groups` | 获取执行器组列表 | 认证用户 |

### 6. 审计日志 (Audit)

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/audit` | 获取审计日志列表 | 管理员 |
| GET | `/audit/:id` | 获取日志详情 | 管理员 |

### 7. 健康检查 (Health)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/health` | 系统健康检查 | ❌ |

---

## 🔑 权限模型

系统使用 **RBAC（基于角色的访问控制）** 模型。

### 权限类型

每个任务有三种权限：

1. **view** (查看) - 可以查看任务详情
2. **execute** (执行) - 可以触发任务执行
3. **edit** (编辑) - 可以启动/停止任务

### 权限合并规则 (OR 逻辑)

用户的多个角色对同一任务的权限会进行 **OR 合并**：

**示例**：
- 角色 A 对任务 1: `canView=true, canExecute=false`
- 角色 B 对任务 1: `canView=false, canExecute=true`
- **合并结果**: `canView=true, canExecute=true`

### 管理员权限

- `isAdmin=true` 的用户拥有所有任务的所有权限
- 无需额外角色分配

---

## 📖 常见使用场景

### 1. 用户登录并查看可访问的任务

```bash
# 1. 登录获取 token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# 响应: { "accessToken": "...", "refreshToken": "...", "user": {...} }

# 2. 使用 token 获取任务列表
curl -X GET http://localhost:3000/jobs?jobGroup=1&start=0&length=10 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. 管理员创建用户并分配角色

```bash
# 1. 创建用户
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "secure-password",
    "isAdmin": false
  }'

# 2. 创建角色
curl -X POST http://localhost:3000/roles \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Job Executor",
    "description": "Can execute specific jobs"
  }'

# 3. 为角色分配任务权限
curl -X POST http://localhost:3000/roles/1/permissions \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": 1,
    "appName": "test-executor",
    "canView": true,
    "canExecute": true,
    "canEdit": false
  }'
```

### 3. 用户执行任务

```bash
# 触发任务执行（需要 execute 权限）
curl -X POST http://localhost:3000/jobs/1/trigger \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "executorParam": "test-param",
    "addressList": "127.0.0.1:9999"
  }'
```

### 4. 刷新 Token

```bash
# Access token 过期后，使用 refresh token 获取新的 access token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

## 🛡️ 错误响应格式

所有错误遵循统一格式：

```json
{
  "statusCode": 403,
  "message": "User does not have permission to execute this job",
  "error": "Forbidden",
  "timestamp": "2025-01-18T10:30:00.000Z",
  "path": "/jobs/1/trigger"
}
```

### 常见 HTTP 状态码

| 状态码 | 含义 | 示例场景 |
|--------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未登录或 token 无效 |
| 403 | Forbidden | 无权限访问资源 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

---

## 🔍 查询参数说明

### 任务列表 (`GET /jobs`)

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jobGroup` | number | ✅ | 执行器组 ID |
| `start` | number | ✅ | 分页起始位置 |
| `length` | number | ✅ | 每页数量 |
| `jobDesc` | string | ❌ | 任务描述（模糊搜索） |
| `executorHandler` | string | ❌ | 执行器 Handler（精确匹配） |
| `author` | string | ❌ | 创建者（模糊搜索） |

### 审计日志 (`GET /audit`)

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `userId` | number | ❌ | 用户 ID |
| `action` | string | ❌ | 操作类型（LOGIN, LOGOUT, EXECUTE_JOB 等） |
| `startDate` | string | ❌ | 开始日期 (ISO 8601) |
| `endDate` | string | ❌ | 结束日期 (ISO 8601) |
| `page` | number | ❌ | 页码（默认 1） |
| `limit` | number | ❌ | 每页数量（默认 20） |

---

## 📊 数据模型

### User (用户)

```typescript
{
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Role (角色)

```typescript
{
  id: number;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### RoleJobPermission (角色任务权限)

```typescript
{
  id: number;
  roleId: number;
  jobId: number;
  appName: string;
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### AuditLog (审计日志)

```typescript
{
  id: number;
  userId: number;
  jobId: number | null;
  action: string;
  result: string;
  message: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

---

## 🚀 Postman Collection

可以从 Swagger UI 导出 OpenAPI JSON，然后导入到 Postman：

1. 访问 `http://localhost:3000/api-docs-json`
2. 保存 JSON 文件
3. 在 Postman 中：`File -> Import -> 选择 JSON 文件`

---

## 🔗 相关文档

- [部署文档](./deployment.md)
- [项目 README](../README.md)
- [Swagger UI](http://localhost:3000/api-docs)
