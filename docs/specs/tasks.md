# xxljob-enhance - Task List

## Implementation Tasks

### Phase 1: 项目初始化和基础设施

- [x] **1. 初始化 NestJS 后端项目**
    - [x] 1.1. 创建 NestJS 项目脚手架
        - *Goal*: 搭建后端项目基础结构
        - *Details*: 运行 `nest new xxljob-enhance-backend`，配置 TypeScript strict 模式，安装核心依赖
        - *Files*: `backend/package.json`, `backend/tsconfig.json`, `backend/nest-cli.json`
        - *Requirements*: NFR-005（TypeScript 严格模式）
    - [x] 1.2. 配置项目结构和模块
        - *Goal*: 按照设计文档组织代码结构
        - *Details*: 创建 `src/auth`, `src/users`, `src/roles`, `src/permissions`, `src/jobs`, `src/xxljob`, `src/audit` 模块目录
        - *Files*: `backend/src/*/*.module.ts`
        - *Requirements*: Design - Components and Interfaces

- [x] **2. 配置 Prisma 和数据库**
    - [x] 2.1. 安装 Prisma 依赖
        - *Goal*: 集成 Prisma ORM
        - *Details*: 安装 `@prisma/client`, `prisma`，初始化 Prisma (`npx prisma init --datasource-provider sqlite`)
        - *Files*: `backend/prisma/schema.prisma`
        - *Requirements*: NFR-003（SQLite 数据库）
    - [x] 2.2. 编写 Prisma Schema
        - *Goal*: 定义数据模型（User, Role, UserRole, RoleJobPermission, AuditLog）
        - *Details*: 复制设计文档中的 Prisma Schema，添加索引和关系
        - *Files*: `backend/prisma/schema.prisma`
        - *Requirements*: Design - Data Models
    - [x] 2.3. 生成数据库迁移
        - *Goal*: 创建初始数据库表
        - *Details*: 运行 `npx prisma migrate dev --name init`，生成 Prisma Client
        - *Files*: `backend/prisma/migrations/`, `backend/node_modules/.prisma/`
        - *Requirements*: Design - Data Models
    - [x] 2.4. 创建 PrismaService
        - *Goal*: 封装 Prisma Client 为 NestJS 服务
        - *Details*: 创建 PrismaService 继承 PrismaClient，实现 `onModuleInit` 和 `enableShutdownHooks`
        - *Files*: `backend/src/prisma/prisma.service.ts`, `backend/src/prisma/prisma.module.ts`
        - *Requirements*: Design - Data Access Layer

- [ ] **3. 配置环境变量和配置管理**
    - [x] 3.1. 安装 @nestjs/config
        - *Goal*: 支持环境变量配置
        - *Details*: 安装 `@nestjs/config`，在 AppModule 中导入 ConfigModule
        - *Files*: `backend/src/app.module.ts`
        - *Requirements*: NFR-003（配置项通过环境变量注入）
    - [x] 3.2. 创建环境变量文件和验证 Schema
        - *Goal*: 定义所需环境变量
        - *Details*: 创建 `.env.example` 和 `src/config/env.validation.ts`（使用 Joi 验证）
        - *Files*: `backend/.env.example`, `backend/src/config/env.validation.ts`
        - *Requirements*: NFR-002（JWT_SECRET）, NFR-004（XXL_JOB_ADMIN_URL）

---

### Phase 2: 认证模块

