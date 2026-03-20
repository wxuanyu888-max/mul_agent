---
title: 介绍
description: 了解 Mul-Agent 是什么
---

# Mul-Agent 介绍

**Mul-Agent** 是一个基于 Node.js + TypeScript 的多 Agent 协作系统。

## 主要功能

- 🤖 **多 Agent 协作** - 支持多个 Agent 角色协同工作
- 🧠 **智能循环** - 基于 LLM 的自主执行循环
- 🛠️ **工具系统** - 内置丰富的工具集（文件操作、Bash、浏览器等）
- 📝 **记忆管理** - 向量记忆和会话持久化
- 🎯 **Skill 系统** - 可扩展的技能系统
- 📦 **多 LLM 支持** - Anthropic, OpenAI, Ollama, MiniMax

## 技术栈

| 层级 | 技术 |
|------|------|
| 主后端 | Node.js 22+, TypeScript, Express 5 |
| 辅助 | Python 3.10+ (embeddings, utilities) |
| 前端 | React 19, TypeScript, Vite 6 |
| LLM | Anthropic, OpenAI, Ollama, MiniMax |

## 核心模块

| 模块 | 路径 | 描述 |
|------|------|------|
| Agent 循环 | `src/agents/loop.ts` | 核心执行引擎 |
| 提示词构建 | `src/agents/prompt/` | 动态提示词 |
| 工具系统 | `src/tools/` | 文件、Bash、浏览器等 |
| 记忆系统 | `src/memory/` | 向量存储和检索 |
| API 路由 | `src/api/routes/` | Express 路由 |

## 架构图

```
┌─────────────────────────────────────────────┐
│                  Frontend (React)           │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              API Server (Express)           │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ /agents │ │ /chat   │ │ /memory     │   │
│  └─────────┘ └─────────┘ └─────────────┘   │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│            Agent Core (TypeScript)          │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ Loop    │ │ LLM     │ │ Compaction  │   │
│  └─────────┘ └─────────┘ └─────────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ Tools   │ │ Memory  │ │ Skills      │   │
│  └─────────┘ └─────────┘ └─────────────┘   │
└─────────────────────────────────────────────┘
```

## 下一步

- [快速开始](/getting-started) - 5 分钟上手
- [安装指南](/installation) - 详细安装步骤
- [Agent 概念](/concepts/agent) - 了解核心概念
