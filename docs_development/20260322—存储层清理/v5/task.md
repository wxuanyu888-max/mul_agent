# 任务拆分 - 存储层清理 (v5)

> SessionManager 重构

---

## 任务概览

| 阶段 | 任务数 | 优先级 |
|-----|-------|-------|
| 必做 | 4 | P0 |

---

## 必做任务

### Task 1: 创建 StorageCache 通用缓存类 ✅

**文件**: `src/storage/cache/cache.ts`

**目标**: 提取 SessionCache 的通用逻辑

| 子任务 | 描述 | 状态 |
|-------|------|------|
| 1.1 | 分析 SessionCache 的通用模式 | ✅ |
| 1.2 | 创建 `StorageCache<T>` 泛型类 | ✅ |
| 1.3 | 实现核心方法: get, set, delete, flush, evict | ✅ |
| 1.4 | 实现定时刷新机制 | ✅ |
| 1.5 | 添加单元测试 | ✅ |

**StorageCache 接口**:
```typescript
class StorageCache<T> {
  constructor(options: { maxSize?: number; flushInterval?: number })

  get(id: string): Promise<T | null>
  set(id: string, data: T, dirty?: boolean): void
  delete(id: string): void
  markDirty(id: string): void
  flush(): Promise<void>
  start(): void
  stop(): Promise<void>

  size(): number
  pendingCount(): number
  has(id: string): boolean
}
```

**依赖**: 无
**优先级**: P0

---

### Task 2: 使用 JsonStorageBackend 重构 SessionManager ✅

**文件**: `src/session/manager.ts`

| 子任务 | 描述 | 状态 |
|-------|------|------|
| 2.1 | 引入 JsonStorageBackend | ✅ |
| 2.2 | 替换直接文件操作为 backend 调用 | ✅ |
| 2.3 | 保持索引管理逻辑不变 | ✅ |
| 2.4 | 保持所有导出函数签名不变 | ✅ |
| 2.5 | 运行测试验证功能 | ✅ |

**依赖**: Task 1
**优先级**: P0

---

### Task 3: 验证测试覆盖率 ✅

**文件**: `tests/src/session/`

| 子任务 | 描述 | 状态 |
|-------|------|------|
| 3.1 | 运行现有测试确保不破坏功能 | ✅ |
| 3.2 | 检查覆盖率 | ✅ |
| 3.3 | 补充缺失测试 | ✅ |

**覆盖率目标**: 80%+

**依赖**: Task 2
**优先级**: P0

---

### Task 4: 运行完整测试验证 ✅

| 子任务 | 描述 | 状态 |
|-------|------|------|
| 4.1 | `pnpm typecheck` | ✅ |
| 4.2 | `pnpm test:run` | ✅ (核心测试通过) |
| 4.3 | 手动测试核心功能 | ✅ |

**依赖**: Task 3
**优先级**: P0

---

## 任务依赖图

```
Task 1 (StorageCache)
    │
    ▼
Task 2 (SessionManager 重构)
    │
    ▼
Task 3 (测试覆盖率)
    │
    ▼
Task 4 (完整验证)
```

---

## 文件变更清单

| 操作 | 文件路径 |
|-----|---------|
| **新建** | `src/storage/cache/cache.ts` - StorageCache 通用类 |
| **新建** | `src/storage/cache/types.ts` - 类型定义 |
| **新建** | `src/storage/cache/index.ts` - 导出 |
| **修改** | `src/session/manager.ts` - 使用 StorageCache + JsonStorageBackend |
| **修改** | `src/storage/index.ts` - 添加 cache 导出 |

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| `src/storage/cache/cache.ts` | 90%+ |
| `src/session/manager.ts` | 80%+ |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构 |
| v2 | 2026-03-22 | 确认全部任务 |
| v3 | 2026-03-22 | 完成统一存储和测试 |
| v4 | 2026-03-22 | 日志轮转 |
| v5 | 2026-03-22 | SessionManager 重构 |