- [x] **4. 实现用户认证和 JWT**
    - [x] 4.1. 安装认证相关依赖
        - *Goal*: 集成 Passport 和 JWT
        - *Details*: 安装 `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt`, `@types/bcrypt`
        - *Files*: `backend/package.json`
        - *Requirements*: US-001, NFR-002
    - [x] 4.2. 创建 AuthService（密码验证和 JWT 签发）
        - *Goal*: 实现登录逻辑
        - *Details*: 实现 `validateUser`（bcrypt.compare）, `login`（JWT 签发）, `verifyToken` 方法
        - *Files*: `backend/src/auth/auth.service.ts`
        - *Requirements*: US-001, NFR-002（bcrypt cost factor 10）
    - [x] 4.3. 创建 JWT Strategy
        - *Goal*: 实现 JWT Token 验证
        - *Details*: 继承 `PassportStrategy(Strategy)`，实现 `validate` 方法从 Token 提取用户信息
        - *Files*: `backend/src/auth/strategies/jwt.strategy.ts`
        - *Requirements*: US-001, NFR-002（1小时过期）
    - [x] 4.4. 创建 JwtAuthGuard
        - *Goal*: 保护需要认证的路由
        - *Details*: 继承 `AuthGuard('jwt')`，可以全局或局部使用
        - *Files*: `backend/src/auth/guards/jwt-auth.guard.ts`
        - *Requirements*: US-001, NFR-002
    - [x] 4.5. 创建 AuthController（登录、刷新 Token）
        - *Goal*: 提供认证 API
        - *Details*: 实现 `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` 接口
        - *Files*: `backend/src/auth/auth.controller.ts`
        - *Requirements*: US-001
    - [x] 4.6. 创建 DTO（LoginDto, RefreshTokenDto, LoginResponseDto）
        - *Goal*: 验证请求参数和响应格式
        - *Details*: 使用 class-validator 装饰器验证用户名（MinLength 3）和密码（MinLength 6）
        - *Files*: `backend/src/auth/dto/*.dto.ts`
        - *Requirements*: US-001, Design - Auth Module

---

### Phase 3: 权限核心模块

- [x] **5. 实现 PermissionsService（核心权限逻辑）**
    - [x] 5.1. 创建 PermissionsService
        - *Goal*: 实现权限查询和计算逻辑
        - *Details*: 实现 `getUserJobPermissions`（OR 逻辑合并角色权限）, `getUserVisibleJobIds`, `checkPermission`, `getUserAllPermissions`
        - *Files*: `backend/src/permissions/permissions.service.ts`
        - *Requirements*: US-002, US-003, US-008（OR 逻辑）
    - [x] 5.2. 创建 JobPermissionGuard
        - *Goal*: 验证用户对任务的操作权限
        - *Details*: 实现 `canActivate`，检查管理员绕过，调用 PermissionsService，根据装饰器元数据判断所需权限
        - *Files*: `backend/src/permissions/guards/job-permission.guard.ts`
        - *Requirements*: US-003, US-004, NFR-002（权限验证）
    - [x] 5.3. 创建 RequirePermission 装饰器
        - *Goal*: 声明接口所需权限
        - *Details*: 使用 SetMetadata 定义装饰器，接受 PermissionAction 参数（VIEW/EXECUTE/EDIT）
        - *Files*: `backend/src/permissions/decorators/require-permission.decorator.ts`
        - *Requirements*: Design - Security Design
    - [x] 5.4. 创建 AdminGuard
        - *Goal*: 验证用户是否为管理员
        - *Details*: 检查 `request.user.isAdmin` 字段，非管理员返回 403
        - *Files*: `backend/src/permissions/guards/admin.guard.ts`
        - *Requirements*: US-005, US-006, US-007, NFR-002

---

### Phase 4: 用户管理模块

- [x] **6. 实现用户管理功能**
    - [x] 6.1. 创建 UsersService
        - *Goal*: 实现用户 CRUD 操作
        - *Details*: 实现 `create`（密码 bcrypt 加密）, `findAll`, `findOne`, `update`, `remove`, `assignRoles`, `getUserRoles`
        - *Files*: `backend/src/users/users.service.ts`
        - *Requirements*: US-007
    - [x] 6.2. 创建 UsersController
        - *Goal*: 提供用户管理 API（仅管理员）
        - *Details*: 实现 GET/POST/PATCH/DELETE `/users` 接口，`POST /users/:id/roles`（分配角色），使用 AdminGuard
        - *Files*: `backend/src/users/users.controller.ts`
        - *Requirements*: US-007
    - [x] 6.3. 创建用户相关 DTO
        - *Goal*: 验证请求参数
        - *Details*: CreateUserDto, UpdateUserDto, UserResponseDto（不包含密码字段）, AssignRolesDto
        - *Files*: `backend/src/users/dto/*.dto.ts`
        - *Requirements*: US-007, Design - Users Module

