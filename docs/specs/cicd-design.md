# GitHub CI/CD Pipeline - Design Document

## Overview

本设计实现了基于 GitHub Actions 的 CI/CD 流水线，支持自动化测试、Docker 镜像构建和发布。采用模块化设计，将不同阶段的工作流分离，便于维护和扩展。

### 设计目标
- **自动化**: 从代码提交到镜像发布全程自动化
- **安全性**: 使用 GitHub Secrets 管理敏感信息，集成安全扫描
- **高效性**: 利用缓存机制加速构建，并行构建 backend 和 frontend
- **可维护性**: 模块化设计，清晰的职责分离

### 核心设计原则
1. **单一职责**: 每个 workflow 只负责一个主要功能
2. **可重用性**: 使用 reusable workflows 和 composite actions
3. **最小权限**: 每个 job 只获得必要的权限
4. **快速反馈**: PR 检查在 5 分钟内完成

## Architecture

### 系统架构图
详见 `docs/specs/diagrams/cicd-architecture.canvas`

### Workflow 分层设计

```
┌─────────────────────────────────────────────────────────┐
│                    Trigger Events                        │
│  (push to master, PR created, tag pushed)                │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌───────────┐  ┌──────────┐  ┌──────────┐
│  PR Check │  │  Build   │  │ Release  │
│  Workflow │  │ Workflow │  │ Workflow │
└─────┬─────┘  └────┬─────┘  └────┬─────┘
      │             │              │
      ▼             ▼              ▼
┌─────────────────────────────────────┐
│      Reusable Jobs & Actions        │
│  - Test Job (Backend/Frontend)      │
│  - Build Image Job                  │
│  - Security Scan Action             │
│  - Push Image Action                │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│         Outputs & Artifacts         │
│  - Test Reports                     │
│  - Docker Images (ghcr.io)          │
│  - Security Scan Reports            │
│  - GitHub Releases                  │
└─────────────────────────────────────┘
```

### 三大核心 Workflow

#### 1. PR Check Workflow (`pr-check.yml`)
- **触发时机**: PR 创建、更新、同步
- **目标**: 快速验证代码质量
- **步骤**:
  1. 代码检查（lint）
  2. 单元测试
  3. E2E 测试
  4. 构建验证（不推送镜像）
  5. 安全扫描

#### 2. Build & Push Workflow (`build.yml`)
- **触发时机**: push 到 master 分支
- **目标**: 构建并发布开发版本镜像
- **步骤**:
  1. 运行完整测试套件
  2. 构建 Docker 镜像（backend, frontend）
  3. 安全扫描
  4. 推送到 ghcr.io，标签：`latest`, `master-{sha}`

#### 3. Release Workflow (`release.yml`)
- **触发时机**: 推送 Git tag（v*.*.*）
- **目标**: 发布生产版本
- **步骤**:
  1. 验证 tag 格式（语义化版本）
  2. 运行完整测试套件
  3. 构建生产级 Docker 镜像
  4. 安全扫描（高危漏洞阻止发布）
  5. 推送多版本标签：`1.2.3`, `1.2`, `1`, `latest`
  6. 创建 GitHub Release + CHANGELOG

## Components and Interfaces

### 1. Workflow 文件

#### `pr-check.yml`
```yaml
name: PR Check
on:
  pull_request:
    branches: [master]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, cache, test, lint]

  test-frontend:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, cache, test, lint]

  build-validation:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    steps: [checkout, build-docker, scan]
```

**输出**:
- Test reports (JUnit XML)
- Coverage reports
- Scan results

#### `build.yml`
```yaml
name: Build and Push
on:
  push:
    branches: [master]

jobs:
  build-backend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps: [checkout, setup-buildx, login-ghcr, build-push, scan]

  build-frontend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps: [checkout, setup-buildx, login-ghcr, build-push, scan]
```

**输出**:
- Docker images: `ghcr.io/{owner}/xxljob-enhance-backend:latest`
- Docker images: `ghcr.io/{owner}/xxljob-enhance-frontend:latest`

#### `release.yml`
```yaml
name: Release
on:
  push:
    tags: ['v*.*.*']

jobs:
  validate-tag:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.parse.outputs.version }}

  test:
    needs: validate-tag
    uses: ./.github/workflows/test-reusable.yml

  build-and-release:
    needs: test
    strategy:
      matrix:
        service: [backend, frontend]
    steps: [build, scan, push-multi-tags, create-release]
```

**输出**:
- Versioned Docker images
- GitHub Release with assets
- CHANGELOG.md

### 2. Reusable Workflows

#### `test-reusable.yml`
可被 PR Check 和 Release 调用的测试工作流

```yaml
name: Reusable Test
on:
  workflow_call:
    inputs:
      working-directory:
        required: true
        type: string

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
```

### 3. Composite Actions

#### `setup-node-cache`
复用 Node.js 环境设置和缓存逻辑

