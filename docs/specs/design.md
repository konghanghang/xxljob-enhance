# xxljob-enhance - Design Document

## Overview

xxljob-enhance 采用 **三层架构 + RBAC 权限模型** 的设计方法：

1. **前端层（React + Ant Design）**: 提供用户界面，展示权限过滤后的任务列表和管理界面
2. **后端层（NestJS + TypeScript）**: 实现业务逻辑、权限验证、API 代理
3. **数据层（SQLite + Prisma）**: 存储用户、角色、权限、审计日志

**核心设计原则**:
- **权限优先**: 所有任务操作必须经过权限验证（Guard 模式）
- **代理模式**: 后端作为 xxl-job API 的反向代理，增加权限控制层
- **无状态认证**: 使用 JWT Token，便于水平扩展
- **渐进式增强**: MVP 采用纯 RBAC，预留升级到混合模型的路径

**系统边界**:
- 本系统**不修改** xxl-job 源码，仅通过 API 调用集成
- 本系统**不存储**任务配置，所有任务数据来自 xxl-job API
- 本系统**仅存储**权限关系（用户-角色-任务）

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                              │
│                    (React + Ant Design)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/HTTPS
                       │ (JWT Token in Authorization Header)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  xxljob-enhance 后端                          │
│                   (NestJS + TypeScript)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Gateway (Controllers)                           │   │
│  │   ├─ /auth    - 登录、刷新 Token                      │   │
│  │   ├─ /users   - 用户管理（管理员）                    │   │
│  │   ├─ /roles   - 角色管理（管理员）                    │   │
│  │   ├─ /jobs    - 任务查询、执行（权限控制）             │   │
│  │   └─ /audit   - 审计日志查询（管理员）                │   │
│  └──────────────────────────────────────────────────────┘   │
│                       │                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Business Layer (Services)                           │   │
│  │   ├─ AuthService         - JWT 签发、验证            │   │
│  │   ├─ UsersService        - 用户 CRUD                │   │
│  │   ├─ RolesService        - 角色 CRUD                │   │
│  │   ├─ PermissionsService  - 权限查询、计算            │   │
│  │   ├─ XxlJobService       - xxl-job API 调用         │   │
│  │   └─ AuditService        - 审计日志记录              │   │
│  └──────────────────────────────────────────────────────┘   │
│                       │                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Security Layer (Guards & Interceptors)              │   │
│  │   ├─ JwtAuthGuard        - 验证 JWT Token           │   │
│  │   ├─ AdminGuard          - 验证管理员身份            │   │
│  │   ├─ JobPermissionGuard  - 验证任务操作权限          │   │
│  │   └─ AuditInterceptor    - 自动记录审计日志          │   │
│  └──────────────────────────────────────────────────────┘   │
│                       │                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Data Access Layer (Prisma)                          │   │
│  │   ├─ User Repository                                 │   │
│  │   ├─ Role Repository                                 │   │
│  │   ├─ Permission Repository                           │   │
│  │   └─ AuditLog Repository                             │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
               ▼                            ▼
     ┌─────────────────┐         ┌──────────────────────┐
     │  SQLite Database │         │   xxl-job Admin API  │
     │  (dev.db)        │         │   (已有系统)          │
     │  - Users         │         │  /jobinfo/pageList   │
     │  - Roles         │         │  /jobinfo/trigger    │
     │  - Permissions   │         │  /joblog/pageList    │
     │  - AuditLogs     │         │  ...                 │
     └─────────────────┘         └──────────────────────┘
```

### 数据流示例：用户执行任务

```
1. 用户点击"执行"按钮
   ↓
2. 前端发送 POST /jobs/101/execute (携带 JWT Token)
   ↓
3. JwtAuthGuard 验证 Token，提取用户信息
   ↓
4. JobPermissionGuard 查询用户对 Job #101 的权限
   ↓
5. PermissionsService 计算权限（查询所有角色权限并合并）
   ↓
