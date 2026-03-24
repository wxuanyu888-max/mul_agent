# 实施逻辑：简化 Task 工具

## 实现步骤

### 1. 分析现有 task 工具的提示词描述位置 ✅

**发现：**
- `createTaskTool()` (第190行) - 当前激活的是 subagent
- `createTaskCreateTool()` 等 (第272-275行) - 已被注释掉

**需要修改的文件：**
- `src/tools/index.ts` - 工具注册
- `src/tools/tasks/index.ts` - 工具描述
- `src/agents/prompt/builder.ts` - 提示词构建

### 2. 修改工具注册 ✅

**文件：** `src/tools/index.ts`

- 注释掉 `createTaskTool()` (第190行)
- 取消注释 `createTaskCreateTool()` (第272行)
- 添加注释说明其他工具已禁用

### 3. 更新 task_create 工具描述 ✅

**文件：** `src/tools/tasks/index.ts`

```typescript
description: 'Create a new task. After created, use write tool to update progress and write summaries.',
```

### 4. 在 Prompt Builder 实现任务自动加载 ✅

**文件：** `src/agents/prompt/builder.ts`

- 导入 `getTasksPath`, `readdirSync`
- 添加 `loadActiveTasks()` 函数
- 在模板中添加 `{{tasks_info}}` 占位符
- 在 `buildDynamicVariables` 中返回 `tasksInfo`

### 5. 测试验证 ✅

- 类型检查通过：`pnpm typecheck`
- Lint 检查通过：`pnpm lint`

## 关键文件修改

| 文件 | 修改内容 |
|------|----------|
| `src/tools/index.ts` | 注释掉 task 工具，启用 task_create |
| `src/tools/tasks/index.ts` | 更新 task_create 描述 |
| `src/agents/prompt/builder.ts` | 添加任务自动加载逻辑 |

## 验证结果

- ✅ 类型检查通过
- ✅ Lint 检查通过