```yaml
name: Setup Node with Cache
description: Setup Node.js and cache npm dependencies
inputs:
  node-version:
    description: Node.js version
    default: '20'
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
    - uses: actions/cache@v4
      with:
        path: ~/.npm
        key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 4. 关键 Actions（第三方）

| Action | 用途 | 版本 |
|--------|------|------|
| `actions/checkout@v4` | 检出代码 | v4 |
| `actions/setup-node@v4` | 设置 Node.js | v4 |
| `docker/setup-buildx-action@v3` | 设置 Docker Buildx | v3 |
| `docker/login-action@v3` | 登录 GHCR | v3 |
| `docker/build-push-action@v5` | 构建推送镜像 | v5 |
| `aquasecurity/trivy-action@master` | 安全扫描 | master |
| `actions/upload-artifact@v4` | 上传构建产物 | v4 |

## Data Models

### 1. GitHub Secrets
```yaml
# 必需的 Secrets
GHCR_TOKEN:           # GitHub Container Registry 推送令牌
                      # 类型: Personal Access Token (PAT)
                      # 权限: write:packages, read:packages

# 可选的 Secrets（用于通知）
SLACK_WEBHOOK_URL:    # Slack 通知 webhook
DISCORD_WEBHOOK_URL:  # Discord 通知 webhook
```

### 2. Environment Variables
```yaml
# Workflow 级别
REGISTRY: ghcr.io
IMAGE_NAME: ${{ github.repository }}

# Job 级别
NODE_VERSION: '20'
DOCKER_BUILDKIT: '1'

# Runtime（从 context 获取）
GITHUB_SHA: ${{ github.sha }}
GITHUB_REF_NAME: ${{ github.ref_name }}
```

### 3. Workflow Outputs

#### PR Check Outputs
```json
{
  "test_result": "success|failure",
  "coverage_percentage": 85.5,
  "lint_errors": 0,
  "security_vulnerabilities": {
    "critical": 0,
    "high": 1,
    "medium": 3
  }
}
```

#### Build Outputs
```json
{
  "image_tag": "ghcr.io/owner/repo:latest",
  "image_digest": "sha256:abcd1234...",
  "build_time": "2025-01-06T10:30:00Z"
}
```

#### Release Outputs
```json
{
  "version": "1.2.3",
  "release_id": 123456,
  "release_url": "https://github.com/owner/repo/releases/tag/v1.2.3",
  "assets": [
    "checksums.txt",
    "CHANGELOG.md"
  ]
}
```

### 4. Artifact Structure
```
artifacts/
├── test-results/
│   ├── backend-junit.xml
│   ├── frontend-junit.xml
│   └── coverage/
│       ├── backend-lcov.info
│       └── frontend-lcov.info
├── security-scans/
│   ├── backend-trivy.sarif
│   └── frontend-trivy.sarif
└── build-logs/
    ├── backend-build.log
    └── frontend-build.log
```

## Error Handling

### 1. 构建失败处理

#### 策略分层
```yaml
# Level 1: Step 级别重试
- name: Build Docker Image
  uses: docker/build-push-action@v5
  continue-on-error: false
  timeout-minutes: 15

# Level 2: Job 级别超时
jobs:
  build:
    timeout-minutes: 30

# Level 3: Workflow 级别通知
on:
  workflow_run:
    workflows: ["Build and Push"]
    types: [completed]
```

#### 失败场景处理

| 失败类型 | 处理策略 | 通知 |
|---------|---------|------|
| 测试失败 | 阻止合并，显示失败测试 | PR comment |
| Lint 失败 | 阻止合并，显示错误列表 | PR comment |
| 构建超时 | 取消构建，检查资源限制 | GitHub Issue |
| 推送失败 | 重试 3 次，检查权限 | Slack/Discord |
| 安全高危漏洞 | 警告但不阻止（PR），阻止发布（Release） | Security Alert |

### 2. 权限错误处理

```yaml
# 在推送前验证权限
- name: Verify GHCR Access
  run: |
    echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
    docker pull ghcr.io/${{ github.repository }}/test-image || echo "No existing image found"
```

### 3. 镜像标签冲突处理

```yaml
# 使用 --force 覆盖 latest 标签
- name: Push Image
  uses: docker/build-push-action@v5
  with:
    tags: |
      ghcr.io/${{ github.repository }}:latest
      ghcr.io/${{ github.repository }}:master-${{ github.sha }}
    push: true
    # latest 会被覆盖，sha 标签不会冲突
```

### 4. 回滚机制

```yaml
# Release workflow 中的回滚逻辑
- name: Rollback on Failure
  if: failure()
  run: |
    # 删除刚创建的 tag（如果镜像推送失败）
    git push --delete origin ${{ github.ref_name }}

    # 删除未完成的 Release
    gh release delete ${{ github.ref_name }} --yes || true
```

### 5. 通知机制

```yaml
# 失败通知 Job
notify-failure:
  if: failure()
  runs-on: ubuntu-latest
  needs: [build-backend, build-frontend]
  steps:
    - name: Send Slack Notification
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "Build failed for ${{ github.repository }}",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Build Failed* :x:\n*Branch:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
                }
              }
            ]
          }
