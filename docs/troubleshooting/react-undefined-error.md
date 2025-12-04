# 问题解决记录：React is not defined 错误

## 问题描述

**错误信息：**
```
Uncaught ReferenceError: React is not defined
    at index-BMn5pbvi.js:376:43930
```

**发生环境：**
- 前端访问地址：http://localhost:41080
- 浏览器控制台报错
- 页面空白，无法渲染

**技术栈：**
- React 19.2.0
- Vite 7.2.2
- TypeScript 5.9.3
- @vitejs/plugin-react 5.1.0

---

## 问题分析

### 根本原因

React 19 引入了新的 JSX 转换方式（automatic runtime），但在生产构建中，某些场景下仍需要全局的 `React` 对象。Vite 默认配置未将 React 挂载到全局作用域，导致运行时错误。

### 关键发现

1. **源代码正确**：所有组件都正确导入了 React
   ```typescript
   import React from 'react';
   import { useState } from 'react';
   ```

2. **构建配置问题**：
   - Vite 使用自动 JSX 运行时
   - TypeScript 配置为 `"jsx": "react-jsx"`
   - 构建后的 bundle 中 React 未作为全局变量导出

3. **浏览器缓存干扰**：
   - Docker 重新构建后文件名相同（`index-BMn5pbvi.js`）
   - 浏览器缓存了旧版本的 JavaScript 文件
   - 需要强制刷新才能加载新文件

---

## 解决步骤

### 步骤 1：调整 Vite 配置

**文件：** `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // 使用经典 JSX 运行时以确保更好的兼容性
      jsxRuntime: 'classic',
    }),
  ],
  build: {
    // 禁用 source maps（生产环境）
    sourcemap: false,
    // 优化代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'antd': ['antd'],
        },
      },
    },
  },
})
```

**关键变更：**
- `jsxRuntime: 'automatic'` → `jsxRuntime: 'classic'`
- 添加 `manualChunks` 优化包体积和加载性能

### 步骤 2：调整 TypeScript 配置

**文件：** `frontend/tsconfig.app.json`

```json
{
  "compilerOptions": {
    // ...其他配置
    "jsx": "react",  // 从 "react-jsx" 改为 "react"
  }
}
```

### 步骤 3：在入口文件挂载全局 React

**文件：** `frontend/src/main.tsx`

```typescript
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 确保 React 在全局可用（兼容性）
if (typeof window !== 'undefined') {
  (window as any).React = React;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**为什么需要这一步：**
- 某些第三方库或动态加载的代码可能期望全局 `React`
- React DevTools 需要全局 React 对象
- 提高兼容性和调试便利性

### 步骤 4：重新构建并部署

```bash
# 清除旧镜像并重新构建
docker build --no-cache -t xxljob-enhance-frontend:latest ./frontend

# 重启服务
docker compose down
docker compose up -d

# 验证新文件生成
docker exec xxljob-enhance-frontend ls -la /usr/share/nginx/html/assets/
# 输出应显示新的哈希文件名，例如：index-CyWTGrAs.js
```

### 步骤 5：清除浏览器缓存

**关键步骤！** 浏览器可能缓存了旧的 JavaScript 文件。

**方法 1：硬刷新（推荐）**
- Windows/Linux: `Ctrl + Shift + R` 或 `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**方法 2：开发者工具清除**
1. 打开开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

**方法 3：无痕模式**
- 打开新的无痕/隐私浏览窗口
- 访问 http://localhost:41080

---

## 验证方法

### 1. 检查加载的文件名

打开浏览器开发者工具 → Network 标签页 → 刷新页面

确认加载的是**新的文件名**（例如 `index-CyWTGrAs.js`），而不是旧的 `index-BMn5pbvi.js`。

### 2. 检查全局 React 对象

在浏览器控制台执行：

```javascript
window.React
// 应该输出 React 对象，包含 createElement、useState 等方法
```

### 3. 检查页面渲染

- 页面应该正常显示内容
- 控制台无 "React is not defined" 错误
- React 组件正常交互

---

## 相关技术知识

### React 18 vs React 19 JSX 转换

**React 17+ 新 JSX 转换（automatic）：**
```typescript
// 源代码
function App() {
  return <h1>Hello</h1>;
}

// 编译后（自动导入）
import { jsx as _jsx } from "react/jsx-runtime";
function App() {
  return _jsx("h1", { children: "Hello" });
}
```

**经典 JSX 转换（classic）：**
```typescript
// 源代码
import React from 'react';
function App() {
  return <h1>Hello</h1>;
}

// 编译后
import React from 'react';
function App() {
  return React.createElement("h1", null, "Hello");
}
```

### 为什么使用 classic 模式

