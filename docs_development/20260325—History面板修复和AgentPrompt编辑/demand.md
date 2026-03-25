# History 面板修复 & Agent Prompt 编辑功能

## 需求背景

### 问题 1: History 面板无法显示数据
- 前端 CheckpointPanel 组件与 ChatPanel 使用不同的 sessionId 存储位置
- ChatPanel 使用 localStorage 存储 `chat_currentSessionId`
- CheckpointPanel 使用 zustand store 的 chatStore，导致无法获取正确的 sessionId
- 即使是同一个 Tab 内，localStorage 变化也不会触发 storage 事件

### 问题 2: Agent Prompt 无法在前端编辑
- 当前的 PromptVersionsPanel 功能复杂但实际用处不大
- Workflow 面板虽然能显示 agent 节点，但只能查看详情，无法编辑
- 用户希望能在 Workflow 界面直接编辑 teammate 的 prompt，并立即生效

## 需求描述

### 功能 1: History 面板数据同步
- 修复 CheckpointPanel 与 ChatPanel 的 sessionId 同步问题
- 支持跨 Tab 同步
- 当 sessionId 为空时，自动从后端获取最近的有效 session

### 功能 2: Agent Prompt 即时编辑
- 在 Workflow 面板点击 agent 节点后，能直接编辑 teammate 的 prompt
- 保存后立即生效到 `storage/teammates/config.json`
- 支持所有 agent 类型（不限于 teammate）

## 验收标准

1. History 面板能正确显示当前 session 的检查点列表
2. 切换不同 session 后，History 面板数据同步更新
3. 在 Workflow 面板可以编辑 agent 的 System Prompt
4. 编辑保存后，更改立即写入配置文件

## 约束条件

- 不新增独立的面板或按钮
- 复用现有 Workflow 面板的 AgentDetailsModal
- 后端 API 需要支持更新 teammate 配置
