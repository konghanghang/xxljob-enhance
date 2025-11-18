# xxljob-enhance - Requirements Document

基于 xxl-job API 的任务级权限管理系统，通过 RBAC 模型实现用户对定时任务的细粒度访问控制，替代 xxl-job 原生的执行器级别权限。

## Core Features

本系统提供以下核心功能：

1. **用户认证与管理**
   - 独立的用户身份认证系统（JWT）
   - 用户账号的创建、编辑、禁用
   - 管理员和普通用户的角色区分

2. **基于角色的权限管理（RBAC）**
   - 角色的创建、编辑、删除
   - 用户与角色的多对多关联
   - 角色与任务权限的配置

3. **任务级别的访问控制**
   - 细粒度的任务权限（查看、执行、编辑）
   - 基于权限过滤的任务列表展示
   - 操作按钮的权限控制

4. **xxl-job API 集成**
   - 任务列表的同步和展示
   - 任务执行的代理调用
   - 执行日志的查看（需权限）

5. **审计日志**
   - 用户登录记录
   - 任务执行记录
   - 权限变更记录

## User Stories

### US-001: 用户登录
**As a** 系统用户
**I want** 使用用户名和密码登录系统
**So that** 我可以访问我有权限的任务

**Acceptance Criteria (EARS Format)**:
- **Given** 我在登录页面
  **When** 我输入正确的用户名和密码并点击登录
  **Then** 系统应该返回 JWT Token 并跳转到任务列表页面

- **Given** 我在登录页面
  **When** 我输入错误的用户名或密码
  **Then** 系统应该显示"用户名或密码错误"的提示

- **Given** 我的账号已被管理员禁用
  **When** 我尝试登录
  **Then** 系统应该显示"账号已被禁用，请联系管理员"

### US-002: 查看任务列表
**As a** 普通用户
**I want** 查看我有权限的任务列表
**So that** 我可以了解哪些任务可以操作

**Acceptance Criteria (EARS Format)**:
- **Given** 我已登录系统
  **When** 我访问任务列表页面
  **Then** 系统应该仅显示我有 `canView` 权限的任务

- **Given** 我没有任何任务权限
  **When** 我访问任务列表页面
  **Then** 系统应该显示"暂无可用任务"的提示

- **Given** 我有 10 个任务的查看权限，但 xxl-job 中总共有 50 个任务
  **When** 我访问任务列表页面
  **Then** 系统应该仅显示这 10 个任务，而不是全部 50 个

### US-003: 执行任务
**As a** 普通用户
**I want** 手动触发任务执行
**So that** 我可以在需要时立即运行任务

**Acceptance Criteria (EARS Format)**:
- **Given** 我对某个任务有 `canExecute` 权限
  **When** 我点击"执行"按钮
  **Then** 系统应该调用 xxl-job API 触发任务，并显示"任务已触发"的提示

- **Given** 我对某个任务只有 `canView` 权限，没有 `canExecute` 权限
  **When** 我查看该任务详情
  **Then** 系统应该隐藏或置灰"执行"按钮

- **Given** 我对某个任务有 `canExecute` 权限
  **When** 我尝试通过 API 直接调用执行接口（绕过 UI）
  **Then** 系统应该验证权限并允许执行

- **Given** 我对某个任务没有 `canExecute` 权限
  **When** 我尝试通过 API 直接调用执行接口
  **Then** 系统应该返回 403 Forbidden 错误

### US-004: 查看执行日志
**As a** 普通用户
**I want** 查看任务的执行历史和日志
**So that** 我可以排查任务执行是否成功

**Acceptance Criteria (EARS Format)**:
- **Given** 我对某个任务有 `canView` 权限
  **When** 我点击"查看日志"按钮
  **Then** 系统应该展示该任务的执行历史（调用 xxl-job API）

- **Given** 我对某个任务没有 `canView` 权限
  **When** 我尝试访问该任务的日志接口
  **Then** 系统应该返回 403 Forbidden 错误

### US-005: 管理员创建角色
**As a** 系统管理员
**I want** 创建新的角色并配置权限
**So that** 我可以批量管理相同职能用户的权限

**Acceptance Criteria (EARS Format)**:
- **Given** 我是系统管理员
  **When** 我创建一个名为"数据分析师"的角色，并为其分配 3 个任务的权限
  **Then** 系统应该保存该角色及其权限配置

- **Given** 我创建了一个角色
  **When** 我尝试创建同名角色
  **Then** 系统应该提示"角色名称已存在"