1. **兼容性更好**：某些库期望全局 `React`
2. **调试更容易**：`React.createElement` 调用清晰可见
3. **避免运行时错误**：确保 React 在所有上下文中可用
4. **简化配置**：减少构建配置的复杂性

### Vite 代码分割策略

```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],  // ~150KB
  'router': ['react-router-dom'],           // ~50KB
  'antd': ['antd'],                        // ~800KB
}
```

**优势：**
- 分离大型依赖库，利用浏览器缓存
- 减少初始加载时间
- 提高并发加载效率

---

## 预防措施

### 1. 开发环境配置

在 `vite.config.ts` 中添加：

```typescript
export default defineConfig({
  // 开发服务器配置
  server: {
    // 强制刷新缓存
    force: true,
  },
})
```

### 2. Docker 构建最佳实践

```dockerfile
# 在 Dockerfile 中添加版本标签
ARG BUILD_DATE
ARG VCS_REF
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.vcs-ref=$VCS_REF
```

### 3. 前端缓存控制

在 `nginx.conf` 中配置：

```nginx
location /assets/ {
    # JavaScript 和 CSS 使用内容哈希，可以长期缓存
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location / {
    # HTML 文件不缓存，确保获取最新版本
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 4. CI/CD 构建验证

```bash
# 构建后验证文件存在
docker run --rm myimage ls /usr/share/nginx/html/assets/

# 检查 React 是否正确打包
docker run --rm myimage grep -o "window.React" /usr/share/nginx/html/assets/*.js
```

---

## 常见问题 FAQ

### Q1: 为什么不使用 React 19 的自动 JSX 转换？

**A:** React 19 的自动转换在现代项目中工作良好，但在以下场景可能遇到问题：
- 使用旧的第三方库
- 动态加载或 CDN 引入的组件
- 需要全局 React 对象的场景（如 React DevTools）

经典模式提供更好的兼容性和可预测性。

### Q2: 浏览器缓存导致的问题如何彻底解决？

**A:** 三管齐下：
1. **文件名哈希**：Vite 自动为文件添加内容哈希（已实现）
2. **HTML 不缓存**：Nginx 配置 `Cache-Control: no-cache`
3. **用户操作**：提供硬刷新指引

### Q3: 为什么 Docker 重新构建后文件名没变？

**A:** 可能原因：
- 源代码未真正改变
- Docker 使用了构建缓存
- Vite 的确定性构建导致相同内容生成相同哈希

**解决方法：**
- 使用 `--no-cache` 标志构建
- 修改源代码（如添加注释）强制重新生成
- 在配置中添加时间戳或版本号

### Q4: 如何在开发环境中避免此问题？

**A:** 开发环境使用 `npm run dev`，Vite 开发服务器会：
- 热模块替换（HMR）
- 自动刷新
- 不使用文件哈希
- 禁用浏览器缓存

生产问题通常只在 Docker 部署时出现。

---

## 相关资源

- [Vite 官方文档 - JSX](https://vitejs.dev/guide/features.html#jsx)
- [React 19 发布说明](https://react.dev/blog/2025/01/15/react-19)
- [React JSX 转换指南](https://react.dev/blog/2020/09/22/introducing-the-new-jsx-transform)
- [Docker 构建缓存最佳实践](https://docs.docker.com/build/cache/)

---

## 问题解决时间线

| 时间 | 操作 | 结果 |
|------|------|------|
| 15:18 | 用户报告 "React is not defined" 错误 | 确认问题存在 |
| 15:19 | 检查 vite.config.ts，尝试 jsxRuntime: 'automatic' | 构建成功，但问题依旧 |
| 15:25 | 重启 Docker 容器 | 文件名相同，浏览器仍使用缓存 |
| 15:28 | 发现容器使用旧镜像 | 验证镜像 ID 不匹配 |
| 15:30 | 改用 jsxRuntime: 'classic' + 全局 React | 构建生成新文件 index-CyWTGrAs.js |
| 15:36 | 完全重启服务并验证 | 新文件部署成功 |
| 15:38 | 用户清除浏览器缓存测试 | **问题解决** ✅ |

**总耗时：** 约 20 分钟

---

## 总结

此问题的核心在于 **React 19 新特性 + Vite 构建配置 + 浏览器缓存** 的三重组合：

1. **技术层面**：使用经典 JSX 模式并显式挂载全局 React
2. **构建层面**：确保 Docker 镜像正确更新和部署
3. **用户层面**：提供清晰的缓存清除指引

**关键教训：**
- 生产环境问题需要从构建、部署、缓存多角度排查
- 文件内容哈希是解决缓存问题的最佳实践
- 经典技术方案在兼容性方面往往更可靠

---

**文档创建日期：** 2025-12-04
**最后更新：** 2025-12-04
**维护者：** Claude Code
**相关提交：** `15e215d - 修复前端 React 未定义错误`
