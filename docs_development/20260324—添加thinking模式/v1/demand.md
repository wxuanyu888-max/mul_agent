# 需求文档：Agent Thinking 模式

## 需求背景

希望在 Agent 执行 function call 之前进行一轮思考，提高输出的质量。

## 需求描述

1. 在提示词中添加思考引导，要求模型每次输出前先思考
2. 支持 MiniMax 原生 thinking API 模式

## 期望结果

- 模型在生成 tool call 或文本回复前会先进行思考
- 思考过程以结构化形式输出
- 全局默认启用 thinking 模式

## 约束条件

- 使用 MiniMax 模型
- thinking budget_tokens 默认 4096
