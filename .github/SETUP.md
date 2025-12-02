# GitHub CI/CD Setup Guide

本文档指导你如何配置 GitHub Actions CI/CD 流水线所需的环境变量和密钥。

## 前置要求

- GitHub 仓库已创建
- 拥有仓库的管理员权限
- 已启用 GitHub Container Registry (ghcr.io)

## 自动配置（推荐）

GitHub Actions 默认提供 `GITHUB_TOKEN`，它具有推送镜像到 GitHub Container Registry 的权限。**大多数情况下，你不需要额外配置任何 Secrets！**

### GITHUB_TOKEN 自动权限

`GITHUB_TOKEN` 已经具备以下权限：
- ✅ 读取仓库内容 (`contents: read`)
- ✅ 推送镜像到 GHCR (`packages: write`)
- ✅ 上传安全扫描结果 (`security-events: write`)
- ✅ 创建 GitHub Release (`contents: write`)

所有 workflows 都已配置为使用 `${{ secrets.GITHUB_TOKEN }}`，无需手动配置。

## 可选配置

### 1. 自定义 Personal Access Token (PAT)

如果你需要跨仓库推送镜像或需要更高权限，可以创建自定义 PAT：

#### 步骤 1: 创建 Personal Access Token

1. 访问 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 设置 Token 名称：`GHCR_TOKEN`
4. 选择权限：
   - ✅ `write:packages` - 推送镜像到 GHCR
   - ✅ `read:packages` - 从 GHCR 拉取镜像
   - ✅ `delete:packages` - 删除旧镜像（可选）
5. 设置过期时间（建议 90 天）
6. 点击 "Generate token" 并复制生成的 token

#### 步骤 2: 添加 Secret 到仓库

1. 访问仓库 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. Name: `GHCR_TOKEN`
4. Secret: 粘贴刚才复制的 token
5. 点击 "Add secret"

#### 步骤 3: 更新 Workflows（如果使用自定义 PAT）

将所有 workflow 文件中的 `${{ secrets.GITHUB_TOKEN }}` 替换为 `${{ secrets.GHCR_TOKEN }}`：

```yaml
# 修改前
password: ${{ secrets.GITHUB_TOKEN }}

# 修改后
password: ${{ secrets.GHCR_TOKEN }}
```

### 2. 构建失败通知（可选）

如果需要在构建失败时发送通知，可以配置以下 Secrets：

#### Slack 通知

1. 在 Slack 中创建 Incoming Webhook
2. 添加 Secret: `SLACK_WEBHOOK_URL`
3. 值为 Webhook URL（例如：`https://hooks.slack.com/services/...`）

#### Discord 通知

1. 在 Discord 频道设置中创建 Webhook
2. 添加 Secret: `DISCORD_WEBHOOK_URL`
3. 值为 Webhook URL（例如：`https://discord.com/api/webhooks/...`）

## 验证配置

### 1. 检查 Secrets

访问仓库 Settings → Secrets and variables → Actions，确认以下 Secrets 已配置（如果使用自定义配置）：

- `GHCR_TOKEN` (可选，如果不使用默认 GITHUB_TOKEN)
- `SLACK_WEBHOOK_URL` (可选)
- `DISCORD_WEBHOOK_URL` (可选)

### 2. 测试 CI/CD 流水线

#### 测试 PR Check

1. 创建一个新分支：
   ```bash
   git checkout -b test-cicd
   ```

2. 做一个小改动并提交：
   ```bash
   echo "# Test" >> README.md
   git add README.md
   git commit -m "test: verify CI/CD setup"
   git push origin test-cicd
   ```

3. 在 GitHub 上创建 Pull Request
4. 检查 PR 页面的 "Checks" 标签，应该看到 "PR Check" workflow 运行

#### 测试 Build & Push

1. 合并 PR 到 master 分支：
   ```bash
   git checkout master
   git merge test-cicd
   git push origin master
   ```

2. 访问 Actions 标签页，应该看到 "Build and Push" workflow 运行
3. 构建完成后，访问仓库 Packages 标签页，应该看到：
   - `xxljob-enhance-backend:latest`
   - `xxljob-enhance-frontend:latest`

#### 测试 Release

1. 创建并推送一个版本 tag：
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. 访问 Actions 标签页，应该看到 "Release" workflow 运行
3. 构建完成后，访问 Releases 页面，应该看到 v0.1.0 发布

## 拉取镜像

### 公开仓库

如果仓库是公开的，镜像也是公开的，可以直接拉取：

```bash
docker pull ghcr.io/{owner}/{repo}-backend:latest
docker pull ghcr.io/{owner}/{repo}-frontend:latest
```

### 私有仓库

如果仓库是私有的，需要先登录：

```bash
# 创建 Personal Access Token (read:packages 权限)
echo $GHCR_TOKEN | docker login ghcr.io -u {username} --password-stdin

# 拉取镜像
docker pull ghcr.io/{owner}/{repo}-backend:latest
```

## 故障排查

### 问题 1: "Resource not accessible by integration"

**原因**: `GITHUB_TOKEN` 权限不足

**解决方案**:
1. 访问仓库 Settings → Actions → General
2. 滚动到 "Workflow permissions"
3. 选择 "Read and write permissions"
4. 勾选 "Allow GitHub Actions to create and approve pull requests"
5. 点击 "Save"

### 问题 2: "authentication required"

**原因**: Docker login 失败

**解决方案**:
1. 检查 `GITHUB_TOKEN` 是否正确传递
2. 确认仓库 Packages 设置允许 Actions 推送

### 问题 3: "cache manifest not found"

**原因**: 首次构建时没有缓存

**解决方案**: 这是正常的，第二次构建会自动使用缓存

### 问题 4: Trivy 扫描失败

**原因**: 镜像存在高危漏洞

**解决方案**:
1. 查看 Security 标签页的扫描报告
2. 更新 Dockerfile 中的基础镜像
3. 更新依赖包版本

## 高级配置

### 自定义镜像仓库

如果需要推送到其他容器仓库（Docker Hub、AWS ECR 等），修改 workflow 文件：

```yaml
env:
  REGISTRY: docker.io  # 改为其他仓库
  IMAGE_NAME: username/repo  # 改为目标镜像名
```

并配置相应的登录凭证 Secret。

### 多架构构建

如果需要构建 ARM64 架构，修改 `platforms` 参数：

```yaml
platforms: linux/amd64,linux/arm64
```

注意：多架构构建时间会显著增加。

## 参考资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)
- [Trivy 安全扫描](https://github.com/aquasecurity/trivy)

## 支持

如果遇到问题，请：
1. 检查 Actions 标签页的日志
2. 查看本文档的故障排查部分
3. 在仓库创建 Issue
