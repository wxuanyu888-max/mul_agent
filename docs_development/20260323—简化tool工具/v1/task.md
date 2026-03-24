# 任务拆分：简化 Task 工具

## 任务列表

1. [ ] 分析现有 task 工具的提示词描述位置
2. [ ] 修改提示词模板，只保留 `task_create` 工具描述
3. [ ] 在 Prompt Builder 中实现任务自动加载逻辑
4. [ ] 更新 `task_create` 工具描述，强调用 `write` 更新进度
5. [ ] 测试验证

## 依赖关系

- 任务1 无依赖
- 任务2 依赖任务1
- 任务3 依赖任务1
- 任务4 依赖任务2
- 任务5 依赖任务2-4

## 文件位置

- 提示词模板：`storage/prompts/` 或 `src/agents/prompt/`
- Prompt Builder：`src/agents/prompt/builder.ts`
- Task 工具：`src/tools/tasks/index.ts`

## 关键点

- 代码层面不删除任何工具
- 只修改提示词描述
- 任务自动加载在 Prompt Builder 解耦实现