6. 如果有 canExecute 权限，继续；否则返回 403 Forbidden
   ↓
7. XxlJobService 调用 xxl-job API: POST /jobinfo/trigger
   ↓
8. AuditInterceptor 记录审计日志（用户、任务、操作、结果）
   ↓
9. 返回结果给前端："任务已触发"
```

## Components and Interfaces

### 1. 认证模块 (Auth Module)

**职责**: 用户登录、JWT Token 管理

**核心接口**:

```typescript
// auth.controller.ts
@Controller('auth')
export class AuthController {
  // 用户登录
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    // 返回: { accessToken, refreshToken, user }
  }

  // 刷新 Token
  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto): Promise<TokenDto> {
    // 返回: { accessToken, refreshToken }
  }

  // 登出（可选，JWT 是无状态的）
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@User() user: UserEntity): Promise<void> {
    // 记录登出日志
  }
}

// auth.service.ts
@Injectable()
export class AuthService {
  async validateUser(username: string, password: string): Promise<User | null>;
  async login(user: User): Promise<{ accessToken: string; refreshToken: string }>;
  async verifyToken(token: string): Promise<JwtPayload>;
}
```

**数据传输对象 (DTO)**:

```typescript
// login.dto.ts
export class LoginDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

// login-response.dto.ts
export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
}
```

---

### 2. 用户管理模块 (Users Module)

**职责**: 用户的创建、编辑、禁用、查询

**核心接口**:

```typescript
// users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)  // 仅管理员可访问
export class UsersController {
  @Get()
  async findAll(): Promise<UserDto[]>;

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<UserDto>;

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserDto>;

  @Patch(':id')
  async update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto): Promise<UserDto>;

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void>;

  // 为用户分配角色
  @Post(':id/roles')
  async assignRoles(@Param('id') id: number, @Body() { roleIds }: { roleIds: number[] }): Promise<void>;

  // 移除用户的角色
  @Delete(':id/roles/:roleId')
  async removeRole(@Param('id') id: number, @Param('roleId') roleId: number): Promise<void>;
}

// users.service.ts
@Injectable()
export class UsersService {
  async create(createUserDto: CreateUserDto): Promise<User>;
  async findAll(): Promise<User[]>;
  async findOne(id: number): Promise<User>;
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User>;
  async remove(id: number): Promise<void>;
  async assignRoles(userId: number, roleIds: number[]): Promise<void>;
  async getUserRoles(userId: number): Promise<Role[]>;
}
```

---

### 3. 角色管理模块 (Roles Module)

**职责**: 角色的创建、编辑、删除、权限配置

**核心接口**:

```typescript
// roles.controller.ts
@Controller('roles')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RolesController {
  @Get()
  async findAll(): Promise<RoleDto[]>;

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<RoleDto>;

  @Post()
  async create(@Body() createRoleDto: CreateRoleDto): Promise<RoleDto>;

  @Patch(':id')
  async update(@Param('id') id: number, @Body() updateRoleDto: UpdateRoleDto): Promise<RoleDto>;

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void>;

  // 为角色配置任务权限
  @Post(':id/permissions')
  async setPermissions(
    @Param('id') id: number,
    @Body() permissionsDto: SetPermissionsDto
  ): Promise<void>;

  // 获取角色的所有权限
  @Get(':id/permissions')
  async getPermissions(@Param('id') id: number): Promise<RoleJobPermission[]>;
}

// roles.service.ts
@Injectable()
export class RolesService {
  async create(createRoleDto: CreateRoleDto): Promise<Role>;
  async findAll(): Promise<Role[]>;
  async findOne(id: number): Promise<Role>;
  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role>;
  async remove(id: number): Promise<void>;
  async setJobPermission(roleId: number, jobId: number, permissions: JobPermissionDto): Promise<void>;
  async getRolePermissions(roleId: number): Promise<RoleJobPermission[]>;
}
```

---

### 4. 权限服务模块 (Permissions Module)

**职责**: 权限查询、计算、验证（核心模块）

**核心接口**:

```typescript
// permissions.service.ts
@Injectable()
export class PermissionsService {
  /**
   * 获取用户对某个任务的权限（所有角色权限的并集）
   */
  async getUserJobPermissions(userId: number, jobId: number): Promise<JobPermissions>;

