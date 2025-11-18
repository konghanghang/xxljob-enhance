---
id: mem-001
type: decision
title: xxljob-enhance 技术栈选型：Node.js + React + SQLite
date: 2025-01-18
tags: [architecture, tech-stack, nodejs, react, sqlite, decision]
---

## Summary
选择 Node.js (NestJS) + React + SQLite 技术栈，以实现轻量级、快速部署的 xxl-job 任务级权限管理系统。

## Context
- **用户规模**: 100-200 人
- **核心需求**: 任务级别权限控制（xxl-job 原生仅支持执行器级别）
- **部署要求**: 简单、快速上线、无需重型数据库
- **基于**: 对轻量级部署和开发效率的需求
- **导致**: 后续的架构设计和开发实施

## Decision

### 后端技术栈
**框架**: NestJS + TypeScript

**理由**:
- ✅ 类似 Spring Boot 的模块化架构（Controller-Service-Repository）
- ✅ 内置 TypeScript 支持，类型安全
- ✅ 装饰器语法让权限控制优雅（`@UseGuards(JwtAuthGuard, JobPermissionGuard)`）
- ✅ 依赖注入，便于测试和维护
- ✅ 虽然开发者不熟悉 Node.js，但 NestJS 的结构化架构降低学习曲线

**核心依赖**:
```json
{
  "@nestjs/core": "^10.x",
  "@nestjs/common": "^10.x",
  "@nestjs/passport": "^10.x",
  "@nestjs/jwt": "^10.x",
  "passport-jwt": "^4.x",
  "axios": "^1.x"
}
```

---

### 数据库方案
**数据库**: SQLite
**ORM**: Prisma

**理由**:
- ✅ SQLite 零配置，单文件数据库（`dev.db`）
- ✅ 100-200 用户规模完全够用（甚至可支持数千用户的读密集型场景）
- ✅ 部署简单：一个可执行文件 + 一个 `.db` 文件
- ✅ Prisma 提供类型安全的查询 API
- ✅ Prisma Schema 语法简洁，自动生成迁移文件
- ✅ 未来可无缝切换到 PostgreSQL/MySQL（仅需改配置）

**并发特性**:
- 高并发读取（满足查询需求）
- 串行写入（对于权限变更场景足够）

**备份策略**:
- 定期复制 `.db` 文件（cron + rsync）
- Docker volume 持久化

---

### 前端技术栈
**框架**: React 18 + TypeScript
**UI 库**: Ant Design 5

**理由**:
- ✅ Ant Design 企业级组件库，与 xxl-job 原生 UI 风格一致
- ✅ 组件丰富（Table, Form, Modal, Message）
- ✅ React 生态成熟，社区活跃
- ✅ TypeScript 与后端类型共享（可生成 API Client）

**核心依赖**:
```json
{
  "react": "^18.x",
  "antd": "^5.x",
  "axios": "^1.x",
  "react-router-dom": "^6.x"
}
```

---

### 认证方案
**策略**: JWT (JSON Web Token) + Passport

**理由**:
- ✅ 无状态认证，适合前后端分离
- ✅ Token 过期机制（Access Token 1小时 + Refresh Token 7天）
- ✅ NestJS 官方支持良好（`@nestjs/passport`）

---

### 部署方案
**方式**: Docker 单容器 / PM2 单机部署

**Docker 示例**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**数据持久化**:
```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e XXL_JOB_ADMIN_URL=http://xxljob:8080/xxl-job-admin \
  xxljob-enhance
```

---

## Alternatives Considered

### 替代方案 1: Java (Spring Boot) + MySQL
**优点**:
- 与 xxl-job 技术栈一致
- 更成熟的企业级方案

**缺点**:
- ❌ 部署复杂（需要 MySQL 服务）
- ❌ 资源占用较高
- ❌ 对于小规模用户过度设计

**决策**: 放弃，优先快速上线

---

### 替代方案 2: Express + MongoDB
**优点**:
- Express 更轻量
- MongoDB 文档型数据库灵活