---

### Phase 5: 角色管理模块

- [x] **7. 实现角色管理功能**
    - [x] 7.1. 创建 RolesService
        - *Goal*: 实现角色 CRUD 和权限配置
        - *Details*: 实现 `create`, `findAll`, `findOne`, `update`, `remove`, `setJobPermission`, `getRolePermissions`
        - *Files*: `backend/src/roles/roles.service.ts`
        - *Requirements*: US-005
    - [x] 7.2. 创建 RolesController
        - *Goal*: 提供角色管理 API（仅管理员）
        - *Details*: 实现 GET/POST/PATCH/DELETE `/roles` 接口，`POST /roles/:id/permissions`（配置任务权限），使用 AdminGuard
        - *Files*: `backend/src/roles/roles.controller.ts`
        - *Requirements*: US-005
    - [x] 7.3. 创建角色相关 DTO
        - *Goal*: 验证请求参数
        - *Details*: CreateRoleDto, UpdateRoleDto, RoleResponseDto, SetJobPermissionDto, BatchSetPermissionsDto
        - *Files*: `backend/src/roles/dto/*.dto.ts`
        - *Requirements*: US-005, Design - Roles Module

---

### Phase 6: xxl-job API 集成

- [x] **8. 实现 xxl-job API 调用**
    - [x] 8.1. 安装 Axios
        - *Goal*: 用于 HTTP 请求
        - *Details*: 安装 `axios`
        - *Files*: `backend/package.json`
        - *Requirements*: US-010
    - [x] 8.2. 创建 XxlJobService
        - *Goal*: 封装 xxl-job API 调用
        - *Details*: 实现 `login`（维护会话 Cookie）, `getJobList`, `getJobGroups`, `triggerJob`, `getJobLogs`, `updateJob`, `startJob`, `stopJob`, `healthCheck`
        - *Files*: `backend/src/xxljob/xxljob.service.ts`
        - *Requirements*: US-010, Design - XxlJob Module
    - [x] 8.3. 创建 xxl-job 数据类型定义
        - *Goal*: 定义 xxl-job API 返回的数据结构
        - *Details*: 定义 XxlJob, XxlJobLog, XxlJobPageResult, XxlJobGroup, TriggerJobRequest, UpdateJobRequest 接口
        - *Files*: `backend/src/xxljob/interfaces/xxljob.interface.ts`
        - *Requirements*: Design - XxlJob Module
    - [x] 8.4. 实现 xxl-job 会话管理（OnModuleInit）
        - *Goal*: 应用启动时自动登录 xxl-job
        - *Details*: 在 XxlJobService 中实现 OnModuleInit，调用 login 方法，添加 Axios 拦截器自动重新登录
        - *Files*: `backend/src/xxljob/xxljob.service.ts`
        - *Requirements*: US-010

---

### Phase 7: 任务代理模块

