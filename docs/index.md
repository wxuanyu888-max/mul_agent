---
introduction: true
---

# Mul-Agent 文档

> 基于 Node.js + TypeScript 的多 Agent 协作系统

## 快速开始

- [项目介绍](/introduction) - 了解 Mul-Agent
- [快速开始](/getting-started) - 5 分钟上手
- [安装指南](/installation) - 详细安装步骤

## 核心概念

- [Agent 系统](/concepts/agent) - 核心执行循环
- [提示词系统](/concepts/prompt) - 动态提示词构建
- [工具系统](/concepts/tools) - 内置工具集
- [技能系统](/concepts/skills) - 可扩展技能

## 项目结构

```
mul-agent/
├── src/                 # TypeScript 主代码
│   ├── agents/          # Agent 核心系统
│   ├── api/routes/      # Express API
│   ├── tools/           # 工具集
│   ├── memory/          # 记忆系统
│   └── skills/          # 技能系统
├── ui/                  # React 前端
├── storage/prompts/     # 提示词模板
├── skills/              # 自定义技能
└── docs/                # 文档
```

## 相关链接

- [GitHub](https://github.com/your-org/mul-agent)
- [AGENTS.md](../AGENTS.md) - 英文项目指南