  /**
   * 获取用户可见的所有任务 ID
   */
  async getUserVisibleJobIds(userId: number): Promise<number[]>;

  /**
   * 检查用户是否有某个操作权限
   */
  async checkPermission(userId: number, jobId: number, action: PermissionAction): Promise<boolean>;

  /**
   * 批量获取用户的所有任务权限（用于前端缓存）
   */
  async getUserAllPermissions(userId: number): Promise<Map<number, JobPermissions>>;
}

// 权限类型定义
export interface JobPermissions {
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
}

export enum PermissionAction {
  VIEW = 'view',
  EXECUTE = 'execute',
  EDIT = 'edit',
}
```

---

### 5. xxl-job 集成模块 (XxlJob Module)

**职责**: 调用 xxl-job API，维护会话

**核心接口**:

```typescript
// xxljob.service.ts
@Injectable()
export class XxlJobService {
  private axiosInstance: AxiosInstance;
  private sessionCookie: string | null = null;

  /**
   * 登录 xxl-job（系统启动时调用）
   */
  async login(): Promise<void>;

  /**
   * 获取任务列表
   */
  async getJobList(params?: {
    jobGroup?: number;
    triggerStatus?: number;
    jobDesc?: string;
    executorHandler?: string;
    start?: number;
    length?: number;
  }): Promise<XxlJobPageResult<XxlJob>>;

  /**
   * 获取任务详情
   */
  async getJobDetail(jobId: number): Promise<XxlJob>;

  /**
   * 触发任务执行
   */
  async triggerJob(jobId: number, executorParam?: string, addressList?: string): Promise<void>;

  /**
   * 获取执行日志
   */
  async getJobLog(params: {
    jobId: number;
    logDateTim?: number;
    start?: number;
    length?: number;
  }): Promise<XxlJobPageResult<XxlJobLog>>;

  /**
   * 更新任务配置（需要 canEdit 权限）
   */
  async updateJob(jobId: number, updateData: Partial<XxlJob>): Promise<void>;

  /**
   * 启动/停止任务
   */
  async startJob(jobId: number): Promise<void>;
  async stopJob(jobId: number): Promise<void>;
}

// xxl-job 数据类型
export interface XxlJob {
  id: number;
  jobGroup: number;
  jobDesc: string;
  addTime: string;
  updateTime: string;
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
```

---

### 6. 任务代理模块 (Jobs Module)

**职责**: 为前端提供任务相关 API，集成权限验证和 xxl-job 调用

**核心接口**:

```typescript
// jobs.controller.ts
@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  /**
   * 获取用户可见的任务列表（基于权限过滤）
   */
  @Get()
  async findAll(@User() user: UserEntity, @Query() query: JobQueryDto): Promise<JobDto[]>;

