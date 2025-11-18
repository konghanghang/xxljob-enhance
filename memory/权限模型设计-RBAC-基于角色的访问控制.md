---
id: mem-002
type: decision
title: 权限模型设计：采用 RBAC（基于角色的访问控制）
date: 2025-01-18
tags: [architecture, permission, rbac, security, design]
---

## Summary
采用 **RBAC (Role-Based Access Control)** 权限模型，通过"用户-角色-权限"三层结构实现任务级别的细粒度权限控制，替代 xxl-job 原生的执行器级别权限。

## Context
- **基于**: [[技术栈选型-NodeJS-React-SQLite]] (mem-001)
- **解决问题**: xxl-job 原生仅支持执行器（AppName）维度的权限控制，无法为单个任务分配权限
- **用户规模**: 100-200 人
- **导致**: 数据库 Schema 设计、权限验证逻辑、管理界面设计

## Decision: 采用纯 RBAC 模型（方案 B）

### 权限模型结构

```
User (用户) ──多对多──> Role (角色) ──多对多──> JobPermission (任务权限)
    |                       |                          |
    └─ isAdmin             └─ name (角色名)           └─ jobId (xxl-job 任务 ID)
                              description                canView (可查看)
                                                         canExecute (可执行)
                                                         canEdit (可编辑)
```

### 核心概念

#### 1. User（用户）
- 系统的实际使用者
- 可以拥有多个角色
- `isAdmin` 字段标识是否为系统管理员（可分配角色和权限）

#### 2. Role（角色）
- 权限的集合，代表某种职能或职位
- 示例：`数据分析师`、`运维工程师`、`开发人员`、`只读用户`
- 一个角色可以分配给多个用户
- 一个角色可以拥有多个任务的权限

#### 3. JobPermission（任务权限）
- 角色对某个 xxl-job 任务的操作权限
- 权限类型：
  - `canView`: 是否可以查看任务配置和日志
  - `canExecute`: 是否可以手动触发任务执行
  - `canEdit`: 是否可以修改任务配置（调度时间、参数等）

### 权限计算逻辑

用户对某个任务的最终权限 = **所有角色权限的并集（OR 逻辑）**

```typescript
// 示例：
用户张三拥有两个角色：
  - 角色 A: Job #101 (canView=true, canExecute=false)
  - 角色 B: Job #101 (canView=false, canExecute=true)

最终张三对 Job #101 的权限：
  canView = true OR false = true
  canExecute = false OR true = true
```

---

## Alternatives Considered

### ❌ 方案 A: 直接绑定（User ↔ JobPermission）

**为什么不选**:
- 批量管理困难：为 10 个人分配相同权限需要操作 10 次
- 数据量大：100 用户 × 50 任务 = 5000 条权限记录
- 维护成本高：任务下线需要删除所有用户的相关权限

**适用场景**:
- 用户 < 50
- 每个用户权限组合完全不同
- 快速原型验证

---

### 🔺 方案 C: 混合模型（RBAC + 直接权限）

**为什么暂不选**:
- 实现复杂度高（权限查询需要合并两个来源）
- 当前需求下 RBAC 已足够满足 80% 场景
- 可以在后期根据实际需求升级

**升级触发条件**:
1. 超过 10% 的用户需要特殊权限（不属于任何角色）
2. 频繁出现"临时权限"需求（如：请假期间授权他人）
3. 需要临时撤销某个用户的某项权限（而不影响其角色）

**升级路径**: 见本文档末尾的"迁移策略"部分

---

