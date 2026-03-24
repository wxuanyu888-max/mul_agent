# 需求文档 - 存储层清理 (v3)

> 继续完成 v2 遗留任务

---

## 需求背景

### v1/v2 完成情况

| 版本 | 状态 |
|-----|------|
| v1 | ✅ 核心架构完成（Repository、BaseStorageManager、API 内存修复） |
| v2 | ⚠️ 部分完成（TS 错误已修复，但基类使用、日志轮转、测试未完成） |

### v2 遗留任务

| 任务 | 状态 | 备注 |
|-----|------|------|
| TS 错误修复 | ✅ 已完成 | `pnpm typecheck` 通过 |
| storage 测试 | ❌ 未完成 | 覆盖率未知 |
| BaseStorageManager 使用 | ❌ 未完成 | 现有 Manager 未继承 |
| 日志轮转 | ❌ 未完成 | 配置存在但未实现 |

---

## Storage 目录分析

### 各子目录用途

| 目录 | 用途 | 存储方式 | 状态 |
|-----|------|---------|------|
| **sessions** | 会话持久化 | JSON 文件 | 正常使用 |
| **checkpoints** | Agent 检查点 | JSON 文件 | 正常使用 |
| **memory** | 向量记忆 + 统一记忆 | SQLite + JSON | 正常使用 |
| **prompts** | 提示词模板 | Markdown | 正常使用 |
| **workspace** | 用户工作空间 | 文件/目录 | 正常使用 |
| **logs** | 应用日志 | 文本文件 | ⚠️ 轮转未实现 |
| **llm_logs** | LLM 调用日志 | 文本文件 | 正常使用 |
| **llm_use** | LLM 使用统计 | JSONL | 正常使用 |
| **skills** | 运行时技能 | Markdown | 正常使用 |
| **tasks** | 任务持久化 | JSON 文件 | 正常使用 |
| **teammates** | 队友配置/消息 | JSON | 正常使用 |
| **cron-jobs** | 定时任务配置 | 空目录 | ⚠️ 未使用 |
| **team-memory-test** | 测试目录 | JSON | 🗑️ 可清理 |

### 潜在冲突分析

| 问题 | 分析 | 结论 |
|-----|------|------|
| memory vs workspace | memory 存向量/结构化数据，workspace 存用户文件 | ✅ 无冲突 |
| logs vs llm_logs | logs 是应用日志，llm_logs 是 LLM 调用记录 | ✅ 无冲突 |
| cron-jobs 空目录 | 功能未实现，可以删除 | ⚠️ 低优先级 |

---

## 详细描述

### v3 目标

1. **完成 storage 测试** - 覆盖率 80%+
2. **完成日志轮转** - 实现已配置的轮转功能
3. **完成 BaseStorageManager 继承** - 让现有 Manager 使用基类

### 范围

| 模块 | 当前状态 | 目标 |
|-----|---------|------|
| `tests/src/storage/` | 有测试文件 | 覆盖率 80%+ |
| `src/logger/manager.ts` | 轮转未实现 | 实现轮转 |
| `src/session/manager.ts` | 未使用基类 | 继承 BaseStorageManager |
| `src/agents/checkpoint/manager.ts` | 未使用基类 | 继承 BaseStorageManager |

### 约束条件

- [ ] 不能破坏现有功能
- [ ] 保持 API 接口不变
- [ ] 单元测试覆盖率 80%+

---

## 确认的需求

| 问题 | 确认结果 |
|------|---------|
| storage 测试 | ✅ 80%+ 覆盖率 |
| 日志轮转 | ✅ 实现 |
| BaseStorageManager | ✅ 继承使用 |

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构 |
| v2 | 2026-03-22 | 确认全部任务 |
| v3 | 2026-03-22 | 继续完成遗留任务 |
