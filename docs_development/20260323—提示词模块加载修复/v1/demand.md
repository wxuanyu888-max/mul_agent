# 需求文档：提示词模块加载修复

## 需求背景

用户查看日志时发现系统提示词很多模块没有加载，实际使用的提示词非常简洁，缺少 Safety、Skills、Memory、Runtime、Documentation 等重要模块。

## 问题分析

1. **问题根因**：`builder.ts` 中路径配置错误
2. **配置路径**：`config/prompts`
3. **实际路径**：`storage/config/prompts`
4. **影响范围**：Agent 缺少安全指南、技能系统、记忆系统等关键指令

## 解决过程

### 步骤 1：定位问题

通过分析日志发现：
- `config/prompts/` 目录不存在
- 代码使用了内置 fallback，内容非常简单

### 步骤 2：发现正确路径

找到实际提示词位置：`storage/config/prompts/`

已存在的文件：
- `templates/full.md`
- `templates/minimal.md`
- `templates/none.md`
- `system/base.md`
- `system/safety.md`
- `system/skills.md`
- `system/memory.md`
- `system/workspace.md`
- `system/runtime.md`
- `system/documentation.md`
- `system/tool-call-style.md`
- `system/heartbeats.md`
- `system/model-aliases.md`
- `system/sandbox.md`
- `system/reply-tags.md`
- `system/messaging.md`
- `system/silent-replies.md`
- `system/reactions.md`
- `system/reasoning-format.md`

### 步骤 3：修复代码

修改 `src/agents/prompt/builder.ts` 第 20 行：

```typescript
// 修改前
const PROMPTS_DIR = join(process.cwd(), 'config/prompts');

// 修改后
const PROMPTS_DIR = join(process.cwd(), 'storage/config/prompts');
```

### 步骤 4：重启 API 服务

修改代码后需要重启 API 服务才能生效。

## 验证方式

1. 查看 LLM 日志中的 system prompt
2. 确认提示词包含所有模块：base、safety、skills、memory、workspace、runtime、documentation、sandbox、model-aliases、heartbeats 等

## 当前状态

- [x] 修复路径配置
- [x] 重启 API 服务
- [x] 验证提示词加载（已完成）

## 约束条件

- 保持与现有代码的兼容性
- 不破坏现有的 fallback 机制
- 模板变量使用 `{{变量名}}` 格式