## Database Schema Design

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ========== 用户表 ==========
model User {
  id        Int        @id @default(autoincrement())
  username  String     @unique
  password  String     // bcrypt 加密存储
  email     String?    @unique
  isAdmin   Boolean    @default(false)
  isActive  Boolean    @default(true)  // 账号是否启用
  roles     UserRole[]
  auditLogs AuditLog[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([username])
}

// ========== 角色表 ==========
model Role {
  id          Int                  @id @default(autoincrement())
  name        String               @unique  // "数据分析师"、"运维工程师"
  description String?              // 角色说明
  users       UserRole[]
  permissions RoleJobPermission[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([name])
}

// ========== 用户-角色关联表（多对多） ==========
model UserRole {
  userId     Int
  roleId     Int
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())  // 分配时间
  assignedBy Int?     // 由哪个管理员分配（可选）

  @@id([userId, roleId])
  @@index([userId])
  @@index([roleId])
}

// ========== 角色-任务权限表 ==========
model RoleJobPermission {
  id         Int      @id @default(autoincrement())
  roleId     Int
  jobId      Int      // xxl-job 中的任务 ID
  appName    String   // xxl-job 执行器名称（用于 API 调用）
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

// ========== 操作审计日志 ==========
model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  jobId     Int?
  action    String   // LOGIN, VIEW_JOB, EXECUTE_JOB, EDIT_JOB, ASSIGN_ROLE, etc.
  target    String?  // 操作目标的描述（如角色名、任务名）
  result    String   // SUCCESS, FAILED
  message   String?  // 错误信息或详细说明
  ipAddress String?
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([jobId])
  @@index([action])
  @@index([createdAt])
}
```

### 数据量估算（100 用户场景）

| 表名 | 数据量估算 | 说明 |
|------|----------|------|
| User | 100 条 | 系统用户 |
| Role | 5-15 条 | 角色数量（如：管理员、开发、测试、运维、数据分析师） |
| UserRole | 100-200 条 | 平均每人 1-2 个角色 |
| RoleJobPermission | 50-200 条 | 假设 10 个角色，每个角色管理 5-20 个任务 |
| AuditLog | 持续增长 | 建议定期归档（保留近 6 个月） |

**对比直接绑定模型**:
- 直接绑定需要 5000 条权限记录（100 用户 × 50 任务）
- RBAC 仅需 ~200 条（减少 96%）

---

## API Design

### 权限查询服务

```typescript
// permissions.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户对某个任务的权限
   * @returns { canView, canExecute, canEdit }
   */
  async getUserJobPermissions(userId: number, jobId: number) {
    // 查询用户所有角色对该任务的权限
    const permissions = await this.prisma.roleJobPermission.findMany({
      where: {
        jobId,
        role: {
          users: {
            some: { userId }
          }
        }
      }
    });

    // 没有任何角色授予权限
    if (permissions.length === 0) {
      return { canView: false, canExecute: false, canEdit: false };
    }

    // OR 逻辑：任一角色有权限即授予
    return {
      canView: permissions.some(p => p.canView),
      canExecute: permissions.some(p => p.canExecute),
      canEdit: permissions.some(p => p.canEdit),
    };
  }

  /**
   * 获取用户可见的所有任务 ID 列表
   * 用于过滤任务列表
   */
  async getUserVisibleJobIds(userId: number): Promise<number[]> {
    const permissions = await this.prisma.roleJobPermission.findMany({
      where: {
        canView: true,
        role: {
          users: {
            some: { userId }
          }
        }
      },
      select: { jobId: true },
      distinct: ['jobId']
    });

    return permissions.map(p => p.jobId);
  }

  /**
   * 检查用户是否可以执行某个操作
   * @param action - 'view' | 'execute' | 'edit'
   */
  async checkPermission(
    userId: number,
    jobId: number,
    action: 'view' | 'execute' | 'edit'
  ): Promise<boolean> {
    const permissions = await this.getUserJobPermissions(userId, jobId);

    switch (action) {
      case 'view':
        return permissions.canView;
      case 'execute':
        return permissions.canExecute;
      case 'edit':
        return permissions.canEdit;
      default:
        return false;
    }
  }

  /**
   * 批量分配角色给用户（管理员功能）
   */
  async assignRoleToUsers(roleId: number, userIds: number[]) {
    await this.prisma.userRole.createMany({
      data: userIds.map(userId => ({ userId, roleId })),
      skipDuplicates: true  // 忽略已存在的关联
    });
  }

  /**
   * 为角色添加任务权限（管理员功能）
   */
  async addJobPermissionToRole(
    roleId: number,
    jobId: number,
    appName: string,
    permissions: { canView?: boolean; canExecute?: boolean; canEdit?: boolean }
  ) {
    return this.prisma.roleJobPermission.upsert({
      where: { roleId_jobId: { roleId, jobId } },
      update: permissions,
      create: {
        roleId,
        jobId,
        appName,
        canView: permissions.canView ?? true,
        canExecute: permissions.canExecute ?? false,
        canEdit: permissions.canEdit ?? false,
      }
    });
  }
}
```

### 权限守卫（Guard）

```typescript
// guards/job-permission.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class JobPermissionGuard implements CanActivate {
  constructor(
    private permissionsService: PermissionsService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;  // 来自 JWT 认证

    // 管理员绕过权限检查
    if (user.isAdmin) {
      return true;
    }

    const jobId = parseInt(request.params.jobId || request.params.id);
    const requiredAction = this.getRequiredAction(context);

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

  private getRequiredAction(context: ExecutionContext): 'view' | 'execute' | 'edit' {
    // 从装饰器元数据读取（可自定义）
    const action = this.reflector.get<string>('permission', context.getHandler());
    if (action) return action as any;

    // 根据 HTTP 方法推断
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.route.path;

    if (path.includes('/execute')) return 'execute';
    if (method === 'GET') return 'view';
    if (['PUT', 'PATCH', 'POST'].includes(method)) return 'edit';

    return 'view';
  }
}
```

### 控制器使用示例

```typescript
// jobs.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JobPermissionGuard } from '../guards/job-permission.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)  // 必须先登录
export class JobsController {

