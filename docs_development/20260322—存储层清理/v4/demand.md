# 需求文档 - 存储层清理 (v4)

> 分析 storage 目录重复和臃肿问题

---

## 需求背景

v1-v3 完成了架构层面的修复（Repository、BaseStorageManager 等），但 **storage 目录本身** 仍然臃肿，用户希望进一步清理。

### 当前 storage 目录结构

```
storage/
├── checkpoints/       # Agent 检查点（session_* 目录）
├── config.json        # 配置文件
├── cron-jobs/        # ⚠️ 空目录，未使用
├── llm_logs/         # LLM 调用日志（JSONL）
├── llm_use/          # LLM 使用统计
├── logs/             # 应用日志
├── memory/           # 向量记忆（SQLite）+ 统一记忆（JSON）
├── prompts/          # 提示词模板（Markdown）
├── sessions/         # 会话持久化（JSON）
├── skills/           # 运行时技能（Markdown）
├── tasks/            # 任务持久化（JSON）
├── teammates/        # 队友配置/消息
├── team-memory-test/ # 🗑️ 测试残留，可清理
└── workspace/        # 用户工作空间（临时文件）
```

---

## 问题分析

### 1. 重复：workspace vs 临时文件

| 目录 | 问题 |
|------|------|
| `workspace/` | 包含大量 `fetch_*`、`video_*` 临时文件，无过期清理机制 |
| `workspace/database/` | ⚠️ 包含 Python 代码文件（__init__.py, page.py），这是开发残留还是运行时需要？ |
| `workspace/test_llm_task.md` | ⚠️ 测试文件残留 |

### 2. 臃肿：可清理的目录

| 目录 | 状态 | 建议 |
|------|------|------|
| `team-memory-test/` | 测试残留 | 删除 |
| `cron-jobs/` | 空目录 | 删除 |
| `workspace/test_llm_task.md` | 测试残留 | 删除 |
| `workspace/database/` | Python 代码 | 需要确认用途 |

### 3. 潜在问题：配置 vs 数据

- `storage/config.json` - 运行时配置
- `storage/prompts/` - 提示词模板（可视为准静态）
- 其他都是运行时数据

**问题**：`prompts` 目录在 `storage/` 中，但它本质上是"模板"，和 `skills/` 类似。如果要彻底分离，可以考虑：
- 静态资源：`prompts/`、`skills/` 移到项目源码目录
- 运行时数据：其他所有目录

### 4. 路径分散问题

| 数据类型 | 存储位置 | 访问方式 |
|---------|---------|---------|
| 会话 | `storage/sessions/` | `src/session/` 模块 |
| 检查点 | `storage/checkpoints/` | `src/agents/checkpoint/` 模块 |
| 记忆 | `storage/memory/` | `src/memory/` 模块 |
| 提示词 | `storage/prompts/` | `src/agents/prompt/` 模块 |
| 任务 | `storage/tasks/` | `src/tools/tasks/` 模块 |
| 工作空间 | `storage/workspace/` | 直接访问 |

---

## 详细描述

### v4 目标

1. **清理废弃目录和文件** - 删除无用的临时文件
2. **确认 workspace/database 用途** - 决定保留还是删除
3. **添加过期清理机制** - 自动清理 workspace 中的临时文件

### 范围

| 任务 | 操作 |
|------|------|
| `storage/team-memory-test/` | 删除 |
| `storage/cron-jobs/` | 删除 |
| `storage/workspace/test_llm_task.md` | 删除 |
| `storage/workspace/database/` | 确认后决定 |
| workspace 临时文件 | 添加过期清理机制 |

### 约束条件

- [ ] 不能删除用户可能需要的数据
- [ ] 清理前需要确认每个目录的用途

---

## 待确认问题

### Q1: workspace/database/ 是什么？

发现以下 Python 文件：
- `workspace/database/__init__.py`
- `workspace/database/page_type.py`
- `workspace/database/core/__init__.py`
- `workspace/database/core/page.py`

**可能情况**：
1. A) 开发测试残留 → 删除
2. B) 运行时需要的功能 → 保留并移到合适位置

**请确认**：这些文件是什么用途？

### Q2: workspace 其他目录如何处理？

```
workspace/
├── fetch_mn0apx1i_c984d06a/  # fetch 工具的临时文件
├── video_mmyzqls0_ea9fe90c/  # video 工具的临时文件
├── test_llm_task.md           # 测试残留
└── database/                  # Python 代码
```

**建议**：
- 添加 TTL 过期机制（如 7 天自动删除）
- 或在工具执行完后主动清理

---

## 版本记录

| 版本 | 日期 | 描述 |
|-----|------|------|
| v1 | 2026-03-22 | 完成核心架构（Repository、BaseStorageManager） |
| v2 | 2026-03-22 | 确认全部任务（TS错误、日志轮转、测试） |
| v3 | 2026-03-22 | 继续完成遗留任务 |
| v4 | 2026-03-22 | 分析 storage 目录重复和臃肿问题 |
