# 任务拆分：简化 Teammate 工具

## 任务列表

1. [ ] 修改工具注册，只保留 `teammate_spawn` 和 `teammate_send`
2. [ ] 更新 `teammate_spawn` 和 `teammate_send` 工具描述
3. [ ] 在 Prompt Builder 中自动加载队友列表（替换 `teammate_list`）
4. [ ] 测试验证

## 依赖关系

- 任务1 无依赖
- 任务2 依赖任务1
- 任务3 无依赖，可并行
- 任务4 依赖任务1-3

## 文件位置

- 工具注册：`src/tools/index.ts`
- Teammate 工具：`src/tools/teammate/spawn.ts`、`src/tools/teammate/send.ts`
- Prompt Builder：`src/agents/prompt/builder.ts`

## 关键点

- 代码层面不删除任何工具
- 只修改工具注册和提示词
- 保留 `teammate_spawn` 和 `teammate_send`
