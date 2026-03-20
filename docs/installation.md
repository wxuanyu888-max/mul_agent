---
title: 安装指南
description: 详细安装步骤
---

# 安装指南

## 系统要求

- **Node.js**: 22 或更高版本
- **Python**: 3.10 或更高版本
- **pnpm**: 最新稳定版本

## 步骤 1: 克隆项目

```bash
git clone https://github.com/your-org/mul-agent.git
cd mul-agent
```

## 步骤 2: 安装依赖

```bash
pnpm install
```

## 步骤 3: 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 必需（至少选择一个 LLM 提供商）
ANTHROPIC_API_KEY=your_key_here

# 可选
OPENAI_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434
MINIMAX_API_KEY=your_key_here
```

## 步骤 4: 启动服务

前端开发服务器：

```bash
pnpm dev
```

API 服务器：

```bash
pnpm api:dev
```

## 验证安装

```bash
# 前端测试
pnpm test:run

# Python 测试
pytest tests/

# 代码质量
pnpm lint
pnpm format:check
```

## 开发命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动前端开发服务器 |
| `pnpm api:dev` | 启动 API 服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm test:run` | 运行测试 |
| `pnpm lint` | 代码检查 |

## 下一步

- [快速开始](/getting-started) - 开始使用
- [Agent 概念](/concepts/agent) - 了解核心概念
