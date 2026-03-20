---
title: 快速开始
description: 5 分钟快速上手 Mul-Agent
---

# 快速开始

本指南帮助你在 5 分钟内开始使用 Mul-Agent。

## 前置要求

- Node.js 22+
- Python 3.10+
- pnpm

## 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/mul-agent.git
cd mul-agent

# 安装依赖
pnpm install
```

## 配置

```bash
# 复制环境变量文件
cp .env.example .env
```

编辑 `.env` 文件，添加 API 密钥：

```bash
# 必需
ANTHROPIC_API_KEY=sk-ant-your-key-here

# 可选
OPENAI_API_KEY=sk-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
```

## 启动

```bash
# 启动前端开发服务器
pnpm dev

# 启动 API 服务器（另一个终端）
pnpm api:dev
```

## 验证

```bash
# 运行测试
pnpm test:run

# 代码检查
pnpm lint
```

## 下一步

- [安装指南](/installation) - 详细安装步骤
- [Agent 概念](/concepts/agent) - 了解核心概念
