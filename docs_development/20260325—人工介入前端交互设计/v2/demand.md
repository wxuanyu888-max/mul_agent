# 需求文档 - V2 All Agents 广播功能

## 需求背景

V1 中 "All Agents" 选项实际上就是 Core Brain。V2 需要改成真正的广播形式：发送给所有已创建的 agent。

## 详细描述

1. **All Agents** → 广播模式，消息并行发送给所有 teammate，分别返回结果
2. **Core Brain** → 单独的主 agent
3. **单独 agent** → 发送给特定的 teammate
4. **消息显示** → 每个 agent 的回复单独显示，带有名字标签和头像
5. **Workflow 面板** → 显示对应 agent 的 soul、role 等信息

## 期望结果

- 下拉框选项：All Agents (广播), Core Brain, Alex, Bella, Chris
- 选择 All Agents → 并行发送给所有 agents，每个回复单独显示
- 前端显示每个 agent 的头像（首字母）+ 名字标签
- Workflow 面板显示 agent 的详细信息

## 约束条件

- 需要实现广播逻辑
- 前端需要处理新的 `agent_response` 事件类型
- info API 需要从 teammates config 读取详细信息

## 优先级

高
