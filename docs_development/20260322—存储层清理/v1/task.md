# 任务拆分 - 存储层清理

> 基于确认的 demand.md 拆分具体任务

---

## 任务概览

| 阶段 | 任务数 | 优先级 |
|-----|-------|-------|
| P0 - 紧急修复 | 3 | P0 |
| P1 - 架构优化 | 4 | P1 |
| P2 - 长期改进 | 2 | P2 |

---

## 阶段一：P0 紧急修复

### Task 1.1: 修复 API 路由内存存储问题
**文件**: `src/api/routes/memory.ts`
**问题**: 使用内存 Map，重启后数据丢失
**解决方案**: 改为使用 `MemoryPersistence` 持久化

| 子任务 | 描述 |
|-------|------|
| 1.1.1 | 读取当前 `src/api/routes/memory.ts` 实现 |
| 1.1.2 | 读取 `src/memory/persistence.ts` 现有实现 |
| 1.1.3 | 将 `memoryStore` Map 替换为使用 `MemoryPersistence` |
| 1.1.4 | 添加单元测试验证持久化 |
| 1.1.5 | 手动测试验证重启后数据不丢失 |

**依赖**: 无
**优先级**: P0

---

### Task 1.2: 创建 Repository 接口
**文件**: `src/storage/repository.ts` (新文件)
**问题**: 缺少统一抽象层
**解决方案**: 定义标准 Repository 接口

| 子任务 | 描述 |
|-------|------|
| 1.2.1 | 创建 `src/storage/` 目录 |
| 1.2.2 | 定义 `Repository<T>` 接口（findById, findAll, save, delete） |
| 1.2.3 | 定义 `StorageError` 错误类 |
| 1.2.4 | 定义 `StorageOptions` 配置接口 |
| 1.2.5 | 编写接口单元测试 |

**依赖**: 无
**优先级**: P0

---

### Task 1.3: 抽取 BaseStorageManager 基类
**文件**: `src/storage/base.ts` (新文件)
**问题**: SessionManager, CheckpointManager, TaskManager 代码重复
**解决方案**: 抽取公共逻辑到基类

| 子任务 | 描述 |
|-------|------|
| 1.3.1 | 分析现有 Manager 的公共模式 |
| 1.3.2 | 创建 `BaseStorageManager<T>` 抽象类 |
| 1.3.3 | 实现公共方法: ensureDir, load, save, flush, cache |
| 1.3.4 | 让 `SessionManager` 继承基类 |
| 1.3.5 | 让 `CheckpointManager` 继承基类 |
| 1.3.6 | 让 `TaskManager` 继承基类 |
| 1.3.7 | 编写单元测试 |

**依赖**: Task 1.2
**优先级**: P0

---

## 阶段二：P1 架构优化

### Task 2.1: 修复 file-lock.ts 原子性问题
**文件**: `src/utils/file-lock.ts`
**问题**: `atomicWriteJson` 无原子性保证
**解决方案**: 实现真正的原子写入

| 子任务 | 描述 |
|-------|------|
| 2.1.1 | 读取当前 `file-lock.ts` 实现 |
| 2.1.2 | 实现真正的原子写入（使用临时文件 + rename） |
| 2.1.3 | 改进锁获取失败处理 |
| 2.1.4 | 添加单元测试 |
| 2.1.5 | 验证并发写入不会损坏数据 |

**依赖**: 无
**优先级**: P1

---

### Task 2.2: 统一路径管理
**文件**: `src/storage/path.ts` (新文件)
**问题**: 路径依赖 `process.cwd()`，运行时目录切换导致错误
**解决方案**: 统一路径管理，使用绝对路径

| 子任务 | 描述 |
|-------|------|
| 2.2.1 | 创建 `StoragePath` 工具类 |
| 2.2.2 | 所有 Manager 改用 `StoragePath` 获取路径 |
| 2.2.3 | 添加测试验证路径正确性 |

**依赖**: Task 1.2
**优先级**: P1

---

