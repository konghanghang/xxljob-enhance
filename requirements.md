# GitHub CI/CD Pipeline - Requirements Document

实现基于 GitHub Actions 的 CI/CD 流水线，自动构建、测试和发布 Docker 镜像到 GitHub Container Registry (ghcr.io)。支持 backend 和 frontend 服务的独立构建和部署。

## Core Features

本功能实现完整的 CI/CD 自动化流水线，包括：

1. **自动化测试**: 每次代码提交时自动运行测试套件
2. **Docker 镜像构建**: 自动构建 backend 和 frontend 的多架构 Docker 镜像
3. **镜像发布**: 推送镜像到 GitHub Container Registry (ghcr.io)
4. **版本管理**: 基于 Git tags 和 commits 自动生成镜像版本号
5. **多环境支持**: 区分开发、测试和生产环境的构建流程

## User Stories

### US-1: 自动化测试
**As a** 开发者
**I want** 每次 push 代码时自动运行测试
**So that** 能及时发现代码问题，保证代码质量

### US-2: 自动构建镜像
**As a** DevOps 工程师
**I want** 自动构建 Docker 镜像并推送到 GitHub Container Registry
**So that** 无需手动构建镜像，提高部署效率

### US-3: 版本化发布
**As a** 项目维护者
**I want** 基于 Git tags 自动发布带版本号的镜像
**So that** 能方便地回滚到特定版本

### US-4: 安全扫描
**As a** 安全工程师
**I want** 自动扫描 Docker 镜像的安全漏洞
**So that** 在部署前发现并修复安全问题

## Acceptance Criteria

### AC-1: Pull Request 检查流水线
**Given** 开发者创建了一个 Pull Request
**When** PR 被创建或更新时
**Then** 系统应该：
- 自动运行 backend 的单元测试和端到端测试
- 自动运行 frontend 的测试（如果存在）
- 执行代码检查（lint）
- 构建 Docker 镜像以验证可构建性
- 在 PR 页面显示检查结果（成功/失败）

### AC-2: 开发分支镜像构建
**Given** 代码被合并到 master 分支
**When** push 到 master 分支时
**Then** 系统应该：
- 构建 backend 和 frontend 的 Docker 镜像（linux/amd64）
- 推送镜像到 ghcr.io，标签为 `latest` 和 `master-{short-sha}`
- 构建失败时发送通知

### AC-3: 版本发布流程
**Given** 维护者创建了一个新的 Git tag（格式：v1.2.3）
**When** tag 被推送到 GitHub
**Then** 系统应该：
- 运行完整的测试套件
- 构建生产级别的 Docker 镜像
- 推送镜像到 ghcr.io，标签包括：
  - `{version}` (例如: 1.2.3)
  - `{major}.{minor}` (例如: 1.2)
  - `{major}` (例如: 1)
  - `latest`
- 自动创建 GitHub Release，附带 CHANGELOG

### AC-4: 镜像安全扫描
**Given** Docker 镜像已构建完成
**When** 镜像推送前
**Then** 系统应该：
- 使用 Trivy 扫描镜像漏洞
- 生成安全扫描报告
- 如果发现高危漏洞，标记构建为警告状态
- 将扫描结果上传到 GitHub Security

### AC-5: 构建缓存优化
**Given** 连续多次构建
**When** 代码无重大变更时
**Then** 系统应该：
- 利用 Docker layer cache 加速构建
- 使用 GitHub Actions cache 缓存 npm 依赖
- 平均构建时间 < 5 分钟（backend）
- 平均构建时间 < 3 分钟（frontend）

### AC-6: 环境变量管理
**Given** 不同环境需要不同的配置
**When** 构建镜像时
**Then** 系统应该：
- 使用 GitHub Secrets 管理敏感信息
- 支持通过环境变量注入配置
- 不在镜像中硬编码任何密钥
- 提供清晰的环境变量文档

## Non-functional Requirements

### 性能要求
- **构建速度**: Backend 构建时间 < 5 分钟，Frontend < 3 分钟
- **并发构建**: 支持 backend 和 frontend 并行构建
- **缓存效率**: 无代码变更时，构建时间 < 2 分钟
- **架构支持**: 仅构建 linux/amd64 架构

### 安全要求
- **镜像扫描**: 使用 Trivy 自动扫描所有镜像
- **密钥管理**: 所有密钥通过 GitHub Secrets 管理
- **最小权限**: Workflow 使用最小必要权限
- **漏洞响应**: 发现高危漏洞时自动创建 Issue

### 可用性要求
- **失败通知**: 构建失败时通过 GitHub 通知相关人员
- **日志保留**: 构建日志保留 90 天
- **状态可见**: 在 README 中显示构建状态徽章
- **文档完整**: 提供完整的 CI/CD 使用和维护文档

### 兼容性要求
- **架构支持**: 镜像仅支持 linux/amd64
- **容器运行时**: 兼容 Docker、Podman、Kubernetes
- **Git 工作流**: 兼容 GitHub Flow（PR → merge to master → deploy）
- **版本规范**: 遵循语义化版本（Semantic Versioning）