  @Get()
  async listJobs(@User() user) {
    // 获取用户可见的任务 ID 列表
    const visibleJobIds = await this.permissionsService.getUserVisibleJobIds(user.userId);

    // 调用 xxl-job API 获取任务列表，按权限过滤
    const allJobs = await this.xxlJobService.getJobList();
    return allJobs.filter(job => visibleJobIds.includes(job.id));
  }

  @Get(':jobId')
  @UseGuards(JobPermissionGuard)  // 自动检查 canView 权限
  async getJobDetail(@Param('jobId') jobId: number) {
    return this.xxlJobService.getJobDetail(jobId);
  }

  @Post(':jobId/execute')
  @UseGuards(JobPermissionGuard)  // 自动检查 canExecute 权限
  async executeJob(@Param('jobId') jobId: number, @User() user) {
    // 记录审计日志
    await this.auditService.log({
      userId: user.userId,
      jobId,
      action: 'EXECUTE_JOB',
      result: 'SUCCESS'
    });

    return this.xxlJobService.triggerJob(jobId);
  }
}
```

---

## UI Design Implications

### 用户界面

**任务列表页面**:
```
┌────────────────────────────────────────────┐
│ 我的任务列表                                │
├────────────────────────────────────────────┤
│ 任务ID  任务名称        执行器    操作      │
│ #101   数据同步任务     data-app  [查看][执行]│
│ #102   报表生成任务     report    [查看]    │
│ #103   数据清理任务     clean     [查看][执行][编辑]│
└────────────────────────────────────────────┘