  /**
   * 获取任务详情（需要 canView 权限）
   */
  @Get(':jobId')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.VIEW)
  async findOne(@Param('jobId') jobId: number): Promise<JobDto>;

  /**
   * 执行任务（需要 canExecute 权限）
   */
  @Post(':jobId/execute')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.EXECUTE)
  async execute(
    @Param('jobId') jobId: number,
    @Body() executeDto: ExecuteJobDto,
    @User() user: UserEntity
  ): Promise<void>;

  /**
   * 获取任务执行日志（需要 canView 权限）
   */
  @Get(':jobId/logs')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.VIEW)
  async getLogs(
    @Param('jobId') jobId: number,
    @Query() query: LogQueryDto
  ): Promise<XxlJobLog[]>;

  /**
   * 更新任务配置（需要 canEdit 权限）
   */
  @Patch(':jobId')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.EDIT)
  async update(
    @Param('jobId') jobId: number,
    @Body() updateDto: UpdateJobDto,
    @User() user: UserEntity
  ): Promise<void>;

  /**
   * 启动/停止任务（需要 canEdit 权限）
   */
  @Post(':jobId/start')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.EDIT)
  async start(@Param('jobId') jobId: number): Promise<void>;

  @Post(':jobId/stop')
  @UseGuards(JobPermissionGuard)
  @RequirePermission(PermissionAction.EDIT)
  async stop(@Param('jobId') jobId: number): Promise<void>;
}
```

---

### 7. 审计日志模块 (Audit Module)

**职责**: 记录和查询审计日志

**核心接口**:

```typescript
// audit.service.ts
@Injectable()
export class AuditService {
  async log(entry: CreateAuditLogDto): Promise<void>;
  async findAll(filters?: AuditLogFilters): Promise<AuditLog[]>;
  async cleanOldLogs(beforeDate: Date): Promise<number>; // 返回删除数量
}

// audit.controller.ts
@Controller('audit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditController {
  @Get()
  async findAll(@Query() filters: AuditLogFilters): Promise<AuditLogDto[]>;

  @Get('stats')
  async getStats(@Query() query: { startDate?: string; endDate?: string }): Promise<AuditStats>;
}
```

---

## Data Models

### Prisma Schema（完整版）

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ==================== 用户表 ====================
model User {
  id              Int                    @id @default(autoincrement())
  username        String                 @unique
  password        String                 // bcrypt 加密
  email           String?                @unique
  isAdmin         Boolean                @default(false)
  isActive        Boolean                @default(true)
  roles           UserRole[]
  auditLogs       AuditLog[]
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([username])
  @@index([email])
}

// ==================== 角色表 ====================
model Role {
  id          Int                  @id @default(autoincrement())
  name        String               @unique
  description String?
  users       UserRole[]
  permissions RoleJobPermission[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([name])
}

// ==================== 用户-角色关联表（多对多） ====================
model UserRole {
  userId     Int
  roleId     Int
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())
  assignedBy Int?     // 由哪个管理员分配（可选）

  @@id([userId, roleId])
  @@index([userId])
  @@index([roleId])
}

// ==================== 角色-任务权限表 ====================
model RoleJobPermission {
  id         Int      @id @default(autoincrement())
  roleId     Int
  jobId      Int      // xxl-job 中的任务 ID
  appName    String   // xxl-job 执行器名称（用于显示）
  canView    Boolean  @default(true)
  canExecute Boolean  @default(false)
  canEdit    Boolean  @default(false)
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([roleId, jobId])
  @@index([jobId])
  @@index([roleId])
}

// ==================== 审计日志表 ====================
model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  jobId     Int?     // 任务 ID（如果操作与任务相关）
  action    String   // LOGIN, EXECUTE_JOB, EDIT_JOB, ASSIGN_ROLE, CREATE_USER, etc.
  target    String?  // 操作目标的描述
  result    String   // SUCCESS, FAILED
  message   String?  // 详细信息或错误信息
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([jobId])
  @@index([action])
  @@index([createdAt])
}
```

### 数据库迁移命令

```bash
# 生成迁移文件
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate

# 查看数据库（Prisma Studio）
npx prisma studio
```

---

## Security Design

### 1. 认证安全

**JWT Token 配置**:

```typescript
// jwt.config.ts
export const jwtConfig = {
  secret: process.env.JWT_SECRET,  // 至少 256 位随机字符串
  accessTokenExpiration: '1h',
  refreshTokenExpiration: '7d',
  issuer: 'xxljob-enhance',
  audience: 'xxljob-enhance-users',
};
```

**密码加密**:

