---
title: Agent 系统
description: 了解 Mul-Agent 的核心执行循环
---

# Agent 系统

Mul-Agent 的核心是基于 LLM 的自主执行循环系统。

## 执行流程

```
┌─────────────────────────────────────────┐
│           Agent Loop Engine              │
│  ┌───────────────────────────────────┐  │
│  │ 1. Build System Prompt           │  │
│  │ 2. Call LLM with Messages        │  │
│  │ 3. Parse LLM Response           │  │
│  │ 4. If tool_call: Execute Tool    │  │
│  │ 5. Add Result to Context        │  │
│  │ 6. Compact if needed             │  │
│  │ 7. Repeat until no tool_call    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 核心模块

| 模块 | 文件 | 描述 |
|------|------|------|
| 循环引擎 | `src/agents/loop.ts` | Agent 执行主循环 |
| LLM 客户端 | `src/agents/llm.ts` | 统一的多提供商接口 |
| 上下文压缩 | `src/agents/compaction.ts` | 三层压缩策略 |
| 会话管理 | `src/agents/session.ts` | 会话持久化 |

## 三层压缩策略

1. **Micro Compact**: 每次工具调用后，将旧的 tool result 替换为占位符
2. **Auto Compact**: 当 token 超过阈值时，自动保存对话到磁盘并生成摘要
3. **Manual Compact**: 手动触发压缩

## 消息类型

- `system` - 系统提示词
- `user` - 用户消息
- `assistant` - AI 回复
- `tool_use` - 工具调用请求
- `tool_result` - 工具执行结果

## 相关文件

- `src/agents/loop.ts` - 主循环
- `src/agents/types.ts` - 类型定义
- `src/agents/prompt/` - 提示词构建
- `src/agents/session.ts` - 会话管理
