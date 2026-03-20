---
title: 工具系统
description: 内置工具集和扩展方式
---

# 工具系统

工具系统位于 `src/tools/` 目录。

## 工具分类

| 分类 | 工具 | 描述 |
|------|------|------|
| 文件 | `read`, `write`, `edit`, `grep`, `find`, `ls` | 文件操作 |
| Bash | `exec`, `process`, `background` | 命令执行 |
| 浏览器 | `browser`, `goto`, `click`, `type` | 浏览器自动化 |
| 记忆 | `memory_search`, `memory_get` | 向量记忆检索 |
| 会话 | `sessions_list`, `history`, `send` | 会话管理 |
| Web | `web_search`, `web_fetch` | 网络请求 |

## 工具定义

每个工具包含：

```typescript
{
  name: 'tool_name',           // 工具名称
  description: '描述',        // 工具描述
  input_schema: {              // 输入参数schema
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
    required: ['param']
  },
  handler: async (params) => {  // 处理函数
    // 执行逻辑
    return { result: '...' };
  }
}
```

## 注册工具

工具通过 `src/tools/index.ts` 注册到 Agent 系统。

## 扩展工具

在 `src/tools/` 目录下添加新的工具模块：

```
src/tools/
├── index.ts          # 工具注册
├── file/             # 文件工具
├── bash/             # Bash 工具
└── custom/           # 自定义工具
    └── my_tool.ts
```

## 工具调用流程

1. LLM 返回 `tool_use` 结构
2. 解析工具名称和参数
3. 验证参数是否符合 schema
4. 查找并执行 handler
5. 返回结果并添加到上下文

## 相关文件

- `src/tools/index.ts` - 工具注册
- `src/tools/file/` - 文件操作工具
- `src/tools/bash/` - Bash 工具
- `src/tools/browser/` - 浏览器工具
