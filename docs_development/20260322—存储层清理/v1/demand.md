# 需求文档 - 存储层清理

> ✅ 用户已确认

---

## 需求背景

当前项目存储层存在以下问题：

### 1. 存储方案混乱
项目使用了 5+ 种不同的存储方案，缺乏统一抽象：
- **SQLite + sqlite-vec**：向量记忆搜索（`src/memory/database.ts`）
- **JSON 文件**：Session、Checkpoint、Task、Cron 等（各 Manager 自己实现）
- **内存 Map**：API 路由临时存储（`src/api/routes/memory.ts`）⚠️ **重启后数据丢失**
- **日志文件**：应用日志（`src/logger/`）
- **文件锁**：并发控制（`src/utils/file-lock.ts`）

### 2. 严重问题
| 优先级 | 问题 | 位置 |
|-------|------|------|
| **P0** | API 路由使用内存存储，重启后数据丢失 | `src/api/routes/memory.ts` |
| **P0** | 缺少 Repository 抽象层 | 整个存储层 |
| **P0** | 代码重复严重（SessionManager、CheckpointManager、TaskManager 模式相同） | 多个 Manager |
| **P1** | `atomicWriteJson` 无原子性保证 | `src/utils/file-lock.ts` |
| **P1** | 路径依赖 `process.cwd()` | 多个 Manager |
| **P2** | 存储后端不可切换 | 整体架构 |

### 3. 代码重复模式
每个 Manager 都自己实现了类似的模式：
- `ensureDir()`
- `loadXxx()` / `saveXxx()`
- 缓存 + 脏标记
- 定期刷新

---

## 详细描述

### 目标
1. **统一存储架构**：建立 Repository Pattern 和 Storage Backend 抽象层
2. **修复 P0 问题**：解决内存存储、代码重复、缺少抽象层的问题
3. **改善可维护性**：统一错误处理、减少重复代码、提高可测试性

### 范围（待确认）
| 模块 | 当前方案 | 目标方案 |
|-----|---------|---------|
| `src/memory/` | SQLite + JSON 文件 | 统一 Repository |
| `src/session/` | JSON 文件 + 缓存 | 统一 Repository |
| `src/agents/checkpoint/` | JSON 文件 + 缓存 | 统一 Repository |
| `src/tools/tasks/` | JSON 文件 | 统一 Repository |
| `src/api/routes/memory.ts` | 内存 Map | 持久化到 MemoryPersistence |
| `src/utils/file-lock.ts` | 文件锁 | 可选的分布式锁抽象 |

### 约束条件（✅ 已确认）
- [x] 必须保持向后兼容（现有 API 不能变）
- [x] 不能破坏现有数据
- [x] 逐步迁移而非一次性重写
- [x] 单元测试覆盖率 80%+
- [x] **不需要**支持 PostgreSQL 切换（当前项目未使用，无需添加）

---

## 期望结果

### 架构目标
```
┌─────────────────────────────────────┐
│           Repository 接口层          │
│  SessionRepo / MemoryRepo / TaskRepo │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│           Storage Backend           │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ SQLite  │ │ JSON    │ │Memory  │ │
│  │(向量)   │ │(文件)   │ │(临时)  │ │
│  └─────────┘ └─────────┘ └────────┘ │
└─────────────────────────────────────┘
```

### 具体产出
1. **Repository 接口**：定义标准 CRUD 操作
2. **BaseStorageManager 基类**：抽取公共逻辑
3. **StorageError 统一错误**：一致的异常处理
4. **修复内存存储**：API 路由数据持久化
5. **可选：StorageBackend 抽象**：支持切换存储后端

---

## ✅ 确认的需求

用户确认后确认的内容：

| 问题 | 确认结果 |
|------|---------|
| 范围 | ✅ 全部修复（P0 + P1 + P2） |
| 优先级 | ✅ 所有部分都修复 |
| JSON 格式兼容 | ✅ 是，保持向后兼容 |
| PostgreSQL 切换 | ✅ 不需要（当前项目未使用） |
| 包含 logger 和 file-lock | ✅ 是，包含在清理范围 |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 用户确认全部范围，开始任务拆分 |