说明：
- 仅显示用户有 canView 权限的任务
- 操作按钮根据权限动态显示（无权限的按钮不显示或置灰）
```

### 管理员界面

**角色管理页面**:
```
┌────────────────────────────────────────────┐
│ 角色列表                        [+ 新建角色]│
├────────────────────────────────────────────┤
│ 数据分析师      (12 个用户, 8 个任务权限)   │
│   └─ [编辑] [删除] [分配用户] [管理权限]   │
│                                            │
│ 运维工程师      (5 个用户, 15 个任务权限)   │
│   └─ [编辑] [删除] [分配用户] [管理权限]   │
└────────────────────────────────────────────┘
```

**权限分配页面**（点击"管理权限"后）:
```
┌────────────────────────────────────────────┐
│ 角色：数据分析师 - 任务权限设置             │
├────────────────────────────────────────────┤
│ 任务ID  任务名称        查看  执行  编辑    │
│ #101   数据同步任务     [✓]  [✓]  [ ]     │
│ #102   报表生成任务     [✓]  [✓]  [✓]     │
│ #103   数据清理任务     [✓]  [ ]  [ ]     │
│                                            │
│               [保存] [取消]                 │
└────────────────────────────────────────────┘
```

**用户管理页面**:
```
┌────────────────────────────────────────────┐
│ 用户列表                        [+ 新建用户]│
├────────────────────────────────────────────┤
│ 张三 (zhangsan)    角色：数据分析师         │
│   └─ [编辑] [分配角色] [查看权限详情]       │
│                                            │
│ 李四 (lisi)        角色：运维工程师、开发人员│
│   └─ [编辑] [分配角色] [查看权限详情]       │
└────────────────────────────────────────────┘
```

---

## Performance Considerations

### 权限查询优化

**问题**: 每次操作都查询数据库会导致性能问题

**解决方案**:

#### 1. 用户权限缓存（推荐）
```typescript
// 使用 Redis 或内存缓存
@Injectable()
export class PermissionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache
  ) {}

  async getUserJobPermissions(userId: number, jobId: number) {
    const cacheKey = `perm:${userId}:${jobId}`;

    // 尝试从缓存获取
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 查询数据库
    const permissions = await this.queryPermissionsFromDB(userId, jobId);

    // 缓存 5 分钟
    await this.cache.set(cacheKey, permissions, { ttl: 300 });

    return permissions;
  }
}
```

#### 2. JWT Token 中包含角色 ID（仅适合角色变更不频繁的场景）
```typescript
// 登录时生成 Token
const payload = {
  sub: user.id,
  username: user.username,
  roleIds: user.roles.map(r => r.roleId)  // 包含角色 ID
};
const token = this.jwtService.sign(payload);
```

#### 3. 批量预加载（列表页面）
```typescript
// 一次查询获取用户所有权限
const allPermissions = await this.permissionsService.getUserAllPermissions(userId);

// 在内存中过滤
const filteredJobs = allJobs.filter(job =>
  allPermissions[job.id]?.canView
);
```

### 数据库索引策略

关键索引已在 Schema 中定义：
```prisma
// UserRole 表
@@index([userId])   // 查询某用户的所有角色
@@index([roleId])   // 查询某角色的所有用户

// RoleJobPermission 表
@@index([jobId])    // 查询某任务的所有角色权限
@@index([roleId])   // 查询某角色的所有任务权限
@@unique([roleId, jobId])  // 防止重复，同时加速查询
```

---

## Security Considerations

### 1. 权限提升攻击防护
```typescript
// ❌ 错误示例：直接信任客户端传递的 jobId
@Post('jobs/:jobId/execute')
async execute(@Param('jobId') jobId: number) {
  // 攻击者可以遍历 jobId 尝试执行无权限的任务
}