- [x] **9. 实现任务相关 API（权限控制）**
    - [x] 9.1. 创建 JobsService
        - *Goal*: 封装任务业务逻辑
        - *Details*: 调用 XxlJobService 和 PermissionsService，实现权限过滤的任务列表
        - *Files*: `backend/src/jobs/jobs.service.ts`
        - *Requirements*: US-002, US-003, US-004
    - [x] 9.2. 创建 JobsController
        - *Goal*: 提供任务操作 API（基于权限）
        - *Details*: 实现 `GET /jobs`（权限过滤）, `GET /jobs/:jobId`（@RequirePermission(VIEW)）, `POST /jobs/:jobId/trigger`（@RequirePermission(EXECUTE)）, `GET /jobs/:jobId/logs`, `PATCH /jobs/:jobId`（@RequirePermission(EDIT)）
        - *Files*: `backend/src/jobs/jobs.controller.ts`
        - *Requirements*: US-002, US-003, US-004
    - [x] 9.3. 创建任务相关 DTO
        - *Goal*: 验证请求参数
        - *Details*: JobQueryDto, ExecuteJobDto, UpdateJobDto, LogQueryDto
        - *Files*: `backend/src/jobs/dto/*.dto.ts`
        - *Requirements*: Design - Jobs Module

---

### Phase 8: 审计日志模块

- [x] **10. 实现审计日志功能**
    - [x] 10.1. 创建 AuditService
        - *Goal*: 记录和查询审计日志
        - *Details*: 实现 `log`, `findAll`, `getStats`, `cleanOldLogs`（删除 6 个月前的日志）, `getUserRecentLogs`, `getJobRecentLogs`
        - *Files*: `backend/src/audit/audit.service.ts`
        - *Requirements*: US-009
    - [x] 10.2. 创建 AuditController
        - *Goal*: 提供审计日志查询 API（仅管理员）
        - *Details*: 实现 `GET /audit`, `GET /audit/stats`（统计）, `GET /audit/users/:userId`, `GET /audit/jobs/:jobId`, `DELETE /audit/cleanup`，使用 AdminGuard
        - *Files*: `backend/src/audit/audit.controller.ts`
        - *Requirements*: US-009
    - [x] 10.3. 审计日志已集成到关键操作
        - *Goal*: 自动记录关键操作
        - *Details*: AuthController（LOGIN, LOGOUT）和 JobsService（EXECUTE_JOB, START_JOB, STOP_JOB, EDIT_JOB）已直接调用 AuditService.log，无需额外拦截器
        - *Files*: `backend/src/auth/auth.controller.ts`, `backend/src/jobs/jobs.service.ts`
        - *Requirements*: US-009, Design - Security Design

---

### Phase 9: 错误处理和安全增强

- [x] **11. 实现全局错误处理和安全配置**
    - [x] 11.1. 创建全局异常过滤器
        - *Goal*: 统一错误响应格式
        - *Details*: 实现 HttpExceptionFilter，捕获所有异常并返回统一格式（error, message, statusCode, timestamp, path）
        - *Files*: `backend/src/filters/http-exception.filter.ts`
        - *Requirements*: NFR-003（错误处理）
    - [x] 11.2. 配置 CORS 和安全头
        - *Goal*: 防止跨域和安全攻击
        - *Details*: 在 main.ts 中配置 enableCors, helmet
        - *Files*: `backend/src/main.ts`
        - *Requirements*: NFR-002（CORS, XSS 防护）
    - [x] 11.3. 配置请求速率限制
        - *Goal*: 防止暴力破解
        - *Details*: 安装 `express-rate-limit`，对 `/auth` 限制 15 分钟 100 次请求
        - *Files*: `backend/src/main.ts`
        - *Requirements*: NFR-002（防止暴力破解）
    - [x] 11.4. 创建健康检查接口
        - *Goal*: 监控系统状态
        - *Details*: 创建 HealthController，实现 `GET /health` 和 `GET /health/detailed` 检查数据库和 xxl-job 连接状态
        - *Files*: `backend/src/health/health.controller.ts`
        - *Requirements*: Design - Monitoring and Logging

---

### Phase 10: 前端开发

