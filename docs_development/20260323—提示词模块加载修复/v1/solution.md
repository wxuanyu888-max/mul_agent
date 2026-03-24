# 实施记录：提示词模块加载修复

## 实施时间
2026-03-23

## 问题描述
用户查看 LLM 日志时发现系统提示词非常简单，缺少很多模块（safety、skills、memory、sandbox、heartbeats 等）。

## 根因分析

### 1. 配置文件位置
- **代码配置**：`src/agents/prompt/builder.ts` 第 20 行
  ```typescript
  const PROMPTS_DIR = join(process.cwd(), 'config/prompts');
  ```
- **实际位置**：`storage/config/prompts/`
- **结果**：路径不匹配，加载失败，回退到内置 fallback

### 2. 提示词文件已存在
`storage/config/prompts/` 下已有完整的模板和模块文件：
- `templates/full.md` - 完整模板
- `templates/minimal.md` - 简洁模板
- `templates/none.md` - 空模板
- `system/*.md` - 17 个系统模块

## 修复方案

### 修改文件
`src/agents/prompt/builder.ts:20`

```typescript
// 修改前
const PROMPTS_DIR = join(process.cwd(), 'config/prompts');

// 修改后
const PROMPTS_DIR = join(process.cwd(), 'storage/config/prompts');
```

### 重启服务
修改代码后需要重启 API 服务才能生效。

## 验证方法

1. 启动 API 服务后，查看 LLM 日志中的 system prompt
2. 确认提示词包含所有模块：base、safety、skills、memory、workspace、runtime、documentation、sandbox、model-aliases、heartbeats 等

## 相关文件

- `src/agents/prompt/builder.ts` - 提示词构建器
- `src/utils/path.ts` - 路径配置（STORAGE_DIRS.PROMPTS）
- `storage/config/prompts/` - 提示词配置文件目录