// ✅ 正确示例：使用 Guard 验证权限
@Post('jobs/:jobId/execute')
@UseGuards(JobPermissionGuard)  // 自动验证权限
async execute(@Param('jobId') jobId: number) {
  // Guard 已确保用户有 canExecute 权限
}
```

### 2. 防止角色劫持
```typescript
// 管理员分配角色时，必须验证操作者身份
@Post('roles/:roleId/users')
@UseGuards(AdminGuard)  // 仅管理员可操作
async assignRole(
  @Param('roleId') roleId: number,
  @Body() { userIds }: { userIds: number[] },
  @User() admin
) {
  // 记录审计日志
  await this.auditService.log({
    userId: admin.userId,
    action: 'ASSIGN_ROLE',
    target: `Role ${roleId} to users ${userIds.join(',')}`,
    result: 'SUCCESS'
  });

  return this.permissionsService.assignRoleToUsers(roleId, userIds);
}
```

### 3. 敏感操作审计
所有权限变更操作必须记录审计日志：
- 分配/撤销角色
- 修改角色权限
- 用户执行任务
- 修改任务配置

---

## Migration Strategy: 升级到混合模型

### 触发条件
当满足以下任一条件时，考虑升级：
1. 超过 10% 的用户需要特殊权限（不符合任何角色）
2. 频繁出现临时权限需求（> 5 次/周）
3. 需要临时撤销权限但不想修改角色定义

### 迁移步骤

#### Step 1: 添加直接权限表
```prisma
// 新增表（保留原有表）
model UserJobPermission {
  userId     Int
  jobId      Int
  appName    String
  canView    Boolean  @default(true)
  canExecute Boolean  @default(false)
  canEdit    Boolean  @default(false)
  override   Boolean  @default(false)  // 是否覆盖角色权限
  reason     String?  // 分配原因（如"临时授权"）
  expiresAt  DateTime?  // 过期时间（可选）
  user       User     @relation(fields: [userId], references: [id])
  createdAt  DateTime @default(now())

  @@id([userId, jobId])
  @@index([userId])
  @@index([jobId])
  @@index([expiresAt])  // 用于定期清理过期权限
}
```

#### Step 2: 修改权限查询逻辑
```typescript
async getUserJobPermissions(userId: number, jobId: number) {
  // 1. 查询直接权限
  const directPerm = await this.prisma.userJobPermission.findUnique({
    where: { userId_jobId: { userId, jobId } }
  });

  // 如果有直接权限且标记为覆盖，直接返回
  if (directPerm?.override) {
    return {
      canView: directPerm.canView,
      canExecute: directPerm.canExecute,
      canEdit: directPerm.canEdit,
      source: 'direct-override'
    };
  }

  // 2. 查询角色权限
  const rolePerms = await this.prisma.roleJobPermission.findMany({
    where: {
      jobId,
      role: { users: { some: { userId } } }
    }
  });

  // 3. 合并权限（OR 逻辑）
  const merged = {
    canView: rolePerms.some(p => p.canView),
    canExecute: rolePerms.some(p => p.canExecute),
    canEdit: rolePerms.some(p => p.canEdit),
  };

  // 4. 直接权限作为补充（非覆盖模式）
  if (directPerm && !directPerm.override) {
    merged.canView ||= directPerm.canView;
    merged.canExecute ||= directPerm.canExecute;
    merged.canEdit ||= directPerm.canEdit;
  }

  return { ...merged, source: 'merged' };
}
```

#### Step 3: 添加管理界面
新增"特殊权限管理"页面，允许管理员：
- 为单个用户添加临时权限
- 设置权限过期时间
- 查看所有特殊权限及其来源

#### Step 4: 定期清理过期权限
```typescript
// 定时任务（使用 @nestjs/schedule）
@Cron('0 0 * * *')  // 每天凌晨执行
async cleanExpiredPermissions() {
  await this.prisma.userJobPermission.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()  // 小于当前时间即为过期
      }
    }
  });
}
```

---

## Related Files
- `memory/技术栈选型-NodeJS-React-SQLite.md` (mem-001)
- `prisma/schema.prisma` (待创建)
- `src/permissions/permissions.service.ts` (待创建)
- `src/guards/job-permission.guard.ts` (待创建)
- `docs/specs/requirements.md` (待创建)
- `docs/specs/design.md` (待创建)

---

## References
- [NIST RBAC 标准](https://csrc.nist.gov/projects/role-based-access-control)
- [Prisma 多对多关系文档](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/many-to-many-relations)
- [NestJS Guards 文档](https://docs.nestjs.com/guards)

---

## Next Steps
1. ✅ 技术栈选型完成
2. ✅ 权限模型设计完成
3. ⏭️ 初始化 specs-workflow（requirements.md）
4. ⏭️ 编写详细设计文档（design.md）
5. ⏭️ 创建架构图（architecture.canvas）
