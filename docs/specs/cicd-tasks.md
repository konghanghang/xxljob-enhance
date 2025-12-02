# GitHub CI/CD Pipeline - Task List

## Implementation Tasks

### Phase 1: 基础设施准备

- [x] 1. **创建 GitHub Actions 目录结构**
    - [x] 1.1. 创建 workflows 和 actions 目录
        - *Goal*: 建立标准的 GitHub Actions 文件结构
        - *Files*:
            - `.github/workflows/`
            - `.github/actions/setup-node-cache/`
        - *Requirements*: AC-1, AC-2, AC-3

### Phase 2: 可重用组件开发

- [ ] 2. **创建 Composite Action: Setup Node with Cache**
    - [x] 2.1. 实现 Node.js 环境设置 action
        - *Goal*: 创建可重用的 Node.js 设置和缓存逻辑
        - *Files*: `.github/actions/setup-node-cache/action.yml`
        - *Details*:
            - 接受 node-version 参数（默认 20）
            - 使用 actions/setup-node@v4
            - 使用 actions/cache@v4 缓存 ~/.npm
            - 缓存 key 基于 package-lock.json hash
        - *Requirements*: AC-5 (缓存优化)

- [ ] 3. **创建 Reusable Workflow: 测试流程**
    - [x] 3.1. 实现可重用的测试 workflow
        - *Goal*: 创建可被多个 workflow 调用的测试逻辑
        - *Files*: `.github/workflows/test-reusable.yml`
        - *Details*:
            - 接受 working-directory 输入参数
            - 接受 service-name 输入参数（backend/frontend）
            - Checkout 代码
            - 调用 setup-node-cache action
            - 运行 npm ci
            - 运行 npm run lint
            - 运行 npm run test
            - 运行 npm run test:e2e
            - 上传测试报告（JUnit XML）
            - 上传覆盖率报告（LCOV）
        - *Requirements*: AC-1 (PR 检查), AC-3 (版本发布)

### Phase 3: PR Check Workflow

- [x] 4. **创建 PR Check Workflow**
    - [x] 4.1. 实现 PR 检查主 workflow
        - *Goal*: 自动验证 PR 的代码质量
        - *Files*: `.github/workflows/pr-check.yml`
        - *Details*:
            - 触发条件: pull_request (branches: master)
            - Job 1: test-backend (调用 test-reusable.yml)
            - Job 2: test-frontend (调用 test-reusable.yml)
            - Job 3: build-backend-validation (构建但不推送)
            - Job 4: build-frontend-validation (构建但不推送)
            - Job 5: security-scan (Trivy 扫描)
            - 并发策略: group by PR number
        - *Requirements*: AC-1 (PR 检查流水线)

    - [x] 4.2. 实现 Backend 构建验证
        - *Goal*: 验证 Backend Docker 镜像可构建性
        - *Files*: `.github/workflows/pr-check.yml` (build-backend-validation job)
        - *Details*:
            - 依赖: test-backend job
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/build-push-action@v5
            - context: ./backend
            - push: false (仅构建不推送)
            - 设置构建超时: 15 分钟
        - *Requirements*: AC-1

    - [x] 4.3. 实现 Frontend 构建验证
        - *Goal*: 验证 Frontend Docker 镜像可构建性
        - *Files*: `.github/workflows/pr-check.yml` (build-frontend-validation job)
        - *Details*:
            - 依赖: test-frontend job
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/build-push-action@v5
            - context: ./frontend
            - push: false (仅构建不推送)
            - 设置构建超时: 10 分钟
        - *Requirements*: AC-1

    - [x] 4.4. 实现安全扫描
        - *Goal*: 使用 Trivy 扫描构建的镜像
        - *Files*: `.github/workflows/pr-check.yml` (security-scan job)
        - *Details*:
            - 依赖: build-backend-validation, build-frontend-validation
            - 使用 aquasecurity/trivy-action@master
            - 扫描 backend 和 frontend 镜像
            - 输出格式: sarif
            - 上传结果到 GitHub Security
            - severity: CRITICAL,HIGH,MEDIUM
            - exit-code: 0 (仅警告，不阻止 PR)
        - *Requirements*: AC-4 (镜像安全扫描)

