# 任务拆分 - 存储层清理 (v2)

> 基于确认的 demand.md 拆分具体任务

---

## 任务概览

| 阶段 | 任务数 | 优先级 |
|-----|-------|-------|
| 必做 | 5 | P0/P1 |
| 可选 | 1 | P2 |

---

## 必做任务

### Task 1: 修复项目 TS 编译错误

**问题**: 项目有多个 TS 错误导致编译失败

| 文件 | 错误类型 | 解决方案 |
|-----|---------|---------|
| `src/agents/planner.ts` | 模块找不到 `../tools/extended/tasks/manager.js` | 检查并修复 import |
| `src/agents/supervisor/tool.ts` | 模块找不到 `../../tools/core/types.js` | 检查并修复 import |
| `src/auth/agent.ts` | 类型导出缺失 `ToolPermission` | 添加类型导出或修复 import |

**子任务**:
1. 读取每个错误文件，分析错误原因
2. 修复或删除死代码
3. 运行 `pnpm typecheck` 验证
4. 运行 `pnpm build` 确认编译通过

**依赖**: 无
**优先级**: P0

---

### Task 2: 添加 storage 模块单元测试

**文件**: `src/storage/`

**目标覆盖率**: 80%+

| 子任务 | 描述 |
|-------|------|
| 2.1 | 创建 `tests/src/storage/` 目录 |
| 2.2 | 为 `repository.ts` 编写测试 |
| 2.3 | 为 `base.ts` 编写测试 |
| 2.4 | 运行测试验证覆盖率 |

**测试内容**:
- `Repository` 接口方法测试
- `StorageError` 错误类测试
- `BaseStorageManager` 缓存/刷新逻辑测试

**依赖**: Task 1
**优先级**: P1
**覆盖率目标**: 80%+

---

### Task 3: 让 CheckpointManager 使用 BaseStorageManager

**文件**: `src/agents/checkpoint/manager.ts`

**目标**: 减少代码重复，统一存储逻辑

**子任务**:
3.1 读取 CheckpointManager 和 BaseStorageManager 实现
3.2 重构 CheckpointManager 继承 BaseStorageManager
3.3 确保功能不变
3.4 运行测试验证

**依赖**: Task 2
**优先级**: P1

---

### Task 4: 让 SessionManager 使用 BaseStorageManager

**文件**: `src/session/manager.ts`

**子任务**:
4.1 读取 SessionManager 和 BaseStorageManager 实现
4.2 重构 SessionManager 继承 BaseStorageManager
4.3 确保功能不变（缓存、刷新、索引）
4.4 运行测试验证

**依赖**: Task 3
**优先级**: P1

---

### Task 5: 实现日志轮转

**文件**: `src/logger/manager.ts`

**目标**: 实现配置的日志轮转功能

**轮转策略**:
1. **按日期**: 每天一个日志文件 `YYYY-MM-DD.log`
2. **按大小**: 单文件超过 10MB 时创建新文件
3. **保留数量**: 最多保留 10 个文件

**子任务**:
5.1 实现 `rotateLogFile()` 方法
5.2 在 `write()` 方法中检查是否需要轮转
5.3 实现 `cleanOldLogs()` 清理旧文件
5.4 添加单元测试

**依赖**: Task 1
**优先级**: P2

---

## 可选任务

### Task 6: 让 TaskManager 使用统一存储模式 (P2)

**说明**: TaskManager 结构与 SessionManager/CheckpointManager 不同，强行统一风险较高。如果 Task 3/4 顺利完成，再考虑。

**依赖**: Task 4 完成后可选
**优先级**: P2

---

## 任务依赖图

```
Task 1 (TS错误)
    │
    ├──────────────────────────────────┐
    │                                  │
Task 2 (storage测试)              Task 5 (日志轮转)
    │                                  │
Task 3 (Checkpoint基类)               │
    │                                  │
Task 4 (Session基类)                   │
    │                                  │
Task 6 (TaskManager) ←─ 可选 ─────────┘
```

---

## 文件变更清单

| 操作 | 文件路径 |
|-----|---------|
| **修改** | `src/agents/planner.ts` - 修复 TS 错误 |
| **修改** | `src/agents/supervisor/tool.ts` - 修复 TS 错误 |
| **修改** | `src/auth/agent.ts` - 修复 TS 错误 |
| **修改** | `src/agents/checkpoint/manager.ts` - 使用基类 |
| **修改** | `src/session/manager.ts` - 使用基类 |
| **修改** | `src/logger/manager.ts` - 实现日志轮转 |
| **新建** | `tests/src/storage/repository.test.ts` |
| **新建** | `tests/src/storage/base.test.ts` |

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| `src/storage/repository.ts` | 90%+ |
| `src/storage/base.ts` | 85%+ |
| `src/logger/manager.ts` | 80%+ |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成大部分，遗留部分 |
| v2 | 2026-03-22 | 全部选项：TS修复 + 测试 + 基类 + 日志轮转 |
