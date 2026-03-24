# 实施逻辑：禁用 Sessions 工具

## 实现步骤

### 1. 禁用 createSessionsTool() ✅

**文件：** `src/tools/index.ts`

```typescript
// Sessions (统一入口：list, history, send, spawn, status)
// createSessionsTool(), // 已禁用，不暴露给 Agent
```

### 2. 移除 TOOL_DESCRIPTIONS 中的 sessions 条目 ✅

```typescript
// 会话工具（统一入口）- 已禁用
// sessions: "...", // 已禁用，不暴露给 Agent
```

### 3. 测试验证 ✅

- Lint 检查通过

## 关键文件修改

| 文件 | 修改内容 |
|------|----------|
| `src/tools/index.ts` | 禁用 `createSessionsTool()`，移除 sessions 描述 |

## 验证结果

- ✅ Lint 检查通过
- ✅ sessions 工具不再暴露给 Agent
