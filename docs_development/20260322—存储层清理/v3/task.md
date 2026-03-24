# 任务拆分 - 存储层清理 (v3)

> 基于确认的 demand.md 拆分具体任务

---

## 任务概览

| 阶段 | 任务数 | 优先级 |
|-----|-------|-------|
| 必做 | 3 | P0/P1 |

---

## 必做任务

### Task 1: 完成 storage 测试覆盖率 80%+

**文件**: `tests/src/storage/`

**当前状态**: 已有测试文件，需要检查覆盖率

| 子任务 | 描述 |
|-------|------|
| 1.1 | 运行测试并检查覆盖率 |
| 1.2 | 为 `repository.ts` 补充测试（如果有缺失） |
| 1.3 | 为 `base.ts` 补充测试（如果有缺失） |
| 1.4 | 验证覆盖率 >= 80% |

**依赖**: 无
**优先级**: P0

---

### Task 2: 实现日志轮转

**文件**: `src/logger/manager.ts`

**当前状态**: 配置存在但未实现
```typescript
maxFileSize: 10 * 1024 * 1024, // 10MB - 未使用
maxFiles: 10,                    // 未使用
```

**轮转策略**:
1. **按大小**: 单文件超过 10MB 时创建新文件
2. **保留数量**: 最多保留 10 个文件

| 子任务 | 描述 |
|-------|------|
| 2.1 | 实现 `rotateLogFile()` 方法 |
| 2.2 | 在 `write()` 方法中检查是否需要轮转 |
| 2.3 | 实现 `cleanOldLogs()` 清理旧文件 |
| 2.4 | 添加单元测试 |

**依赖**: Task 1
**优先级**: P1

---

### Task 3: 让 Manager 使用 BaseStorageManager

**文件**:
- `src/session/manager.ts`
- `src/agents/checkpoint/manager.ts`

**目标**: 减少代码重复，统一存储逻辑

| 子任务 | 描述 |
|-------|------|
| 3.1 | 读取 CheckpointManager 和 BaseStorageManager 实现 |
| 3.2 | 重构 CheckpointManager 继承 BaseStorageManager |
| 3.3 | 读取 SessionManager 和 BaseStorageManager 实现 |
| 3.4 | 重构 SessionManager 继承 BaseStorageManager |
| 3.5 | 运行测试验证功能不变 |

**依赖**: Task 1
**优先级**: P1

---

## 任务依赖图

```
Task 1 (storage测试)
    │
    ├──────────────────────┐
    │                      │
Task 2 (日志轮转)      Task 3 (基类继承)
    │                      │
    └──────────────────────┘
```

---

## 文件变更清单

| 操作 | 文件路径 |
|-----|---------|
| **修改** | `src/logger/manager.ts` - 实现日志轮转 |
| **修改** | `src/agents/checkpoint/manager.ts` - 使用基类 |
| **修改** | `src/session/manager.ts` - 使用基类 |
| **新建/修改** | `tests/src/storage/` - 补充测试 |

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| `src/storage/repository.ts` | 80%+ |
| `src/storage/base.ts` | 80%+ |
| `src/logger/manager.ts` | 80%+ |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构 |
| v2 | 2026-03-22 | 确认全部任务 |
| v3 | 2026-03-22 | storage测试 + 日志轮转 + 基类继承 |