### Phase 4: Build & Push Workflow

- [ ] 5. **创建 Build & Push Workflow**
    - [x] 5.1. 实现主构建 workflow
        - *Goal*: 自动构建并推送开发版本镜像
        - *Files*: `.github/workflows/build.yml`
        - *Details*:
            - 触发条件: push (branches: master)
            - 路径过滤: backend/**, frontend/**, .github/workflows/build.yml
            - Job 1: test (调用 test-reusable.yml)
            - Job 2: build-backend (并行)
            - Job 3: build-frontend (并行)
            - Job 4: scan-and-push (依赖 build jobs)
        - *Requirements*: AC-2 (开发分支镜像构建)

    - [x] 5.2. 实现 Backend 镜像构建和推送
        - *Goal*: 构建并推送 Backend 镜像到 ghcr.io
        - *Files*: `.github/workflows/build.yml` (build-backend job)
        - *Details*:
            - 依赖: test job
            - permissions: contents: read, packages: write
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/login-action@v3 登录 ghcr.io
            - 使用 docker/build-push-action@v5
            - context: ./backend
            - platforms: linux/amd64
            - push: true
            - tags:
                - ghcr.io/${{ github.repository }}-backend:latest
                - ghcr.io/${{ github.repository }}-backend:master-${{ github.sha }}
            - 启用 Docker layer cache
            - 设置构建超时: 15 分钟
        - *Requirements*: AC-2, AC-5 (缓存优化)

    - [x] 5.3. 实现 Frontend 镜像构建和推送
        - *Goal*: 构建并推送 Frontend 镜像到 ghcr.io
        - *Files*: `.github/workflows/build.yml` (build-frontend job)
        - *Details*:
            - 依赖: test job
            - permissions: contents: read, packages: write
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/login-action@v3 登录 ghcr.io
            - 使用 docker/build-push-action@v5
            - context: ./frontend
            - platforms: linux/amd64
            - push: true
            - tags:
                - ghcr.io/${{ github.repository }}-frontend:latest
                - ghcr.io/${{ github.repository }}-frontend:master-${{ github.sha }}
            - 启用 Docker layer cache
            - 设置构建超时: 10 分钟
        - *Requirements*: AC-2, AC-5

    - [x] 5.4. 实现镜像安全扫描（Build workflow）
        - *Goal*: 扫描已推送的镜像
        - *Files*: `.github/workflows/build.yml` (scan-images job)
        - *Details*:
            - 依赖: build-backend, build-frontend
            - 使用 aquasecurity/trivy-action@master
            - 扫描 latest 标签的镜像
            - 输出格式: sarif
            - 上传结果到 GitHub Security
            - severity: CRITICAL,HIGH
            - exit-code: 0 (仅警告)
        - *Requirements*: AC-4

### Phase 5: Release Workflow

- [x] 6. **创建 Release Workflow**
    - [x] 6.1. 实现版本验证 job
        - *Goal*: 验证 Git tag 格式并提取版本号
        - *Files*: `.github/workflows/release.yml` (validate-tag job)
        - *Details*:
            - 触发条件: push (tags: v*.*.*)
            - 验证 tag 格式符合语义化版本
            - 提取版本号（major.minor.patch）
            - 输出版本号供后续 jobs 使用
            - 验证失败时终止 workflow
        - *Requirements*: AC-3 (版本发布流程)

    - [x] 6.2. 实现完整测试 job
        - *Goal*: 运行完整测试套件
        - *Files*: `.github/workflows/release.yml` (test job)
        - *Details*:
            - 依赖: validate-tag job
            - 调用 test-reusable.yml (backend)
            - 调用 test-reusable.yml (frontend)
            - 测试失败时终止 workflow
        - *Requirements*: AC-3

    - [x] 6.3. 实现多版本标签镜像构建（Backend）
        - *Goal*: 构建并推送带版本号的 Backend 镜像
        - *Files*: `.github/workflows/release.yml` (build-backend job)
        - *Details*:
            - 依赖: test job
            - permissions: contents: read, packages: write
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/login-action@v3
            - 使用 docker/build-push-action@v5
            - context: ./backend
            - platforms: linux/amd64
            - push: true
            - tags（动态生成）:
                - ghcr.io/${{ github.repository }}-backend:${{ version }}
                - ghcr.io/${{ github.repository }}-backend:${{ major }}.${{ minor }}
                - ghcr.io/${{ github.repository }}-backend:${{ major }}
                - ghcr.io/${{ github.repository }}-backend:latest
            - 启用 Docker layer cache
        - *Requirements*: AC-3

    - [x] 6.4. 实现多版本标签镜像构建（Frontend）
        - *Goal*: 构建并推送带版本号的 Frontend 镜像
        - *Files*: `.github/workflows/release.yml` (build-frontend job)
        - *Details*:
            - 依赖: test job
            - permissions: contents: read, packages: write
            - 使用 docker/setup-buildx-action@v3
            - 使用 docker/login-action@v3
            - 使用 docker/build-push-action@v5
            - context: ./frontend
            - platforms: linux/amd64
            - push: true
            - tags（动态生成）:
                - ghcr.io/${{ github.repository }}-frontend:${{ version }}
                - ghcr.io/${{ github.repository }}-frontend:${{ major }}.${{ minor }}
                - ghcr.io/${{ github.repository }}-frontend:${{ major }}
                - ghcr.io/${{ github.repository }}-frontend:latest
            - 启用 Docker layer cache
        - *Requirements*: AC-3

    - [x] 6.5. 实现严格安全扫描
        - *Goal*: 扫描发布镜像，高危漏洞阻止发布
        - *Files*: `.github/workflows/release.yml` (security-scan job)
        - *Details*:
            - 依赖: build-backend, build-frontend
            - 使用 aquasecurity/trivy-action@master
            - 扫描版本号标签的镜像
            - 输出格式: sarif
            - 上传结果到 GitHub Security
            - severity: CRITICAL,HIGH
            - exit-code: 1 (发现高危漏洞时失败)
        - *Requirements*: AC-4

    - [x] 6.6. 实现 GitHub Release 创建
        - *Goal*: 自动创建 GitHub Release
        - *Files*: `.github/workflows/release.yml` (create-release job)
        - *Details*:
            - 依赖: security-scan job
            - permissions: contents: write
            - 使用 gh CLI 创建 release
            - 标题: v${{ version }}
            - 生成 release notes (自动提取 commits)
            - 附加 CHANGELOG.md（如果存在）
            - 标记为 latest release
        - *Requirements*: AC-3

### Phase 6: 错误处理和通知

- [ ] 7. **实现失败通知机制**
    - [x] 7.1. 添加构建失败通知 job（可选）
        - *Goal*: 构建失败时发送通知
        - *Files*: `.github/workflows/build.yml`, `.github/workflows/release.yml`
        - *Details*:
            - 仅在失败时运行: if: failure()
            - 依赖所有构建 jobs
            - 发送 GitHub Issue 或评论（使用 GitHub API）
            - 包含失败原因、commit、分支信息
            - 需要配置 GITHUB_TOKEN 权限
        - *Requirements*: 可用性要求（失败通知）

### Phase 7: 优化和配置

- [x] 8. **配置缓存策略**
    - [x] 8.1. 优化 NPM 依赖缓存
        - *Goal*: 加速依赖安装
        - *Files*: `.github/actions/setup-node-cache/action.yml`
        - *Details*:
            - cache key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
            - restore-keys: ${{ runner.os }}-node-
            - cache path: ~/.npm
        - *Requirements*: AC-5 (构建缓存优化)

    - [x] 8.2. 配置 Docker layer cache
        - *Goal*: 加速 Docker 镜像构建
        - *Files*: `.github/workflows/build.yml`, `.github/workflows/release.yml`
        - *Details*:
            - cache-from: type=registry,ref=ghcr.io/${{ github.repository }}-{service}:buildcache
            - cache-to: type=registry,ref=ghcr.io/${{ github.repository }}-{service}:buildcache,mode=max
            - 确保有 buildcache 标签的推送权限
        - *Requirements*: AC-5

- [ ] 9. **添加构建状态徽章**
    - [x] 9.1. 更新 README.md 添加 workflow 徽章
        - *Goal*: 在 README 中显示构建状态
        - *Files*: `README.md`
        - *Details*:
            - 添加 Build & Push workflow 徽章
            - 添加 PR Check workflow 徽章
            - 添加 Latest Release 徽章
            - 添加镜像版本徽章
        - *Requirements*: 可用性要求（状态可见）

### Phase 8: 环境变量和密钥配置指南

- [ ] 10. **创建 GitHub Secrets 配置文档**
    - [x] 10.1. 编写 Secrets 配置说明
        - *Goal*: 指导用户配置必要的 Secrets
        - *Files*: `.github/SETUP.md`（新建）
        - *Details*:
            - 列出所有必需的 Secrets
            - GHCR_TOKEN（或使用 GITHUB_TOKEN）
            - 可选的通知 webhooks
            - 详细配置步骤
            - 权限要求说明
        - *Requirements*: AC-6 (环境变量管理)

## Task Dependencies

### 串行依赖
- **Phase 1** 必须最先完成（创建目录结构）
- **Phase 2** 必须在 Phase 3, 4, 5 之前完成（可重用组件）
- **Phase 3, 4, 5** 可以并行开发（三个独立 workflow）
- **Phase 6, 7** 依赖 Phase 3, 4, 5 完成
- **Phase 8** 可以在任何时候进行（文档任务）

### 并行任务
- Task 4 (PR Check), Task 5 (Build), Task 6 (Release) 可并行开发
- Task 5.2 (Backend) 和 Task 5.3 (Frontend) 可并行开发
- Task 6.3 (Backend) 和 Task 6.4 (Frontend) 可并行开发

### 关键路径
```
Phase 1 → Phase 2 → Phase 4 (Build Workflow) → Phase 6 → Phase 7
```

## Implementation Order

推荐实现顺序：

1. **Phase 1**: 基础设施准备（30 分钟）
2. **Phase 2**: 可重用组件（1-2 小时）
3. **Phase 4**: Build & Push Workflow（2-3 小时，优先级最高）
4. **Phase 3**: PR Check Workflow（2-3 小时）
5. **Phase 5**: Release Workflow（2-3 小时）
6. **Phase 7**: 缓存优化（1 小时）
7. **Phase 9**: 构建徽章（30 分钟）
8. **Phase 6**: 失败通知（可选，1 小时）
9. **Phase 8**: 文档（可选，1 小时）

总计：约 10-15 小时

## Verification Checklist

完成后验证清单：

- [ ] PR 创建时自动运行测试和构建验证
- [ ] Push 到 master 时自动构建并推送镜像到 ghcr.io
- [ ] 推送 Git tag 时自动发布版本和创建 GitHub Release
- [ ] 所有 workflows 都能在 5 分钟内完成（backend < 5min, frontend < 3min）
- [ ] Docker 镜像可以成功拉取并运行
- [ ] 安全扫描报告显示在 GitHub Security 标签页
- [ ] README 中的构建状态徽章正常显示
- [ ] 缓存机制正常工作（第二次构建明显更快）