```typescript
// auth.service.ts
import * as bcrypt from 'bcrypt';

async hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

### 2. 权限验证（Guards）

**JobPermissionGuard 实现**:

```typescript
// guards/job-permission.guard.ts
@Injectable()
export class JobPermissionGuard implements CanActivate {
  constructor(
    private permissionsService: PermissionsService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 管理员绕过权限检查
    if (user.isAdmin) {
      return true;
    }

    const jobId = parseInt(request.params.jobId);
    const requiredAction = this.reflector.get<PermissionAction>(
      'permission',
      context.getHandler()
    );

    const hasPermission = await this.permissionsService.checkPermission(
      user.userId,
      jobId,
      requiredAction
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `您没有权限执行此操作：${requiredAction} on Job #${jobId}`
      );
    }

    return true;
  }
}
```

**装饰器定义**:

```typescript
// decorators/require-permission.decorator.ts
export const RequirePermission = (action: PermissionAction) =>
  SetMetadata('permission', action);
```

---

### 3. API 安全

**请求速率限制**（防止暴力破解）:

```typescript
// main.ts
import { rateLimit } from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 最多 100 个请求
  message: '请求过于频繁，请稍后再试',
});

app.use('/auth/login', limiter);
```

**CORS 配置**:

```typescript
// main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

---

## Frontend Design

### 组件结构

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx          # 顶部导航栏（用户信息、登出）
│   │   ├── Sidebar.tsx         # 侧边栏（导航菜单）
│   │   └── MainLayout.tsx      # 主布局容器
│   ├── Jobs/
│   │   ├── JobList.tsx         # 任务列表（基于权限过滤）
│   │   ├── JobDetail.tsx       # 任务详情
│   │   ├── JobExecuteButton.tsx # 执行按钮（权限控制）
│   │   └── JobLogViewer.tsx    # 日志查看器
│   ├── Users/
│   │   ├── UserList.tsx        # 用户列表（管理员）
│   │   ├── UserForm.tsx        # 用户创建/编辑表单
│   │   └── UserRoleModal.tsx   # 分配角色弹窗
│   ├── Roles/
│   │   ├── RoleList.tsx        # 角色列表
│   │   ├── RoleForm.tsx        # 角色创建/编辑
│   │   └── RolePermissionModal.tsx # 权限配置弹窗
│   └── Audit/
│       ├── AuditLogList.tsx    # 审计日志列表
│       └── AuditStats.tsx      # 审计统计图表
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── JobsPage.tsx
│   ├── UsersPage.tsx (管理员)
│   ├── RolesPage.tsx (管理员)
│   └── AuditPage.tsx (管理员)
├── services/
│   ├── api.ts                  # Axios 实例配置
│   ├── authService.ts          # 登录、Token 刷新
│   ├── jobsService.ts          # 任务相关 API
│   ├── usersService.ts         # 用户管理 API
│   └── rolesService.ts         # 角色管理 API
├── hooks/
│   ├── useAuth.ts              # 认证状态管理
│   ├── usePermissions.ts       # 权限检查 Hook
│   └── useJobList.ts           # 任务列表数据
├── contexts/
│   └── AuthContext.tsx         # 全局认证上下文
└── utils/
    ├── permissions.ts          # 权限工具函数
    └── constants.ts            # 常量定义
```

### 核心 Hook 实现

**useAuth Hook**:

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // 验证 Token 并获取用户信息
      authService.getCurrentUser().then(setUser).catch(() => setUser(null));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const { accessToken, refreshToken, user } = await authService.login(username, password);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return { user, loading, login, logout, isAdmin: user?.isAdmin ?? false };
};
```

**usePermissions Hook**:

```typescript
// hooks/usePermissions.ts
export const usePermissions = (jobId: number) => {
  const [permissions, setPermissions] = useState<JobPermissions | null>(null);

  useEffect(() => {
    jobsService.getJobPermissions(jobId).then(setPermissions);
  }, [jobId]);

  return {
    canView: permissions?.canView ?? false,
    canExecute: permissions?.canExecute ?? false,
    canEdit: permissions?.canEdit ?? false,
    loading: permissions === null,
  };
};
```

---

## Error Handling

### 错误分类

