# XXL-Job Enhance 生产环境部署指引

## 📋 前置要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+/CentOS 7+/Debian 10+)
- **架构**: x86_64 (amd64)
- **内存**: 最低 2GB，推荐 4GB+
- **磁盘**: 最低 10GB 可用空间

### 软件依赖
- **Docker**: 20.10.0+
- **Docker Compose**: 2.0.0+

安装 Docker 和 Docker Compose（如果未安装）：

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

## 🚀 快速部署（推荐）

### 1. 创建部署目录

```bash
# 创建项目目录
mkdir -p ~/xxljob-enhance
cd ~/xxljob-enhance

# 创建数据目录（用于存储 SQLite 数据库）
mkdir -p data
```

### 2. 下载配置文件

创建 `docker-compose.yml` 文件：

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
XXL_JOB_ADMIN_URL=http://your-xxl-job-admin:8080/xxl-job-admin

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

## 🔐 数据库初始化

### 自动初始化

服务启动时会自动运行数据库迁移：
```bash
# 在 Backend Dockerfile 的 CMD 中已配置
npx prisma migrate deploy && node dist/main
```

### 手动初始化（可选）

如果需要手动创建管理员账号：

```bash
# 进入 Backend 容器
docker compose exec backend sh

# 使用 Prisma Studio（开发环境）
npx prisma studio

# 或者直接操作数据库
sqlite3 /app/data/prod.db

# 创建管理员账号（密码: admin123）
INSERT INTO User (id, username, password, isActive, isAdmin, createdAt, updatedAt)
VALUES (
  1,
  'admin',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyes1K8G5Zi5F/rRqOqTzjVLrJqR3z9bN2',
  1,
  1,
  datetime('now'),
  datetime('now')
);
```

---

## 🔧 高级配置

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
    listen 80;
    server_name your-domain.com;

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

```bash
# 备份脚本
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

## 🛠️ 运维管理

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

### 更新镜像

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

## 🐛 故障排查

### 服务无法启动

```bash
# 检查容器状态
docker compose ps

# 查看详细错误日志
docker compose logs backend
docker compose logs frontend

# 检查端口占用
sudo netstat -tlnp | grep -E ':(80|3000)'
sudo lsof -i :80
sudo lsof -i :3000
```

### 数据库问题

```bash
# 进入容器查看数据库
docker compose exec backend sh
sqlite3 /app/data/prod.db

# 检查表结构
.tables
.schema User

# 重置数据库（危险操作！）
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

---

## 🔒 安全最佳实践

### 1. 修改默认密码
- 修改 `.env` 中的 `JWT_SECRET` 为强随机密钥
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

## 📊 生产环境检查清单

部署前检查：

- [ ] 已修改 `JWT_SECRET` 为强随机密钥（至少 32 字符）
- [ ] 已配置正确的 `XXL_JOB_ADMIN_URL`
- [ ] 已配置正确的 XXL-Job Admin 凭证
- [ ] 已配置 `CORS_ORIGIN` 为实际域名
- [ ] 已开放必要的防火墙端口（80, 3000）
- [ ] 已配置 HTTPS（生产环境）
- [ ] 已配置 Nginx 反向代理（可选）
- [ ] 已设置数据库备份定时任务
- [ ] 已测试服务健康检查
- [ ] 已创建管理员账号
- [ ] 已验证与 XXL-Job Admin 的连接

---

## 📞 支持与反馈

- **GitHub Issues**: https://github.com/konghanghang/xxljob-enhance/issues
- **文档**: 查看项目 README.md

---

## 📝 版本说明

### 镜像标签

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

## 🎯 快速命令参考

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 查看状态
docker compose ps

# 重启服务
docker compose restart

# 更新镜像
docker compose pull && docker compose up -d --force-recreate

# 备份数据库
docker compose exec backend sh -c "sqlite3 /app/data/prod.db '.backup /app/data/backup.db'"

# 进入容器
docker compose exec backend sh
docker compose exec frontend sh

# 清理资源
docker compose down -v  # 危险：会删除数据卷
docker system prune -a   # 清理未使用的镜像和容器
```