- **Given** 我创建了一个角色"数据分析师"
  **When** 我为该角色配置 Job #101 的权限为 `canView=true, canExecute=true, canEdit=false`
  **Then** 所有拥有"数据分析师"角色的用户都应该自动获得这些权限

### US-006: 管理员分配角色给用户
**As a** 系统管理员
**I want** 为用户分配一个或多个角色
**So that** 用户可以获得相应的任务访问权限

**Acceptance Criteria (EARS Format)**:
- **Given** 我是系统管理员，系统中有一个用户"张三"和角色"数据分析师"
  **When** 我将"数据分析师"角色分配给"张三"
  **Then** "张三"应该立即获得该角色对应的所有任务权限

- **Given** 用户"张三"已拥有"数据分析师"角色
  **When** 我再为"张三"分配"运维工程师"角色
  **Then** "张三"应该同时拥有两个角色的所有权限（权限并集）

- **Given** 我为用户分配了某个角色
  **When** 我删除该角色
  **Then** 该用户应该自动失去该角色的所有权限

### US-007: 管理员管理用户
**As a** 系统管理员
**I want** 创建、编辑、禁用用户账号
**So that** 我可以控制谁可以访问系统

**Acceptance Criteria (EARS Format)**:
- **Given** 我是系统管理员
  **When** 我创建一个新用户，输入用户名、初始密码和邮箱
  **Then** 系统应该创建该用户账号，密码使用 bcrypt 加密存储

- **Given** 我创建了一个用户"张三"
  **When** 我将该用户的 `isActive` 状态设为 false
  **Then** "张三"应该无法登录系统

- **Given** 我禁用了一个用户
  **When** 我重新启用该用户（`isActive` 设为 true）
  **Then** 该用户应该可以正常登录

### US-008: 权限继承和计算
**As a** 系统
**I want** 正确计算用户的最终权限（多个角色的并集）
**So that** 用户可以获得所有角色的权限

**Acceptance Criteria (EARS Format)**:
- **Given** 用户"张三"拥有两个角色：
  - 角色 A：Job #101 (`canView=true, canExecute=false`)
  - 角色 B：Job #101 (`canView=false, canExecute=true`)
  **When** 系统计算"张三"对 Job #101 的权限
  **Then** 最终权限应该为 `canView=true, canExecute=true`（OR 逻辑）

- **Given** 用户"张三"拥有角色"数据分析师"，该角色有 5 个任务的权限
  **When** 我撤销"张三"的"数据分析师"角色
  **Then** "张三"应该立即失去这 5 个任务的访问权限

### US-009: 审计日志记录
**As a** 系统管理员
**I want** 查看所有用户的操作记录
**So that** 我可以追溯谁在何时执行了哪些任务

**Acceptance Criteria (EARS Format)**:
- **Given** 用户"张三"执行了 Job #101
  **When** 我查看审计日志
  **Then** 系统应该记录：用户、任务 ID、操作类型（EXECUTE_JOB）、结果（SUCCESS/FAILED）、时间戳

- **Given** 管理员为用户分配了角色
  **When** 我查看审计日志
  **Then** 系统应该记录：管理员用户 ID、操作类型（ASSIGN_ROLE）、目标角色和用户

- **Given** 审计日志超过 6 个月
  **When** 系统定期清理任务运行
  **Then** 系统应该归档或删除 6 个月前的日志

### US-010: xxl-job API 集成
**As a** 系统
**I want** 通过 xxl-job API 获取任务列表和执行任务
**So that** 用户可以看到实时的任务信息

**Acceptance Criteria (EARS Format)**:
- **Given** xxl-job 服务正常运行
  **When** 系统启动时
  **Then** 系统应该自动登录 xxl-job 并维护会话（Cookie）

- **Given** 用户访问任务列表页面
  **When** 系统调用 xxl-job API `/jobinfo/pageList`
  **Then** 系统应该返回任务列表数据（任务 ID、名称、执行器、调度配置等）

- **Given** 用户触发任务执行
  **When** 系统调用 xxl-job API `/jobinfo/trigger`
  **Then** xxl-job 应该立即调度该任务执行

- **Given** xxl-job API 返回错误（如网络超时）
  **When** 用户尝试执行任务
  **Then** 系统应该向用户显示友好的错误提示，而不是崩溃

## Non-functional Requirements

