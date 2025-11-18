# Memory Network - 技术决策记录

本目录记录 xxljob-enhance 项目的所有重要技术决策和设计文档。

## 📚 决策索引

### mem-001: 技术栈选型
**文件**: `技术栈选型-NodeJS-React-SQLite.md`
**日期**: 2025-01-18
**决策**: 采用 Node.js (NestJS) + React + SQLite 技术栈

**核心内容**:
- ✅ 后端框架：NestJS + TypeScript
- ✅ 前端框架：React + Ant Design
- ✅ 数据库：SQLite + Prisma ORM
- ✅ 认证方案：JWT + Passport
- ✅ 部署方式：Docker 单容器

**适用场景**: 100-200 人规模，快速部署，轻量级架构

---

### mem-002: 权限模型设计
**文件**: `权限模型设计-RBAC-基于角色的访问控制.md`
**日期**: 2025-01-18
**决策**: 采用 RBAC（基于角色的访问控制）模型

**核心内容**:
- ✅ 权限结构：User ↔ Role ↔ JobPermission
- ✅ 权限类型：canView, canExecute, canEdit
- ✅ 权限计算：所有角色权限的并集（OR 逻辑）
- ✅ 完整数据库 Schema（Prisma）
- ✅ 权限查询 API 设计
- ✅ 升级路径：可迁移到混合模型（RBAC + 直接权限）

**优势**: 批量管理高效，数据量小（~200 条 vs 5000 条），易维护

---

## 🔄 决策关系图

```
mem-001 (技术栈选型)
   ↓
mem-002 (权限模型设计)
   ↓
[下一步] specs-workflow Phase 1: Requirements
```

---

## 📋 待办事项

- [ ] 初始化 specs-workflow（使用 MCP 工具）
- [ ] 编写需求文档（requirements.md）
- [ ] 编写设计文档（design.md）
- [ ] 创建架构图（architecture.canvas）
- [ ] 初始化项目脚手架

---

## 📖 如何使用这些文档

### 查看技术选型
```bash
cat memory/技术栈选型-NodeJS-React-SQLite.md
```

### 查看权限模型设计
```bash
cat memory/权限模型设计-RBAC-基于角色的访问控制.md
```

### 搜索特定主题
```bash
grep -r "Prisma" memory/
grep -r "JWT" memory/
```

---

## 🔗 相关文档

- `docs/specs/` - 需求、设计、任务文档（待创建）
- `docs/guides/` - 开发指南
- `CLAUDE.md` - 项目开发规范

---

## 🤝 贡献新的决策记录

当做出新的重要技术决策时，请创建新的 Memory 文件：

**文件命名规范**: `主题-简短描述.md`
**ID 规范**: `mem-XXX`（递增编号）

**必需字段**:
```yaml
---
id: mem-XXX
type: decision | implementation | learning | concept | issue
title: 简短标题
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
---
```

**章节结构**:
1. Summary（一句话总结）
2. Context（背景和关联）
3. Decision（具体决策内容）
4. Alternatives Considered（考虑过的替代方案）
5. Implementation Details（实现细节）
6. Related Files（相关文件）
7. References（参考资料）