1. **业务错误**（400 系列）
   - 400 Bad Request: 请求参数错误
   - 401 Unauthorized: 未登录或 Token 过期
   - 403 Forbidden: 无权限
   - 404 Not Found: 资源不存在
   - 409 Conflict: 资源冲突（如用户名重复）

2. **系统错误**（500 系列）
   - 500 Internal Server Error: 服务器内部错误
   - 502 Bad Gateway: xxl-job API 调用失败
   - 503 Service Unavailable: 数据库连接失败

### 统一错误响应格式

```typescript
// 成功响应
{
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "error": "PERMISSION_DENIED",
  "message": "您没有权限执行此操作：execute on Job #101",
  "statusCode": 403,
  "timestamp": "2025-01-18T05:30:00Z",
  "path": "/jobs/101/execute"
}
```

### 全局异常过滤器

```typescript
// filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    const errorResponse = {
      error: exception.name,
      message: exception.message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url}`,
      JSON.stringify(errorResponse)
    );

    response.status(status).json(errorResponse);
  }
}
```

### 前端错误处理

```typescript
// services/api.ts
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token 过期，尝试刷新
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { accessToken } = await authService.refresh(refreshToken);
          localStorage.setItem('accessToken', accessToken);
          // 重试原请求
          error.config.headers['Authorization'] = `Bearer ${accessToken}`;
          return axios.request(error.config);
        } catch {
          // 刷新失败，跳转登录页
          window.location.href = '/login';
        }
      }
    }

    // 显示友好错误提示
    message.error(error.response?.data?.message || '操作失败');
    return Promise.reject(error);
  }
);
```

---

## Testing Strategy

### 1. 单元测试（Jest）

**测试覆盖目标**:
- 核心业务逻辑：PermissionsService, AuthService
- 工具函数：权限计算、密码加密
- 覆盖率目标：> 80%

**示例测试**:

```typescript
// permissions.service.spec.ts
describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionsService, PrismaService],
    }).compile();

    service = module.get(PermissionsService);
    prisma = module.get(PrismaService);
  });

  describe('getUserJobPermissions', () => {
    it('应该返回所有角色权限的并集（OR 逻辑）', async () => {
      // 模拟数据
      jest.spyOn(prisma.roleJobPermission, 'findMany').mockResolvedValue([
        { roleId: 1, jobId: 101, canView: true, canExecute: false, canEdit: false },
        { roleId: 2, jobId: 101, canView: false, canExecute: true, canEdit: false },
      ]);

      const result = await service.getUserJobPermissions(1, 101);

      expect(result).toEqual({
        canView: true,
        canExecute: true,
        canEdit: false,
      });
    });

    it('用户没有任何角色时，应该返回全部 false', async () => {
      jest.spyOn(prisma.roleJobPermission, 'findMany').mockResolvedValue([]);

      const result = await service.getUserJobPermissions(1, 101);

      expect(result).toEqual({
        canView: false,
        canExecute: false,
        canEdit: false,
      });
    });
  });
});
```

---

### 2. 集成测试（E2E）

**测试场景**:

```typescript
// test/jobs.e2e-spec.ts
describe('Jobs API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    // 启动测试应用
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 登录获取 Token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testuser', password: 'password' });

    accessToken = response.body.accessToken;
  });

  it('有 canExecute 权限的用户应该能执行任务', () => {
    return request(app.getHttpServer())
      .post('/jobs/101/execute')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  it('没有 canExecute 权限的用户应该返回 403', () => {
    return request(app.getHttpServer())
      .post('/jobs/102/execute')  // 假设用户没有权限
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error).toBe('PERMISSION_DENIED');
      });
  });
});
```

---

### 3. 前端测试（React Testing Library）

```typescript
// components/Jobs/JobExecuteButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { JobExecuteButton } from './JobExecuteButton';