- [x] **12. 初始化 React 前端项目**
    - [x] 12.1. 创建 React 项目脚手架
        - *Goal*: 搭建前端项目基础
        - *Details*: 使用 `create-react-app` 或 `Vite` 创建 TypeScript 项目，安装 Ant Design, React Router, Axios
        - *Files*: `frontend/package.json`, `frontend/tsconfig.json`
        - *Requirements*: NFR-004（浏览器支持）
    - [x] 12.2. 配置 Axios 实例和拦截器
        - *Goal*: 封装 API 调用，自动添加 JWT Token
        - *Details*: 创建 axios 实例，添加请求拦截器（添加 Authorization 头），响应拦截器（401 自动刷新 Token）
        - *Files*: `frontend/src/api/client.ts`, `frontend/src/api/services.ts`
        - *Requirements*: US-001, Design - Frontend Design

- [x] **13. 实现认证功能（前端）**
    - [x] 13.1. 创建 AuthContext 和 useAuth Hook
        - *Goal*: 全局认证状态管理
        - *Details*: 实现 login, logout, 从 localStorage 恢复 Token
        - *Files*: `frontend/src/contexts/AuthContext.tsx`
        - *Requirements*: US-001
    - [x] 13.2. 创建登录页面
        - *Goal*: 用户登录界面
        - *Details*: 使用 Ant Design Form 组件，调用 `/auth/login` API，存储 Token 到 localStorage
        - *Files*: `frontend/src/pages/LoginPage.tsx`
        - *Requirements*: US-001
    - [x] 13.3. 创建 ProtectedRoute 组件
        - *Goal*: 保护需要登录的页面
        - *Details*: 检查是否有 Token，没有则重定向到登录页
        - *Files*: `frontend/src/components/ProtectedRoute.tsx`
        - *Requirements*: US-001

- [x] **14. 实现任务列表和操作（前端）**
    - [x] 14.1. 创建 JobList 组件
        - *Goal*: 展示用户有权限的任务列表
        - *Details*: 调用 `GET /jobs` API，使用 Ant Design Table 展示，根据权限显示操作按钮
        - *Files*: `frontend/src/pages/JobListPage.tsx`
        - *Requirements*: US-002
    - [x] 14.2. 创建任务执行功能
        - *Goal*: 任务执行按钮（权限控制）
        - *Details*: 集成在 JobListPage，支持触发执行、启动/停止任务
        - *Files*: `frontend/src/pages/JobListPage.tsx`
        - *Requirements*: US-003
    - [x] 14.3. 创建 JobLogViewer 组件
        - *Goal*: 查看任务执行日志
        - *Details*: 调用 `GET /jobs/:jobId/logs` API，展示日志列表和详情
        - *Files*: `frontend/src/pages/JobLogsPage.tsx`
        - *Requirements*: US-004

- [x] **15. 实现管理员功能（前端）**
    - [x] 15.1. 创建用户管理页面
        - *Goal*: 管理员管理用户（CRUD + 分配角色）
        - *Details*: UserList, UserForm, UserRoleModal 组件，调用 `/users` API
        - *Files*: `frontend/src/pages/UserManagementPage.tsx`
        - *Requirements*: US-007
    - [x] 15.2. 创建角色管理页面
        - *Goal*: 管理员管理角色（CRUD + 配置权限）
        - *Details*: RoleList, RoleForm, RolePermissionModal 组件，调用 `/roles` API
        - *Files*: `frontend/src/pages/RoleManagementPage.tsx`
        - *Requirements*: US-005, US-006

- [x] **16. 实现布局和导航（前端）**
    - [x] 16.1. 创建主布局组件
        - *Goal*: 应用整体布局（Header + Sidebar + Content）
        - *Details*: 使用 Ant Design Layout 组件，包含用户信息、登出按钮、侧边栏菜单
        - *Files*: `frontend/src/components/AppLayout.tsx`
        - *Requirements*: Design - Frontend Design
    - [x] 16.2. 配置路由
        - *Goal*: 定义前端路由
        - *Details*: 使用 React Router，配置 `/login`, `/jobs`, `/logs`, `/users`, `/roles` 路由
        - *Files*: `frontend/src/App.tsx`
        - *Requirements*: Design - Frontend Design

