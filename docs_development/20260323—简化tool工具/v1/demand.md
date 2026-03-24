# 需求文档：简化 Task 工具

## 需求背景

当前项目的 Task 工具系统过于复杂，包含多个工具（task_create, task_update, task_list, task_get, task），但实际使用时 Agent 只需要创建任务和执行，不需要手动管理状态。

## 详细描述

简化 Task 工具系统：

1. **保留 `task_create`** - 创建任务条目（持久化到 JSON）
2. **删除 `task_update` / `task_list` / `task_get`** - 代码保留，但在提示词中不再告知 Agent 使用
3. **`task` (subagent)** - 暂时搁置，后续处理
4. **进度管理** - 告知 Agent 直接用 `write` 工具写进度文件
5. **任务加载** - 在 Prompt Builder 中读取任务文件并自动注入到提示词

## 期望结果

- Agent 只需要知道 `task_create` 一个任务工具
- 进度更新通过 `write` 工具实现
- 简化提示词，减少工具数量

## 约束条件

- 不删除现有代码逻辑，只是不在提示词中暴露
- 保持向后兼容
