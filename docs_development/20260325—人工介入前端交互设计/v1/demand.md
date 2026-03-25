# 需求文档 - Agent Team 下拉框支持

## 需求背景

用户创建了 Agent Team（有 Alex、Bella、Chris 等 teammate），前端下拉框需要能够选择不同的 agent 进行聊天，每个 agent 有自己的角色 prompt。

## 详细描述

1. **前端 Agent 下拉框** - 列出所有 agents（Core Brain + teammates）
2. **后端 API** - 从 teammates config.json 加载 agent 列表
3. **统一 AgentLoop** - 所有 agent 使用同一个 AgentLoop，通过 `extraSystemPrompt` 区分角色
4. **Prompt 模板** - 在 full.md 中添加 `{{extra}}` 占位符

## 期望结果

- 前端下拉框显示：Core Brain, Alex, Bella, Chris
- 选择不同 agent 发送消息时，使用各自的 prompt
- 问 "你是谁" 能正确回答对应的名字和角色

## 约束条件

- 不破坏 Core Brain 的原有功能
- 使用统一的 AgentLoop 处理逻辑

## 优先级

高 - 核心功能