---

### Phase 11: 测试

- [ ] **17. 编写后端单元测试**
    - [x] 17.1. PermissionsService 单元测试
        - *Goal*: 测试权限计算逻辑（OR 逻辑）
        - *Details*: 测试 `getUserJobPermissions` 的多角色权限合并、无权限场景
        - *Files*: `backend/src/permissions/permissions.service.spec.ts`
        - *Requirements*: US-008, NFR-005（测试覆盖率 > 80%）
    - [x] 17.2. AuthService 单元测试
        - *Goal*: 测试密码验证和 JWT 签发
        - *Details*: 测试 bcrypt 加密、Token 签发和验证
        - *Files*: `backend/src/auth/auth.service.spec.ts`
        - *Requirements*: US-001, NFR-002

- [ ] **18. 编写 E2E 测试**
    - [x] 18.1. 任务执行权限验证 E2E 测试
        - *Goal*: 测试完整的权限验证流程
        - *Details*: 测试有权限用户可以执行任务，无权限用户返回 403
        - *Files*: `backend/test/jobs.e2e-spec.ts`
        - *Requirements*: US-003, NFR-005
    - [x] 18.2. 用户登录和认证 E2E 测试
        - *Goal*: 测试认证流程
        - *Details*: 测试正确/错误密码、Token 过期、禁用用户
        - *Files*: `backend/test/auth.e2e-spec.ts`
        - *Requirements*: US-001

- [ ] **19. 编写前端测试**
    - [x] 19.1. JobExecuteButton 组件测试
        - *Goal*: 测试权限控制逻辑
        - *Details*: 测试有权限显示可点击按钮，无权限禁用按钮
        - *Files*: `frontend/src/components/Jobs/JobExecuteButton.test.tsx`
        - *Requirements*: US-003, NFR-005
    - [x] 19.2. useAuth Hook 测试
        - *Goal*: 测试认证状态管理
        - *Details*: 测试登录、登出、Token 恢复
        - *Files*: `frontend/src/hooks/useAuth.test.ts`
        - *Requirements*: US-001

---

### Phase 12: 部署准备

- [ ] **20. 配置 Docker 部署**
    - [x] 20.1. 编写后端 Dockerfile
        - *Goal*: 容器化后端应用
        - *Details*: 多阶段构建，包含 Prisma 迁移命令
        - *Files*: `backend/Dockerfile`
        - *Requirements*: NFR-003（Docker 部署）
    - [x] 20.2. 编写 docker-compose.yml
        - *Goal*: 简化部署流程
        - *Details*: 定义 xxljob-enhance 服务，映射 3000 端口，持久化 SQLite 数据库
        - *Files*: `docker-compose.yml`
        - *Requirements*: NFR-003
    - [ ] 20.3. 创建 .env.example
        - *Goal*: 文档化环境变量
        - *Details*: 列出所有必需的环境变量（DATABASE_URL, JWT_SECRET, XXL_JOB_ADMIN_URL 等）
        - *Files*: `.env.example`
        - *Requirements*: NFR-003

- [ ] **21. 编写文档**
    - [x] 21.1. 编写部署文档
        - *Goal*: 指导用户如何部署
        - *Details*: Docker 部署步骤、环境变量配置、初始管理员账号创建
        - *Files*: `docs/deployment.md`
        - *Requirements*: NFR-005（文档）
    - [x] 21.2. 生成 API 文档（Swagger）
        - *Goal*: 自动生成 API 文档
        - *Details*: 安装 `@nestjs/swagger`，添加装饰器，配置 Swagger UI
        - *Files*: `backend/src/main.ts`
        - *Requirements*: NFR-005（API 文档）

---

## Task Dependencies

