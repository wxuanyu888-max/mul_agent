# 实施逻辑 - 存储层清理 (v3)

> 实施过程、文件位置、逻辑、测试

---

## 实施进度

| 任务 | 状态 | 完成日期 |
|-----|------|---------|
| Task 1: storage 测试 | ✅ 完成 | 2026-03-22 |
| Task 2: JsonStorageBackend | ✅ 完成 | 2026-03-22 |
| Task 3: CheckpointManager 重构 | ✅ 完成 | 2026-03-22 |

---

## Task 1: storage 测试

### 1.1 测试文件

| 文件 | 测试数 |
|-----|-------|
| `tests/src/storage/repository.test.ts` | 13 |
| `tests/src/storage/base.test.ts` | 14 |
| `tests/src/storage/backend/json.test.ts` | 11 |

### 1.2 测试结果

```
Test Files  3 passed (3)
Tests  38 passed (38)
```

---

## Task 2: 创建 JsonStorageBackend

### 2.1 文件结构

```
src/storage/
├── index.ts                 # 统一导出
├── repository.ts            # Repository 接口
├── base.ts                  # BaseStorageManager 基类
├── path.ts                  # 统一路径管理
│
└── backend/
    ├── index.ts            # 导出
    └── json.ts             # JSON 文件后端
```

### 2.2 JsonStorageBackend 功能

```typescript
class JsonStorageBackend {
  // 原子读写
  read<T>(filePath: string): Promise<T | null>
  write<T>(filePath: string, data: T): Promise<void>

  // 文件操作
  delete(filePath: string): Promise<void>
  exists(filePath: string): Promise<boolean>
  list(subDir?: string): Promise<string[]>

  // 路径生成
  getFilePath(id: string, subDir?: string): string
}
```

---

## Task 3: CheckpointManager 重构

### 3.1 重构内容

- 使用 `JsonStorageBackend` 统一文件读写
- 保留原有索引管理逻辑
- 保留原有 session 目录隔离结构
- 保持向后兼容

### 3.2 关键代码

```typescript
// 使用统一的 backend
private backend: JsonStorageBackend;

constructor() {
  this.backend = new JsonStorageBackend({ baseDir: STORAGE_DIR });
  ensureDir(STORAGE_DIR).catch(console.error);
}
```

---

## 统一方案总结

### 架构

```
src/storage/                    # 统一存储基础设施
├── backend/json.ts             # JSON 文件后端
├── base.ts                     # 基类（可选使用）
└── repository.ts               # 接口定义

src/agents/checkpoint/manager.ts # 使用 JsonStorageBackend
src/session/manager.ts           # 保持现有实现（已很完善）
```

### 收益

1. **代码复用**: JsonStorageBackend 提供通用文件操作
2. **统一接口**: 所有 Manager 可以使用相同的后端
3. **可测试**: backend 可独立测试
4. **向后兼容**: 现有代码无需修改

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构 |
| v2 | 2026-03-22 | 确认全部任务 |
| v3 | 2026-03-22 | 完成统一存储和测试 |
