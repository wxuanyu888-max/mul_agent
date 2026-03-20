---
title: 提示词系统
description: 动态提示词构建和管理
---

# 提示词系统

提示词通过 `src/agents/prompt/builder.ts` 动态构建。

## 目录结构

```
storage/prompts/
├── templates/          # 模板模式
│   ├── full.md         # 完整模板
│   ├── minimal.md      # 最小模板
│   └── none.md         # 仅基础
└── system/             # 系统模块
    ├── base.md         # 基础身份
    ├── skills.md       # 技能系统
    ├── memory.md       # 记忆系统
    ├── safety.md       # 安全指南
    ├── workspace.md    # 工作空间
    └── ...
```

## 模板模式

| 模式 | 描述 |
|------|------|
| `full` | 完整提示词，包含所有模块 |
| `minimal` | 最小提示词，仅包含基础和工具 |
| `none` | 仅包含基础身份 |

## 动态变量

提示词构建器会自动替换以下变量：

- `{{workspace_dir}}` - 工作目录
- `{{time_info}}` - 当前时间
- `{{owner_info}}` - 所有者信息
- `{{tool_list}}` - 可用工具列表
- `{{runtime_info}}` - 运行时信息

## 使用方式

```typescript
import { buildSystemPrompt } from './agents/prompt/builder.js';

const prompt = buildSystemPrompt({
  config: {
    promptMode: 'full',
    workspaceDir: '/path/to/workspace',
    currentTime: new Date().toISOString(),
  },
  tools: [
    { name: 'read', description: 'Read file content' },
    { name: 'write', description: 'Write file content' },
  ],
  skills: [
    { name: 'skill-name', description: '...', location: './skills/xxx' },
  ],
  runtime: {
    channel: 'cli',
    capabilities: ['bash', 'file'],
  },
});
```

## 相关文件

- `src/agents/prompt/builder.ts` - 提示词构建器
- `src/agents/prompt/types.ts` - 类型定义
- `storage/prompts/` - 提示词模板目录