### 串行依赖（必须按顺序执行）
- **Task 1 → Task 2**: 项目初始化必须在数据库配置之前完成
- **Task 2 → Task 4**: 数据库（User 表）必须在认证模块之前创建
- **Task 4 → Task 6, 7, 9**: 认证模块必须在其他需要 JWT 认证的模块之前完成
- **Task 5 → Task 9**: PermissionsService 必须在 JobsController 之前完成（JobPermissionGuard 依赖）
- **Task 8 → Task 9**: XxlJobService 必须在 JobsController 之前完成
- **Task 4, 6, 7, 9, 10 → Task 12-16**: 后端 API 必须在前端开发之前完成（或并行开发但需要 API Mock）

### 并行任务（可以同时执行）
- **Task 6, 7, 10**: 用户管理、角色管理、审计日志模块可以并行开发（依赖相同的基础设施）
- **Task 13, 14, 15, 16**: 前端各模块可以并行开发（依赖相同的 API）
- **Task 17, 18, 19**: 单元测试、E2E 测试、前端测试可以并行编写

### 推荐执行顺序（按 Phase）
1. **Phase 1-2**: 基础设施（Task 1-3）
2. **Phase 3-5**: 核心后端逻辑（Task 4-7）
3. **Phase 6-8**: 集成模块（Task 8-10）
4. **Phase 9**: 安全增强（Task 11）
5. **Phase 10**: 前端开发（Task 12-16，可与后端并行）
6. **Phase 11**: 测试（Task 17-19）
7. **Phase 12**: 部署（Task 20-21）

---

## Estimated Timeline

### 后端开发（约 80 小时）
- Phase 1: 项目初始化和基础设施 - **8 小时**
  - Task 1: 2 小时
  - Task 2: 4 小时
  - Task 3: 2 小时
- Phase 2: 认证模块 - **12 小时**
  - Task 4: 12 小时
- Phase 3: 权限核心模块 - **10 小时**
  - Task 5: 10 小时
- Phase 4: 用户管理模块 - **6 小时**
  - Task 6: 6 小时
- Phase 5: 角色管理模块 - **6 小时**
  - Task 7: 6 小时
- Phase 6: xxl-job API 集成 - **8 小时**
  - Task 8: 8 小时
- Phase 7: 任务代理模块 - **8 小时**
  - Task 9: 8 小时
- Phase 8: 审计日志模块 - **6 小时**
  - Task 10: 6 小时
- Phase 9: 错误处理和安全增强 - **6 小时**
  - Task 11: 6 小时

### 前端开发（约 50 小时）
- Phase 10: 前端开发 - **50 小时**
  - Task 12: 初始化 - 4 小时
  - Task 13: 认证功能 - 8 小时
  - Task 14: 任务列表和操作 - 12 小时
  - Task 15: 管理员功能 - 18 小时
  - Task 16: 布局和导航 - 8 小时

### 测试（约 20 小时）
- Phase 11: 测试 - **20 小时**
  - Task 17: 后端单元测试 - 8 小时
  - Task 18: E2E 测试 - 8 小时
  - Task 19: 前端测试 - 4 小时

### 部署和文档（约 10 小时）
- Phase 12: 部署准备 - **10 小时**
  - Task 20: Docker 配置 - 6 小时
  - Task 21: 文档编写 - 4 小时

---

### 总计
- **后端**: 80 小时
- **前端**: 50 小时
- **测试**: 20 小时
- **部署**: 10 小时
- **总计**: **160 小时** (约 20 个工作日)

### 里程碑
- **Milestone 1**: 后端核心功能完成（Phase 1-5，46 小时，约 6 天）
- **Milestone 2**: 后端完整功能（Phase 1-9，80 小时，约 10 天）
- **Milestone 3**: 前后端联调完成（Phase 1-10，130 小时，约 16 天）
- **Milestone 4**: 测试和部署就绪（Phase 1-12，160 小时，约 20 天）
