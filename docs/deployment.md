# XXL-Job Enhance 部署指南

本文档提供两种部署方式：**生产环境部署**（使用预构建镜像）和**开发环境部署**（从源码构建）。

---

## 📋 目录

- [前置要求](#前置要求)
- [方式一：生产环境部署（推荐）](#方式一生产环境部署推荐)
- [方式二：开发环境部署（从源码）](#方式二开发环境部署从源码)
- [环境变量配置](#环境变量配置)
- [初始化管理员账号](#初始化管理员账号)
- [高级配置](#高级配置)
- [运维管理](#运维管理)
- [故障排查](#故障排查)
- [安全最佳实践](#安全最佳实践)
- [监控和维护](#监控和维护)

---

## 前置要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+/CentOS 7+/Debian 10+)
- **架构**: x86_64 (amd64)
- **内存**: 最低 2GB，推荐 4GB+
- **磁盘**: 最低 10GB 可用空间

### 软件依赖
- **Docker**: 20.10.0+
- **Docker Compose**: 2.0.0+
- **XXL-Job Admin**: 已部署并运行

### 安装 Docker 和 Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt-get install docker-compose-plugin

# CentOS/RHEL
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

---

## 方式一：生产环境部署（推荐）

使用 GitHub Container Registry 上的预构建镜像，无需克隆源码。

### 1. 创建部署目录

```bash
# 创建项目目录
mkdir -p ~/xxljob-enhance
cd ~/xxljob-enhance
```

### 2. 创建 docker-compose.yml

```bash
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  # Backend Service
  backend:
    image: ghcr.io/konghanghang/xxljob-enhance/backend:latest
    container_name: xxljob-enhance-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Database
      DATABASE_URL: file:/app/data/prod.db

      # JWT Configuration
      JWT_SECRET: ${JWT_SECRET}
      JWT_ACCESS_TOKEN_EXPIRATION: ${JWT_ACCESS_TOKEN_EXPIRATION:-1h}
      JWT_REFRESH_TOKEN_EXPIRATION: ${JWT_REFRESH_TOKEN_EXPIRATION:-7d}

      # XXL-Job Admin Configuration
      XXL_JOB_ADMIN_URL: ${XXL_JOB_ADMIN_URL}
      XXL_JOB_ADMIN_USERNAME: ${XXL_JOB_ADMIN_USERNAME}
      XXL_JOB_ADMIN_PASSWORD: ${XXL_JOB_ADMIN_PASSWORD}

      # Application Configuration
      NODE_ENV: production
      PORT: 3000

      # CORS Configuration
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost}
    volumes:
      # Persist SQLite database
      - sqlite-data:/app/data
    networks:
      - xxljob-enhance-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  # Frontend Service
  frontend:
    image: ghcr.io/konghanghang/xxljob-enhance/frontend:latest
    container_name: xxljob-enhance-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - xxljob-enhance-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

# Named volumes for data persistence
volumes:
  sqlite-data:
    driver: local
    name: xxljob-enhance-sqlite-data

# Custom network
networks:
  xxljob-enhance-network:
    driver: bridge
    name: xxljob-enhance-network
EOF
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
cat > .env <<'EOF'
# ========================================
# JWT 配置（必须修改）
# ========================================
# JWT 密钥（至少 32 字符，强烈建议使用随机生成的密钥）
JWT_SECRET=your-super-secret-jwt-key-change-me-in-production-at-least-32-chars

# Token 过期时间
JWT_ACCESS_TOKEN_EXPIRATION=1h
JWT_REFRESH_TOKEN_EXPIRATION=7d

# ========================================
# XXL-Job Admin 配置（必须修改）
# ========================================
# XXL-Job Admin 地址（替换为你的实际地址）
XXL_JOB_ADMIN_URL=http://your-xxljob-admin:8080/xxl-job-admin

# XXL-Job Admin 登录凭证
XXL_JOB_ADMIN_USERNAME=admin
XXL_JOB_ADMIN_PASSWORD=123456

# ========================================
# CORS 配置
# ========================================
# 允许的前端域名（生产环境改为你的实际域名）
CORS_ORIGIN=http://your-domain.com
EOF
```

**⚠️ 重要：修改配置**

生成安全的 JWT_SECRET：
```bash
# 生成 64 字符的随机密钥
openssl rand -base64 64 | tr -d '\n'
```

然后编辑 `.env` 文件，替换以下内容：
- `JWT_SECRET`: 使用上面生成的随机密钥
- `XXL_JOB_ADMIN_URL`: 替换为你的 XXL-Job Admin 实际地址
- `XXL_JOB_ADMIN_USERNAME` 和 `XXL_JOB_ADMIN_PASSWORD`: 替换为实际凭证
- `CORS_ORIGIN`: 如果有域名，替换为实际域名（多个域名用逗号分隔）

### 4. 登录 GitHub Container Registry（如果镜像是私有的）

```bash
# 使用 GitHub Personal Access Token 登录
# 创建 Token: https://github.com/settings/tokens
# 权限: 勾选 read:packages

echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u konghanghang --password-stdin
```

**注意**: 如果镜像已设为公开，可以跳过此步骤。

### 5. 启动服务

```bash
# 拉取最新镜像
docker compose pull

# 启动服务（后台运行）
docker compose up -d

# 查看启动日志
docker compose logs -f

# 查看服务状态
docker compose ps
```

### 6. 验证部署

```bash
# 检查后端健康状态
curl http://localhost:3000/health

# 检查前端访问
curl http://localhost/

# 查看容器日志
docker compose logs backend
docker compose logs frontend
```

### 7. 访问应用

- **前端界面**: http://your-server-ip
- **后端 API**: http://your-server-ip:3000

---

## 方式二：开发环境部署（从源码）

适合需要修改代码或参与开发的场景。

### 1. 克隆项目

```bash
git clone https://github.com/konghanghang/xxljob-enhance.git
cd xxljob-enhance
```

### 2. 配置环境变量

复制环境变量示例文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，**至少需要修改以下配置**：

```env
# ⚠️ 生产环境必须修改！
JWT_SECRET=your-secure-secret-key-minimum-32-characters

# 修改为你的 XXL-Job Admin 地址
XXL_JOB_ADMIN_URL=http://your-xxljob-admin:8080/xxl-job-admin
XXL_JOB_ADMIN_USERNAME=admin
XXL_JOB_ADMIN_PASSWORD=123456
```

**生成安全的 JWT_SECRET：**
```bash
openssl rand -base64 32
```

### 3. 构建并启动服务

```bash
# 构建镜像
docker compose build

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f
```

### 4. 更新部署

更新应用到新版本：

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 停止服务
docker compose down

# 3. 重新构建镜像
docker compose build

# 4. 启动服务
docker compose up -d

# 5. 查看日志确认正常
docker compose logs -f
```

---

## 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `JWT_SECRET` | JWT 签名密钥（生产环境必改） | 至少 32 字符 |
| `XXL_JOB_ADMIN_URL` | XXL-Job Admin 地址 | `http://localhost:8080/xxl-job-admin` |
| `XXL_JOB_ADMIN_USERNAME` | XXL-Job 用户名 | `admin` |
| `XXL_JOB_ADMIN_PASSWORD` | XXL-Job 密码 | `123456` |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `JWT_ACCESS_TOKEN_EXPIRATION` | Access Token 有效期 | `1h` |
| `JWT_REFRESH_TOKEN_EXPIRATION` | Refresh Token 有效期 | `7d` |
| `CORS_ORIGIN` | 允许的跨域来源 | `http://localhost` |

---

## 初始化管理员账号

系统首次启动后，需要手动创建初始管理员账号。

### 方法 1：使用 Prisma Studio（推荐）

1. 进入后端容器：
```bash
docker compose exec backend sh
```

2. 启动 Prisma Studio：
```bash
npx prisma studio
```

3. 在浏览器中打开 http://localhost:5555

4. 创建管理员用户：
   - 点击 `User` 表
   - 点击 `Add record`
   - 填写信息：
     - `username`: `admin`
     - `password`: 使用 bcrypt 加密的密码（见下方）
     - `isAdmin`: `true`
     - `isActive`: `true`

### 方法 2：直接使用 SQL

1. 生成 bcrypt 密码哈希：
```bash
# 在容器内运行
docker compose exec backend node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(console.log)"
```

2. 进入容器：
```bash
docker compose exec backend sh
```

3. 执行 SQL：
```bash
sqlite3 /app/data/prod.db <<EOF
INSERT INTO User (username, password, isAdmin, isActive, createdAt, updatedAt)
VALUES (
  'admin',
  '生成的bcrypt哈希值',
  1,
  1,
  datetime('now'),
  datetime('now')
);
EOF
```

### 方法 3：使用 API 创建（如果已有管理员）

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newadmin",
    "password": "secure-password",
    "isAdmin": true
  }'
```

---

## 高级配置

### 使用自定义端口

修改 `docker-compose.yml` 中的端口映射：

```yaml
services:
  backend:
    ports:
      - "8080:3000"  # 宿主机端口:容器端口

  frontend:
    ports:
      - "8081:80"
```

### 使用 Nginx 反向代理

创建 `/etc/nginx/conf.d/xxljob-enhance.conf`：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### HTTPS 配置（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 3 * * * certbot renew --quiet
```

### 数据备份

创建备份脚本：

```bash
cat > backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/backup/xxljob-enhance"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker compose exec backend sh -c "sqlite3 /app/data/prod.db '.backup /app/data/backup-$DATE.db'"
docker cp xxljob-enhance-backend:/app/data/backup-$DATE.db $BACKUP_DIR/

# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup-*.db" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup-$DATE.db"
EOF

chmod +x backup.sh

# 添加定时任务（每天凌晨 2 点备份）
crontab -e
# 添加: 0 2 * * * /path/to/backup.sh
```

---

## 运维管理

### 查看日志

```bash
# 实时查看所有日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend

# 查看最近 100 行日志
docker compose logs --tail=100 backend
```

### 重启服务

```bash
# 重启所有服务
docker compose restart

# 重启特定服务
docker compose restart backend
docker compose restart frontend

# 完全停止并重新启动
docker compose down
docker compose up -d
```

### 更新镜像（生产部署）

```bash
# 拉取最新镜像
docker compose pull

# 重新创建容器（不影响数据）
docker compose up -d --force-recreate

# 清理旧镜像
docker image prune -a
```

### 监控资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a
```

---

## 故障排查

### 服务无法启动

1. **检查端口占用**：
```bash
# 检查 3000 和 80 端口是否被占用
sudo netstat -tlnp | grep -E ':(80|3000)'
sudo lsof -i :80
sudo lsof -i :3000
```

2. **查看容器日志**：
```bash
docker compose logs backend
docker compose logs frontend
```

3. **检查环境变量**：
```bash
docker compose config
```

### 无法连接 XXL-Job Admin

1. **检查网络连通性**：
```bash
docker compose exec backend sh
ping your-xxljob-admin-host
curl http://your-xxljob-admin:8080/xxl-job-admin
```

2. **验证凭据**：
   - 确认 `XXL_JOB_ADMIN_USERNAME` 和 `XXL_JOB_ADMIN_PASSWORD` 正确
   - 检查 XXL-Job Admin 是否允许该用户登录

### 数据库问题

1. **查看 Prisma 迁移状态**：
```bash
docker compose exec backend npx prisma migrate status
```

2. **手动运行迁移**：
```bash
docker compose exec backend npx prisma migrate deploy
```

3. **重置数据库**（⚠️ 会删除所有数据）：
```bash
docker compose down -v
docker compose up -d
```

### 镜像拉取失败

```bash
# 检查是否登录
docker login ghcr.io

# 手动拉取镜像测试
docker pull ghcr.io/konghanghang/xxljob-enhance/backend:latest
docker pull ghcr.io/konghanghang/xxljob-enhance/frontend:latest

# 检查网络连接
ping ghcr.io
curl -I https://ghcr.io
```

### 无法访问服务

```bash
# 检查防火墙
sudo ufw status
sudo firewall-cmd --list-all

# 开放端口（Ubuntu/Debian）
sudo ufw allow 80/tcp
sudo ufw allow 3000/tcp

# 开放端口（CentOS/RHEL）
sudo firewall-cmd --add-port=80/tcp --permanent
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

### 健康检查失败

```bash
# 查看健康状态
docker inspect xxljob-enhance-backend | grep -A 10 Health
docker inspect xxljob-enhance-frontend | grep -A 10 Health

# 手动测试健康检查
docker compose exec backend sh -c "node -e \"require('http').get('http://localhost:3000/health', (r) => {console.log(r.statusCode)})\""
docker compose exec frontend sh -c "wget --quiet --tries=1 --spider http://localhost/health && echo OK || echo FAIL"
```

### 前端无法访问后端

1. **检查 CORS 配置**：
   - 确保 `CORS_ORIGIN` 包含前端域名

2. **检查网络配置**：
```bash
docker network inspect xxljob-enhance-network
```

3. **验证 API 连接**：
```bash
curl http://localhost:3000/health
```

---

## 安全最佳实践

### 生产环境安全检查清单

- [ ] 修改 `JWT_SECRET` 为随机生成的强密钥（至少 64 字符）
- [ ] 使用 HTTPS（配置反向代理如 Nginx）
- [ ] 修改默认管理员密码
- [ ] 配置防火墙规则，限制来源 IP
- [ ] 定期备份数据库
- [ ] 启用日志监控
- [ ] 使用非 root 用户运行容器（已配置）
- [ ] 定期更新镜像到最新版本
- [ ] 审计日志定期导出

### 1. 修改默认密码
```bash
# 生成强随机密钥
openssl rand -base64 64 | tr -d '\n'
```
- 修改 `.env` 中的 `JWT_SECRET`
- 修改 XXL-Job Admin 的默认密码

### 2. 使用 HTTPS
- 在生产环境中始终使用 HTTPS
- 使用 Let's Encrypt 免费证书

### 3. 限制网络访问
```bash
# 使用防火墙限制访问
sudo ufw enable
sudo ufw allow from YOUR_OFFICE_IP to any port 3000
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 4. 定期更新镜像
```bash
# 订阅 GitHub 仓库的 Release 通知
# 定期执行更新
docker compose pull
docker compose up -d --force-recreate
```

### 5. 日志审计
```bash
# 导出审计日志
docker compose exec backend sh -c "sqlite3 /app/data/prod.db 'SELECT * FROM AuditLog ORDER BY timestamp DESC LIMIT 1000;'" > audit-$(date +%Y%m%d).csv
```

---

## 监控和维护

### 健康检查

系统内置健康检查端点：

- **后端**: `GET /health`
- **前端**: `GET /health`

配置外部监控工具（如 Prometheus）：

```yaml
# 在 docker-compose.yml 中添加
services:
  backend:
    labels:
      - "prometheus.scrape=true"
      - "prometheus.port=3000"
      - "prometheus.path=/metrics"
```

### 日志管理

配置日志轮转（docker-compose.yml）：

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 性能优化

1. **限制资源使用**：
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

2. **使用 CDN**：
   - 将静态资源托管到 CDN
   - 配置 nginx 缓存策略

---

## 常用命令参考

```bash
# ========== 服务管理 ==========
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看服务状态
docker compose ps

# ========== 日志查看 ==========
# 实时查看所有日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend

# 查看最近 N 行日志
docker compose logs --tail=100 backend

# ========== 容器管理 ==========
# 进入容器
docker compose exec backend sh
docker compose exec frontend sh

# 在容器中执行命令
docker compose exec backend npx prisma migrate status

# ========== 镜像和更新 ==========
# 拉取最新镜像（生产部署）
docker compose pull

# 重新创建容器
docker compose up -d --force-recreate

# 重新构建镜像（开发部署）
docker compose build

# ========== 清理操作 ==========
# 清理未使用的镜像
docker image prune -a

# 清理未使用的资源
docker system prune -a

# 完全清理（包括数据卷，危险！）
docker compose down -v

# ========== 备份和恢复 ==========
# 备份数据库
docker compose exec backend sh -c "sqlite3 /app/data/prod.db '.backup /app/data/backup.db'"
docker cp xxljob-enhance-backend:/app/data/backup.db ./backup-$(date +%Y%m%d).db

# 恢复数据库
docker cp ./backup.db xxljob-enhance-backend:/app/data/restore.db
docker compose exec backend sh -c "sqlite3 /app/data/prod.db '.restore /app/data/restore.db'"

# ========== 监控 ==========
# 查看资源使用
docker stats

# 查看磁盘使用
docker system df

# 查看网络
docker network inspect xxljob-enhance-network
```

---

## 镜像版本说明

### 可用标签

- `latest`: 最新稳定版本（跟踪 master 分支）
- `v1.0.0`: 特定版本（跟踪 Git tags）
- `master-{sha}`: 特定 commit 版本

### 使用特定版本

```yaml
services:
  backend:
    image: ghcr.io/konghanghang/xxljob-enhance/backend:v1.0.0
  frontend:
    image: ghcr.io/konghanghang/xxljob-enhance/frontend:v1.0.0
```

---

## 推荐的生产环境架构

```
[Internet]
    ↓
[Nginx / Traefik（反向代理 + SSL）]
    ↓
[xxljob-enhance Frontend:80]
    ↓
[xxljob-enhance Backend:3000]
    ↓
[XXL-Job Admin:8080]
```

---

## 支持与反馈

如遇到问题，请：

1. 查看本文档的[故障排查](#故障排查)部分
2. 查看项目 [GitHub Issues](https://github.com/konghanghang/xxljob-enhance/issues)
3. 提交新的 Issue 并附上：
   - 错误日志
   - 环境信息（Docker 版本、操作系统）
   - 复现步骤
