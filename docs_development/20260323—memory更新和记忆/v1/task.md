# 任务拆分：Memory 更新和记忆管理

## 任务列表

### 1. 提示词更新

- [ ] **1.1** 更新 `storage/config/prompts/system/memory.md`，添加三种记忆类型说明和交接文档模板

### 2. 工具 description 更新

- [ ] **2.1** 修改 `src/tools/task.ts` - description 添加 handover 要求
- [ ] **2.2** 修改 `src/tools/teammate/spawn.ts` - description 添加 handover 要求
- [ ] **2.3** 修改 `src/tools/teammate/send.ts` - description 添加 handover 要求

### 3. 系统触发更新

- [ ] **3.1** 修改 `src/agents/compaction.ts` - 压缩前触发 short_term/long_term 更新
- [ ] **3.2** 修改 `src/memory/persistence.ts` - 添加记忆更新方法

---

## 依赖关系

```
1.1 (提示词)
    ↓
2.1, 2.2, 2.3 (工具 description) ← 并行
    ↓
3.1, 3.2 (系统触发) ← 并行
```

---

## 文件位置

| 任务 | 文件 | 行号范围 |
|-----|------|---------|
| 1.1 | storage/config/prompts/system/memory.md | 新文件 |
| 2.1 | src/tools/task.ts | ~39-44 |
| 2.2 | src/tools/teammate/spawn.ts | ~14 |
| 2.3 | src/tools/teammate/send.ts | ~14 |
| 3.1 | src/agents/compaction.ts | 待确认 |
| 3.2 | src/memory/persistence.ts | 待确认 |

---

## 实施顺序

1. 先确认 memory.md 路径是否存在
2. 更新提示词
3. 更新工具 description
4. 更新压缩逻辑
5. 更新记忆持久化
