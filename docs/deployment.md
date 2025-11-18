# xxljob-enhance 部署文档

本文档介绍如何使用 Docker 部署 xxljob-enhance 系统。

## 📋 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [初始化管理员账号](#初始化管理员账号)
- [生产环境部署](#生产环境部署)
- [故障排查](#故障排查)

---

## 前置要求

在开始部署前，请确保你的系统已安装：

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **XXL-Job Admin** (已部署并运行)

检查 Docker 版本：
```bash
docker --version
docker compose version
```

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-org/xxljob-enhance.git
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

### 3. 启动服务

使用 Docker Compose 一键启动：

```bash
docker compose up -d
```

查看服务状态：
```bash
docker compose ps
```

查看日志：
```bash
# 查看所有服务日志
docker compose logs -f

# 只查看后端日志
docker compose logs -f backend

# 只查看前端日志
docker compose logs -f frontend
```

### 4. 访问应用

- **前端界面**: http://localhost
- **后端 API**: http://localhost:3000
- **健康检查**:
  - 前端: http://localhost/health
  - 后端: http://localhost:3000/health

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
     - `email`: `admin@example.com`
     - `password`: 使用 bcrypt 加密的密码（见下方）
     - `isAdmin`: `true`
     - `isActive`: `true`

### 方法 2：直接使用 SQL

1. 生成 bcrypt 密码哈希：
```bash
# 在本地运行（需要安装 Node.js）
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(console.log)"
```

2. 进入数据库容器：
```bash
docker compose exec backend sh
```

3. 执行 SQL：
```bash
npx prisma db execute --stdin <<EOF
INSERT INTO User (username, email, password, isAdmin, isActive, createdAt, updatedAt)
VALUES (
  'admin',
  'admin@example.com',
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
    "email": "newadmin@example.com",
    "password": "secure-password",
    "isAdmin": true
  }'
```

---

## 生产环境部署

### 安全性检查清单

- [ ] 修改 `JWT_SECRET` 为随机生成的强密钥
- [ ] 使用 HTTPS（配置反向代理如 Nginx）
- [ ] 修改默认管理员密码
- [ ] 配置防火墙规则
- [ ] 定期备份数据库
- [ ] 启用日志监控

### 推荐的生产环境架构

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

### 使用 Nginx 反向代理

创建 `nginx.conf`：

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

### 数据备份

备份 SQLite 数据库：

```bash
# 创建备份
docker compose exec backend sh -c 'cp /app/data/prod.db /app/data/backup-$(date +%Y%m%d).db'

# 导出备份到宿主机
docker cp xxljob-enhance-backend:/app/data/backup-20250118.db ./backups/
```

定时备份脚本：

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
docker compose exec -T backend sh -c 'cat /app/data/prod.db' > $BACKUP_DIR/backup-$DATE.db

# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup-*.db" -mtime +7 -delete
```

添加到 crontab：
```bash
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup.sh
```

---

## 故障排查

### 服务无法启动

1. **检查端口占用**：
```bash
# 检查 3000 和 80 端口是否被占用
lsof -i :3000
lsof -i :80
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

### 数据库错误

1. **重置数据库**（⚠️ 会删除所有数据）：
```bash
docker compose down -v
docker compose up -d
```

2. **查看 Prisma 迁移状态**：
```bash
docker compose exec backend npx prisma migrate status
```

3. **手动运行迁移**：
```bash
docker compose exec backend npx prisma migrate deploy
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

## 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f [service]

# 进入容器
docker compose exec backend sh
docker compose exec frontend sh

# 更新镜像并重启
docker compose pull
docker compose up -d --force-recreate

# 清理所有数据（包括数据库）
docker compose down -v

# 查看资源使用
docker compose stats
```

---

## 更新部署

更新应用到新版本：

```bash
# 1. 拉取最新代码
git pull origin main

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

## 支持

如遇到问题，请：

1. 查看本文档的故障排查部分
2. 查看项目 GitHub Issues
3. 提交新的 Issue 并附上：
   - 错误日志
   - 环境信息（Docker 版本、操作系统）
   - 复现步骤
