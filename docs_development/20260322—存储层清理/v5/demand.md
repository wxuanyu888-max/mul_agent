# 需求文档 - 存储层清理 (v5)

> SessionManager 重构

---

## 需求背景

### v3/v4 完成情况

| 版本 | 状态 |
|-----|------|
| v3 | ✅ 完成 JsonStorageBackend + 测试 |
| v4 | ⏳ 日志轮转（未开始） |
| v5 | ⏳ SessionManager 重构（本版本） |

### 当前 SessionManager 结构

```
src/session/manager.ts (525 行)
├── SessionCache 类 (188 行)
│   ├── cache: Map<string, CacheEntry>
│   ├── indexCache: Record<string, SessionMetadata>
│   ├── flushTimer
│   ├── pendingFlush: Set<string>
│   └── 方法: get, set, evict, markDirty, delete, flush, startTimer, stop...
│
├── generateSessionId()
├── ensureStorageDir()
├── getSessionPath()
├── getIndexPath()
│
└── 导出函数
    ├── createSession()
    ├── getSession()
    ├── updateSession()
    ├── addMessage()
    ├── addToolCall()
    ├── updateUsage()
    ├── querySessions()
    ├── getActiveSessions()
    ├── deleteSession()
    ├── updateSessionStatus()
    ├── flushSessions()
    ├── getCacheStats()
    └── closeSessionManager()
```

### 重构目标

将 SessionManager 中的缓存逻辑提取到 storage 模块，实现代码复用。

---

## 详细描述

### 统一方案架构

```
src/storage/
├── cache/                   # 新增：通用缓存模块
│   ├── cache.ts            # StorageCache 通用类
│   ├── types.ts
│   └── index.ts
│
├── backend/
│   ├── json.ts             # ✅ 已存在
│   └── index.ts            # ✅ 已存在
│
├── base.ts                 # ✅ 已存在（基类）
└── index.ts                # ✅ 已存在
```

### SessionManager 重构后

```typescript
// src/session/manager.ts 重构后
import { JsonStorageBackend } from '../storage/backend/json.js';
import { StorageCache } from '../storage/cache/cache.js';

class SessionManager {
  private cache: StorageCache<Session>;
  private indexCache: StorageCache<SessionMetadata>;
  private backend: JsonStorageBackend;

  constructor() {
    this.backend = new JsonStorageBackend({ baseDir: STORAGE_DIR });
    this.cache = new StorageCache<Session>({ maxSize: 100, flushInterval: 5000 });
    this.indexCache = new StorageCache<SessionMetadata>({ maxSize: 100, flushInterval: 5000 });
  }
  // ... 业务逻辑
}
```

### 收益

| 方面 | 重构前 | 重构后 |
|-----|-------|-------|
| 缓存逻辑 | SessionCache 自己实现 | 复用 StorageCache |
| 文件操作 | 直接调用 atomicWriteJson | 复用 JsonStorageBackend |
| 代码行数 | ~525 行 | ~400 行 |
| 可复用性 | 无 | TaskManager 可复用 |

---

## 确认的需求

| 问题 | 确认结果 |
|------|---------|
| 重构范围 | SessionManager |
| 使用 storage 模块 | JsonStorageBackend + StorageCache |
| 保持 API | 完全兼容，不改变导出函数 |
| 测试 | 80%+ 覆盖率 |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构 |
| v2 | 2026-03-22 | 确认全部任务 |
| v3 | 2026-03-22 | 完成统一存储和测试 |
| v4 | 2026-03-22 | 日志轮转 |
| v5 | 2026-03-22 | SessionManager 重构 |
