# 实施逻辑 - 存储层清理

> 实施过程、文件位置、逻辑、测试

---

## 实施进度

| 任务 | 状态 | 完成日期 |
|-----|------|---------|
| Task 1.1: 修复 API 内存存储 | ✅ 完成 | 2026-03-22 |
| Task 1.2: 创建 Repository 接口 | ✅ 完成 | 2026-03-22 |
| Task 1.3: 抽取 BaseStorageManager 基类 | ✅ 完成 | 2026-03-22 |
| Task 2.1: 修复 file-lock 原子性 | ✅ 完成 | 2026-03-22 |
| Task 2.2: 统一路径管理 | ✅ 完成 | 2026-03-22 |
| Task 2.3: 重构 MemoryPersistence | ✅ 完成 | 2026-03-22 |
| Task 2.4: 统一 Session/Checkpoint/Task | ✅ 完成 | 2026-03-22 |
| Task 3.1: StorageBackend 抽象 | ⏳ 待开始 | - |
| Task 3.2: 完善日志系统 | ⏳ 待开始 | - |

---

## Task 1.1: 修复 API 路由内存存储

### 1.1.1 读取当前实现

**文件**: `src/api/routes/memory.ts`

```typescript
// 当前问题代码
const memoryStore: Map<string, MemoryEntry[]> = new Map();
```

### 1.1.2 读取 MemoryPersistence 实现

**文件**: `src/memory/persistence.ts`

### 1.1.3 替换为持久化存储

**修改**: `src/api/routes/memory.ts`

```typescript
// Before
const memoryStore: Map<string, MemoryEntry[]> = new Map();

// After
import { MemoryPersistence } from '../../memory/persistence.js';
const memoryStore = new MemoryPersistence();
```

### 1.1.4 关键逻辑

- 使用 `MemoryPersistence` 替代内存 Map
- 确保数据持久化到文件系统
- 保留原有的 API 接口不变（向后兼容）

### 1.1.5 测试验证

```bash
# 1. 启动服务，添加数据
# 2. 重启服务
# 3. 验证数据仍然存在
```

---

## Task 1.2: 创建 Repository 接口

### 1.2.1 创建目录

```bash
mkdir -p src/storage
```

### 1.2.2 定义接口

**文件**: `src/storage/repository.ts`

```typescript
// Repository 接口
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// StorageError 错误类
export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// StorageOptions 配置
export interface StorageOptions {
  basePath: string;
  ttl?: number;
  flushInterval?: number;
}
```

### 1.2.3 编写测试

**文件**: `tests/src/storage/repository.test.ts`

---

## Task 1.3: 抽取 BaseStorageManager 基类

### 1.3.1 分析公共模式

现有 Manager 的公共逻辑：
- `ensureDir(path)` - 确保目录存在
- `load(id)` - 从磁盘加载
- `save(entity)` - 保存到磁盘
- `flush()` - 定期刷新缓存
- 缓存 + 脏标记

### 1.3.2 创建基类

**文件**: `src/storage/base.ts`

```typescript
export abstract class BaseStorageManager<T> {
  protected cache: Map<string, T> = new Map();
  protected dirty: Set<string> = new Set();
  protected flushInterval: number = 5000;

  abstract getStoragePath(): string;
  abstract loadFromDisk(id: string): Promise<T | null>;
  abstract saveToDisk(entity: T): Promise<void>;

  async findById(id: string): Promise<T | null> { ... }
  async findAll(): Promise<T[]> { ... }
  async save(entity: T): Promise<void> { ... }
  async flush(): Promise<void> { ... }
}
```

### 1.3.3 重构现有 Manager

- `SessionManager extends BaseStorageManager`
- `CheckpointManager extends BaseStorageManager`
- `TaskManager extends BaseStorageManager`

---

## 关键文件

| 文件 | 作用 |
|-----|------|
| `src/storage/repository.ts` | Repository 接口定义 |
| `src/storage/base.ts` | BaseStorageManager 基类 |
| `src/storage/path.ts` | 统一路径管理 |
| `src/storage/backend.ts` | StorageBackend 抽象 |
| `src/api/routes/memory.ts` | 修复内存存储问题 |

---

## 测试方案

| 模块 | 测试文件 | 覆盖率目标 |
|-----|---------|----------|
| repository | `tests/src/storage/repository.test.ts` | 90%+ |
| base | `tests/src/storage/base.test.ts` | 90%+ |
| file-lock | `tests/src/utils/file-lock.test.ts` | 85%+ |
| memory persistence | `tests/src/memory/persistence.test.ts` | 85%+ |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 初始实施文档 |
