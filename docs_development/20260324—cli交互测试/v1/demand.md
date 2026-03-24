# 需求文档

## 需求概述

- **Issue**: #11 cli没有测试
- **需求**: 创建可交互的 CLI 工具，类似 Claude Code，可以直接对话
- **类型**: 功能开发

## 详细描述

### 问题背景

项目有 `src/cli/` 模块，但：
1. 没有独立的入口点
2. 无法直接运行交互式对话
3. 用户无法体验 CLI 功能

### 解决方案

1. 创建交互式 CLI 入口 `src/cli/repl.ts`
2. 集成 `AgentLoop` 实现对话功能
3. 注册为全局命令 `mulagent`

## 期望结果

1. 用户可以在任意目录直接运行 `mulagent` 命令
2. 支持交互式对话，Agent 可以调用工具
3. 支持基本命令：`exit`, `quit`, `clear`, `help`

## 约束条件

- 需要 Node.js 22+
- 需要 pnpm
- 需要 LLM API 配置（.env）

## 验收标准

- [x] 全局命令 `mulagent` 可用
- [x] 交互式对话正常
- [x] Agent 可以调用工具
- [x] 基本命令工作正常