### NFR-001: 性能要求
- **响应时间**: 任务列表加载时间 < 2 秒（100 个任务）
- **并发支持**: 支持 50 个并发用户同时操作（基于 100-200 用户规模的 25% 并发率）
- **数据库查询**: 权限查询应该有缓存机制，避免每次操作都查询数据库
- **API 调用**: xxl-job API 调用应该有超时设置（默认 10 秒）

### NFR-002: 安全要求
- **密码存储**: 用户密码必须使用 bcrypt 加密存储（cost factor ≥ 10）
- **JWT 安全**:
  - Access Token 有效期：1 小时
  - Refresh Token 有效期：7 天
  - Token 必须使用强密钥签名（至少 256 位）
- **权限验证**:
  - 所有任务操作 API 必须经过权限验证（使用 Guard）
  - 管理员操作必须额外验证 `isAdmin` 字段
  - 防止权限提升攻击（用户不能通过修改请求参数绕过权限检查）
- **SQL 注入防护**: 使用 Prisma ORM，避免拼接 SQL
- **XSS 防护**: 前端使用 React 的自动转义，后端 API 返回 JSON

### NFR-003: 可用性要求
- **部署简单**:
  - 支持 Docker 单容器部署
  - 配置项通过环境变量注入（不硬编码）
  - 提供默认的 SQLite 数据库（开箱即用）
- **数据备份**:
  - 提供 SQLite 数据库备份脚本
  - 备份文件包含：用户、角色、权限、审计日志
- **错误处理**:
  - 所有 API 错误应该返回统一格式：`{ "error": "错误类型", "message": "详细说明" }`
  - 前端应该友好展示错误信息（不暴露技术细节）

### NFR-004: 兼容性要求
- **浏览器支持**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **xxl-job 版本**: 兼容 xxl-job 2.3.0 及以上版本
- **Node.js 版本**: Node.js 18.x 或 20.x
- **数据库迁移**: 未来可无缝迁移到 PostgreSQL 或 MySQL（通过修改 Prisma 配置）

### NFR-005: 可维护性要求
- **代码规范**:
  - 使用 TypeScript 严格模式
  - 使用 ESLint + Prettier 统一代码风格
- **测试覆盖**:
  - 核心权限逻辑的单元测试覆盖率 > 80%
  - 关键 API 的集成测试
- **文档**:
  - API 文档（Swagger/OpenAPI）
  - 部署文档
  - 架构设计文档（本 specs 目录）

### NFR-006: 可扩展性要求
- **权限模型升级**:
  - 当前采用纯 RBAC 模型
  - 预留升级到混合模型的路径（RBAC + 直接权限）
  - 数据库 Schema 设计应便于添加新字段
- **多租户支持**:
  - 虽然当前不需要，但数据库设计应考虑未来添加 `tenantId` 的可能性

## Out of Scope (当前版本不包含)

为了快速上线 MVP，以下功能**不在**本次开发范围内：

- ❌ 用户自助注册（仅管理员可创建用户）
- ❌ 忘记密码/邮件重置密码
- ❌ OAuth/LDAP 集成
- ❌ 任务的创建和编辑（仅调用 xxl-job 的现有任务）
- ❌ 任务调度配置的修改（保持与 xxl-job 一致）
- ❌ 钉钉/企业微信通知集成
- ❌ 权限模板和批量分配（手动逐个配置）
- ❌ 用户组（当前仅支持角色）
- ❌ 直接权限（纯 RBAC，不支持为单个用户单独配置权限）
- ❌ 权限过期时间（权限永久有效，除非手动撤销）

## Dependencies

本系统依赖以下外部系统：

1. **xxl-job Admin**
   - 版本：2.3.0+
   - 访问方式：HTTP API
   - 必需的配置：管理员账号（用于 API 调用）

2. **环境要求**
   - Node.js: 18.x 或 20.x
   - SQLite: 3.x（通过 better-sqlite3）
   - Docker: 20.x+（可选，用于容器化部署）

## Success Metrics

系统成功的衡量标准：

1. **功能完整性**: 所有用户故事的验收标准全部通过
2. **用户采用率**: 目标用户（100-200 人）中至少 80% 开始使用本系统
3. **权限管理效率**: 管理员为 10 个用户分配权限的时间 < 5 分钟（相比直接在 xxl-job 中操作）
4. **系统稳定性**: 上线后 30 天内无严重 Bug（P0/P1）
5. **性能达标**: 任务列表加载时间 < 2 秒，API 响应时间 < 500ms
