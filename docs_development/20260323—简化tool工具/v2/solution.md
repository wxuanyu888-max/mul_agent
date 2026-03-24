# 实施逻辑：简化 Teammate 工具

## 实现步骤

### 1. 修改工具注册 ✅

**文件：** `src/tools/index.ts`

- 导出部分注释掉不需要的工具（inbox、broadcast、list、delegate、delegation_status、ask）
- 导入部分同样注释掉
- `createDefaultTools()` 中只保留 `createTeammateSpawnTool()` 和 `createTeammateSendTool()`

### 2. 更新工具描述 ✅

**文件：** `src/tools/teammate/spawn.ts`

```typescript
description: 'Create a new teammate agent. Give them a name and role, and they will start working independently.'
```

**文件：** `src/tools/teammate/send.ts`

```typescript
description: 'Send a message to a teammate. They will receive it and respond accordingly.'
```

### 3. 在 Prompt Builder 自动加载队友列表 ✅

**文件：** `src/agents/prompt/builder.ts`

- 添加 `TEAMMATES_DIR` 常量
- 添加 `loadActiveTeammates()` 函数，从 `storage/teammates/config.json` 读取队友列表
- 在 `buildDynamicVariables()` 中调用并返回 `teammates_info`
- 在 `full` 模板中添加 `{{teammates_info}}` 占位符

**效果：** Agent 启动时自动看到队友列表，无需调用 `teammate_list` 工具

### 4. 测试验证 ✅

- Lint 检查通过：`pnpm exec oxlint src/tools/index.ts src/agents/prompt/builder.ts src/tools/teammate/spawn.ts src/tools/teammate/send.ts`
- 类型检查：有预存错误（minimax-tts.ts），与本次改动无关

## 关键文件修改

| 文件 | 修改内容 |
|------|----------|
| `src/tools/index.ts` | 只保留 spawn 和 send，禁用其他 6 个 teammate 工具 |
| `src/tools/teammate/spawn.ts` | 更新描述 |
| `src/tools/teammate/send.ts` | 更新描述 |
| `src/agents/prompt/builder.ts` | 添加 `loadActiveTeammates()` 函数，自动加载队友列表到提示词 |

## 验证结果

- ✅ Lint 检查通过（改动文件）
- ✅ 工具注册正确，只暴露 2 个核心工具
- ✅ 队友列表自动加载到提示词