```

## Testing Strategy

### 1. Workflow 测试策略

#### 本地测试（使用 act）
```bash
# 安装 act（GitHub Actions 本地运行器）
brew install act

# 测试 PR check workflow
act pull_request -W .github/workflows/pr-check.yml

# 测试 build workflow（dry-run，不推送）
act push -W .github/workflows/build.yml \
  --secret GITHUB_TOKEN=xxx \
  --var PUSH_ENABLED=false
```

#### 分支测试
```yaml
# 在 feature 分支上测试 workflow 变更
on:
  push:
    branches:
      - master
      - 'workflow-test/**'  # 测试分支
```

### 2. 单元测试覆盖率要求

```yaml
# 在 workflow 中强制覆盖率门槛
- name: Check Coverage
  run: |
    COVERAGE=$(npx jest --coverage --coverageReporters=json-summary | \
      jq '.total.lines.pct')

    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage $COVERAGE% is below 80%"
      exit 1
    fi
```

### 3. E2E 测试策略

```yaml
# 使用 Docker Compose 运行 E2E 测试
- name: Run E2E Tests
  run: |
    # 启动服务
    docker-compose -f docker-compose.test.yml up -d

    # 等待服务就绪
    docker-compose exec -T backend wget --retry-connrefused --tries=30 http://localhost:3000/health

    # 运行测试
    npm run test:e2e

    # 清理
    docker-compose down -v
```

### 4. 安全扫描测试

```yaml
# Trivy 扫描配置
- name: Run Trivy Scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # 发现高危漏洞时失败
```

### 5. 性能测试（构建时间）

```yaml
# 记录构建时间
- name: Build with Timing
  run: |
    START_TIME=$(date +%s)
    docker build -t test .
    END_TIME=$(date +%s)
    BUILD_TIME=$((END_TIME - START_TIME))

    echo "Build time: ${BUILD_TIME}s"

    # 构建时间超过 5 分钟时警告
    if [ $BUILD_TIME -gt 300 ]; then
      echo "::warning::Build time exceeded 5 minutes"
    fi
```

### 6. 集成测试矩阵

```yaml
# 测试多个 Node.js 版本
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest]

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### 7. 缓存验证

```yaml
# 验证缓存是否生效
- name: Validate Cache
  run: |
    if [ -d "$HOME/.npm" ]; then
      echo "✓ NPM cache hit"
    else
      echo "✗ NPM cache miss"
    fi
```

## Security Considerations

### 1. Secrets 管理
- 使用 GitHub Secrets 存储敏感信息
- 最小权限原则：GITHUB_TOKEN 仅授予必要权限
- 定期轮换 PAT（Personal Access Token）

### 2. 镜像安全
- 使用官方基础镜像（node:20-alpine）
- 多阶段构建，减少攻击面
- 非 root 用户运行容器
- Trivy 扫描所有镜像

### 3. Supply Chain Security
- 锁定 Actions 版本（使用 SHA 而非标签）
- 定期更新依赖（Dependabot）
- 验证第三方 Actions 的来源

### 4. SBOM 生成
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_NAME }}
    format: spdx-json
    output-file: sbom.spdx.json
```

## Performance Optimizations

### 1. 并行化
- Backend 和 Frontend 并行构建
- 测试和 Lint 并行运行

### 2. 缓存策略
```yaml
# Docker layer cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=${{ env.IMAGE_NAME }}:buildcache
    cache-to: type=registry,ref=${{ env.IMAGE_NAME }}:buildcache,mode=max

# NPM cache
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 3. 条件执行
```yaml
# 仅在相关文件变更时运行
on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/build.yml'
```

## Monitoring and Observability

### 1. 构建状态徽章
```markdown
![Build Status](https://github.com/{owner}/{repo}/workflows/Build%20and%20Push/badge.svg)
![Release](https://img.shields.io/github/v/release/{owner}/{repo})
```

### 2. 构建时间追踪
- 使用 GitHub Actions 自带的 timing 功能
- 记录每个 step 的执行时间
- 设置性能回归告警

### 3. 成功率监控
- 定期审查 workflow 失败率
- 分析失败原因（测试 vs 基础设施）
- 优化不稳定的测试

## Migration Plan

### 从无 CI/CD 到有 CI/CD

#### Phase 1: 基础设施
- 创建 `.github/workflows/` 目录
- 配置 GitHub Secrets
- 测试镜像推送权限

#### Phase 2: PR 检查
- 部署 `pr-check.yml`
- 观察 PR 检查结果
- 调整超时和缓存配置

#### Phase 3: 自动构建
- 部署 `build.yml`
- 验证镜像可用性
- 更新部署文档

#### Phase 4: 版本发布
- 部署 `release.yml`
- 创建第一个 tag（v0.1.0）
- 验证完整发布流程

## Future Enhancements

1. **多环境部署**: 支持 dev、staging、production 环境
2. **性能测试**: 集成 k6 或 Artillery 进行负载测试
3. **自动化回滚**: 检测部署失败时自动回滚
4. **A/B 测试**: 支持灰度发布
5. **成本优化**: 使用 self-hosted runners 降低成本
