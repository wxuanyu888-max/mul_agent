# 实施方案：Task 工具优化

## 实施步骤

### 1. 创建 task 工具使用指南模块

**文件位置**：`storage/config/prompts/system/task.md`

**核心内容**：
- 为什么要使用 task（并行处理、专注单一、结果汇总）
- 推荐使用场景 vs 可直接执行场景
- 使用示例（展示并行派发多个子任务）
- 关键信息：**无需 handover**，系统自动处理上下文交接

### 2. 集成到完整提示词模板

**修改文件**：
- `storage/config/prompts/templates/full.md` - 添加 `{{task_guide}}` 占位符
- `src/agents/prompt/builder.ts` - 添加 `task_guide: loadModule('task')`

### 3. 简化 task 工具描述

**修改文件**：`src/tools/task.ts`

**修改内容**：
- 移除繁琐的"交接文档要求"
- 改为简洁的"最佳实践"指南
- 强调"无需 handover"

## 关键文件变更

| 文件 | 变更类型 |
|------|---------|
| `storage/config/prompts/system/task.md` | 新建 |
| `storage/config/prompts/templates/full.md` | 修改 |
| `src/agents/prompt/builder.ts` | 修改 |
| `src/tools/task.ts` | 修改 |

## 验证结果

- TypeScript 类型检查通过