### Task 2.3: 重构 MemoryPersistence
**文件**: `src/memory/persistence.ts`
**问题**: 使用文件锁但效率低
**解决方案**: 使用 Repository 接口重构

| 子任务 | 描述 |
|-------|------|
| 2.3.1 | 读取当前 `persistence.ts` 实现 |
| 2.3.2 | 重构为实现 `Repository` 接口 |
| 2.3.3 | 改进缓存策略 |
| 2.3.4 | 添加单元测试 |

**依赖**: Task 1.2, Task 1.3
**优先级**: P1

---

### Task 2.4: 统一 Session/Checkpoint/Task Manager
**文件**: `src/session/manager.ts`, `src/agents/checkpoint/manager.ts`, `src/tools/tasks/manager.ts`
**问题**: 各 Manager 独自实现相似逻辑
**解决方案**: 基于 BaseStorageManager 重构

| 子任务 | 描述 |
|-------|------|
| 2.4.1 | 重构 `SessionManager` 使用基类 |
| 2.4.2 | 重构 `CheckpointManager` 使用基类 |
| 2.4.3 | 重构 `TaskManager` 使用基类 |
| 2.4.4 | 确保所有单元测试通过 |

**依赖**: Task 1.3
**优先级**: P1

---

## 阶段三：P2 长期改进

### Task 3.1: 引入 StorageBackend 抽象
**文件**: `src/storage/backend.ts` (新文件)
**问题**: 存储后端不可切换
**解决方案**: 定义 StorageBackend 接口

| 子任务 | 描述 |
|-------|------|
| 3.1.1 | 定义 `StorageBackend` 接口 |
| 3.1.2 | 实现 `JsonFileBackend`（现有 JSON 文件存储） |
| 3.1.3 | 实现 `SqliteBackend`（向量存储） |
| 3.1.4 | 实现 `MemoryBackend`（临时缓存） |
| 3.1.5 | Repository 支持切换 Backend |

**依赖**: Task 1.2, Task 2.4
**优先级**: P2

---

### Task 3.2: 完善日志系统
**文件**: `src/logger/manager.ts`
**问题**: 日志缺乏结构化
**解决方案**: 改进日志格式和存储

| 子任务 | 描述 |
|-------|------|
| 3.2.1 | 读取当前 `logger/manager.ts` 实现 |
| 3.2.2 | 引入结构化日志格式（JSON） |
| 3.2.3 | 添加日志轮转（log rotation） |
| 3.2.4 | 添加单元测试 |

**依赖**: Task 2.4
**优先级**: P2

---

## 任务依赖图

```
Task 1.1 (API内存存储) ──────────────────────┐
                                             │
Task 1.2 (Repository接口) ─┬─────────────────┤
                            │                 │
Task 2.2 (统一路径管理) ◄───┘                 │
                            │                 │
Task 1.3 (BaseStorage基类) ◄──┴───────┬───────┘
                            │         │
         ┌───────────────────┼─────────┼─────────┐
         │                   │         │         │
    Task 2.3            Task 2.4  Task 2.1   Task 3.1
   (Memory重构)    (统一Manager)  (文件锁)   (Backend)
                            │         │
                            └────┬────┘
                                 │
                            Task 3.2
                           (日志系统)
```

---

## 文件变更清单

| 操作 | 文件路径 |
|-----|---------|
| **新建** | `src/storage/repository.ts` |
| **新建** | `src/storage/base.ts` |
| **新建** | `src/storage/path.ts` |
| **新建** | `src/storage/backend.ts` |
| **修改** | `src/api/routes/memory.ts` |
| **修改** | `src/memory/persistence.ts` |
| **修改** | `src/session/manager.ts` |
| **修改** | `src/agents/checkpoint/manager.ts` |
| **修改** | `src/tools/tasks/manager.ts` |
| **修改** | `src/utils/file-lock.ts` |
| **修改** | `src/logger/manager.ts` |

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| `src/storage/` | 90%+ |
| `src/memory/persistence.ts` | 85%+ |
| `src/session/manager.ts` | 85%+ |
| `src/utils/file-lock.ts` | 85%+ |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 初始任务拆分 |