**缺点**:
- ❌ Express 缺少结构化架构（需要自己组织）
- ❌ MongoDB 仍需独立服务
- ❌ 缺少类型安全（除非用 Mongoose + TypeScript）

**决策**: 放弃，NestJS 更适合长期维护

---

## Implementation Details

### 核心模块划分
```
src/
├── auth/                  # JWT 认证模块
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── guards/
│       └── jwt-auth.guard.ts
├── users/                 # 用户管理模块
│   ├── users.service.ts
│   └── users.controller.ts
├── permissions/           # 权限管理模块
│   ├── permissions.service.ts
│   ├── permissions.controller.ts
│   └── guards/
│       └── job-permission.guard.ts
├── xxljob/                # xxl-job API 调用模块
│   ├── xxljob.service.ts
│   └── xxljob.controller.ts
└── prisma/                # 数据库模块
    └── schema.prisma
```

### 数据模型设计（Prisma Schema）
```prisma
model User {
  id          Int       @id @default(autoincrement())
  username    String    @unique
  password    String    // bcrypt 加密
  role        Role      @default(USER)
  permissions JobPermission[]
  auditLogs   AuditLog[]
  createdAt   DateTime  @default(now())
}

model JobPermission {
  id          Int      @id @default(autoincrement())
  userId      Int
  jobId       Int
  appName     String
  canView     Boolean  @default(true)
  canExecute  Boolean  @default(false)
  canEdit     Boolean  @default(false)
  canDelete   Boolean  @default(false)
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([userId, jobId])
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  jobId     Int
  action    String   // VIEW, EXECUTE, EDIT, DELETE
  result    String   // SUCCESS, FAILED
  message   String?
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}

enum Role {
  ADMIN
  USER
}
```

---

## Migration Strategy

### 当前阶段: SQLite (Phase 1)
- 用户 < 500
- 并发写入 < 10/秒

### 迁移触发条件
当满足以下任一条件时，考虑迁移到 PostgreSQL：
1. 用户数超过 500
2. 并发写入频繁（> 10 次/秒）
3. 需要主从复制、高可用

### 迁移步骤
```bash
# 1. 修改 prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# 2. 迁移数据
npx prisma migrate dev --name migrate-to-postgresql

# 3. 导出 SQLite 数据，导入 PostgreSQL
```

---

## Risks & Mitigations

### 风险 1: SQLite 并发写入限制
**影响**: 权限分配操作可能排队
**概率**: 低（权限变更不频繁）
**缓解**:
- 使用 WAL 模式提升并发（`PRAGMA journal_mode=WAL`）
- 监控写入延迟，超阈值时告警

### 风险 2: xxl-job API 变化
**影响**: API 调用失败
**概率**: 中（xxl-job 版本更新）
**缓解**:
- 抽象 API 调用层
- 编写集成测试覆盖核心 API
- 版本兼容性检测

### 风险 3: 开发者不熟悉 Node.js/TypeScript
**影响**: 开发效率降低
**概率**: 中
**缓解**:
- NestJS 官方文档 + 教程（3-5 小时快速上手）
- Prisma Studio 图形化管理数据库
- 使用 Copilot/Claude 辅助编码

---

## Related Files
- `docs/specs/requirements.md` (待创建)
- `docs/specs/design.md` (待创建)
- `docs/specs/diagrams/architecture.canvas` (待创建)
- `prisma/schema.prisma` (待创建)

---

## References
- [NestJS 官方文档](https://docs.nestjs.com/)
- [Prisma 文档](https://www.prisma.io/docs)
- [xxl-job 源码](https://github.com/xuxueli/xxl-job)
- [Ant Design](https://ant.design/)

---

## Next Steps
1. 初始化 specs-workflow（使用 MCP 工具）
2. 编写 Phase 1: 需求文档（requirements.md）
3. 编写 Phase 2: 设计文档（design.md）+ 创建架构图
4. 编写 Phase 3: 任务清单（tasks.md）