describe('JobExecuteButton', () => {
  it('有权限时应该显示可点击的按钮', () => {
    render(<JobExecuteButton jobId={101} canExecute={true} />);
    const button = screen.getByRole('button', { name: /执行/ });
    expect(button).toBeEnabled();
  });

  it('无权限时应该禁用按钮', () => {
    render(<JobExecuteButton jobId={101} canExecute={false} />);
    const button = screen.getByRole('button', { name: /执行/ });
    expect(button).toBeDisabled();
  });

  it('点击按钮应该调用 API', async () => {
    const mockExecute = jest.fn();
    render(<JobExecuteButton jobId={101} canExecute={true} onExecute={mockExecute} />);

    fireEvent.click(screen.getByRole('button', { name: /执行/ }));
    expect(mockExecute).toHaveBeenCalledWith(101);
  });
});
```

---

## Deployment

### Docker 部署

**Dockerfile**:

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npx prisma generate
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --production

# 复制构建产物和 Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  xxljob-enhance:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/prod.db
      - JWT_SECRET=${JWT_SECRET}
      - XXL_JOB_ADMIN_URL=http://xxljob-admin:8080/xxl-job-admin
      - XXL_JOB_USERNAME=admin
      - XXL_JOB_PASSWORD=123456
    volumes:
      - ./data:/app/data  # 持久化 SQLite 数据库
    restart: unless-stopped
```

**启动命令**:

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## Performance Optimization

### 1. 权限缓存

```typescript
// 使用 @nestjs/cache-manager
@Injectable()
export class PermissionsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getUserJobPermissions(userId: number, jobId: number) {
    const cacheKey = `perm:${userId}:${jobId}`;

    // 尝试从缓存获取
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // 查询数据库
    const permissions = await this.calculatePermissions(userId, jobId);

    // 缓存 5 分钟
    await this.cacheManager.set(cacheKey, permissions, { ttl: 300 });

    return permissions;
  }
}
```

### 2. 数据库索引优化

已在 Prisma Schema 中定义关键索引：
- `User.username`, `User.email`
- `UserRole.userId`, `UserRole.roleId`
- `RoleJobPermission.jobId`, `RoleJobPermission.roleId`
- `AuditLog.userId`, `AuditLog.createdAt`

### 3. 批量查询优化

```typescript
// 一次性获取用户所有权限
async getUserAllPermissions(userId: number) {
  const permissions = await this.prisma.roleJobPermission.findMany({
    where: {
      role: {
        users: {
          some: { userId }
        }
      }
    }
  });

  // 转换为 Map 便于快速查找
  const permMap = new Map<number, JobPermissions>();

  for (const perm of permissions) {
    const existing = permMap.get(perm.jobId) || {
      canView: false,
      canExecute: false,
      canEdit: false,
    };

    permMap.set(perm.jobId, {
      canView: existing.canView || perm.canView,
      canExecute: existing.canExecute || perm.canExecute,
      canEdit: existing.canEdit || perm.canEdit,
    });
  }

  return permMap;
}
```

---

## Monitoring and Logging

### 日志策略

```typescript
// main.ts
import { Logger } from '@nestjs/common';

const logger = new Logger('Bootstrap');

// 启动日志
logger.log('Application is starting...');
logger.log(`Environment: ${process.env.NODE_ENV}`);
logger.log(`xxl-job URL: ${process.env.XXL_JOB_ADMIN_URL}`);

// 请求日志（使用中间件）
app.use((req, res, next) => {
  logger.log(`${req.method} ${req.url}`);
  next();
});
```

### 健康检查

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: await this.checkDatabase(),
      xxljob: await this.checkXxlJob(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private async checkXxlJob() {
    try {
      await this.xxlJobService.getJobList({ length: 1 });
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }
}
```

---

## Migration from Pure RBAC to Hybrid Model

参见 `memory/权限模型设计-RBAC-基于角色的访问控制.md` 的"Migration Strategy"部分。

关键步骤：
1. 添加 `UserJobPermission` 表
2. 修改权限查询逻辑（合并直接权限和角色权限）
3. 添加管理界面
4. 实现权限过期清理
