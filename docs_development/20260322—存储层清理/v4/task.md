# 任务拆分 - Storage 重组 (v4)

## 目标

将 storage 目录按功能域重组：

```
storage/
├── agent/
│   └── sessions/              # 会话持久化
│       └── {sessionId}/
│           ├── workspace/      # session 工作区（从 runtime 移入）
│           ├── tasks/         # session 任务（从 agent/tasks 移入）
│           └── nodes/        # 原 sessions 内容
├── memory/
│   └── memory/               # 向量记忆 + 持久记忆（原 memory/）
├── runtime/
│   ├── logs/                 # 应用日志（原 logs/）
│   ├── llm_logs/            # LLM 调用日志（原 llm_logs/）
│   ├── llm_use/             # LLM 使用统计（原 llm_use/）
│   └── checkpoints/         # Agent 检查点（原 checkpoints/）
└── config/
    ├── prompts/             # 提示词模板（原 prompts/）
    ├── skills/              # 运行时技能（原 skills/）
    ├── teammates/          # 队友配置（原 teammates/）
    └── config.json          # 主配置文件
```

## 关键设计

1. **session 工作区**：每个 session 有独立的 `workspace/` 和 `tasks/`
2. **新建 session 自动创建**：创建新会话时自动创建这两个目录
3. **checkpoints 归入 runtime**：与日志同类，属于运行时调试数据

---

## 任务列表

### Phase 1: 迁移数据目录

| 序号 | 任务 | 操作 | 风险 |
|------|------|------|------|
| 1.1 | 创建目录结构 | 创建 `agent/sessions/`, `runtime/`, `config/` 目录 | 低 |
| 1.2 | 迁移 runtime/checkpoints | `checkpoints/` → `runtime/checkpoints/` | 中 |
| 1.3 | 迁移 runtime 数据 | `logs/`, `llm_logs/`, `llm_use/` → `runtime/` | 低 |
| 1.4 | 迁移 config 数据 | `prompts/`, `skills/`, `teammates/`, `config.json` → `config/` | 中 |
| 1.5 | 迁移 memory 数据 | `memory/` → `memory/memory/` | 中 |
| 1.6 | 迁移 session 结构 | `sessions/*/` → `agent/sessions/*/nodes/` | 高 |
| 1.7 | 创建 session workspace/tasks 模板 | 在每个 session 下创建 `workspace/` 和 `tasks/` | 中 |

### Phase 2: 更新代码引用

| 序号 | 任务 | 文件 | 风险 |
|------|------|------|------|
| 2.1 | 更新 checkpoints 路径 | `checkpoint/time-travel.ts` | 高 |
| 2.2 | 更新 prompts 路径 | `agents/prompt/builder.ts`, `agents/prompt/version-manager.ts` | 高 |
| 2.3 | 更新 skills 路径 | (确认引用位置) | 中 |
| 2.4 | 更新 memory 路径 | `memory/persistence.ts`, `memory/unified.ts`, `api/routes/memory.ts` | 高 |
| 2.5 | 更新 logs 路径 | `logger/manager.ts` | 中 |
| 2.6 | 更新 llm_logs 路径 | `agents/llm.ts` | 中 |
| 2.7 | 更新 config 路径 | `agents/config.ts` | 中 |
| 2.8 | 更新 sessions 路径 + workspace/tasks | `supervisor/registry.ts` | 高 |
| 2.9 | 更新 tasks 路径 | `tools/tasks/` 相关文件 | 中 |
| 2.10 | 更新 workspace 路径 | `tools/web/fetch.ts`, `tools/media/video.ts`, `tools/file/grep.ts` | 高 |
| 2.11 | 新建 session 时创建 workspace/tasks | `session/manager.ts` | 高 |

### Phase 3: 验证

| 序号 | 任务 | 操作 |
|------|------|------|
| 3.1 | 运行类型检查 | `pnpm typecheck` |
| 3.2 | 运行应用测试 | 启动开发服务器测试基本功能 |
| 3.3 | 验证各模块 | 确认 sessions/memory/prompts 等正常工作 |

### Phase 4: 清理

| 序号 | 任务 |
|------|------|
| 4.1 | 删除旧的顶层目录 |
| 4.2 | 更新 .gitignore（如需要） |

---

## 依赖关系

```
Phase 1 ─────┬─────> Phase 2 ─────> Phase 3 ──> Phase 4
             │
    （数据迁移）   （代码更新）    （验证）     （清理）
```

---

## 预计工作量

| Phase | 任务数 | 预计时间 |
|-------|--------|---------|
| Phase 1 | 7 | 15 min |
| Phase 2 | 11 | 40 min |
| Phase 3 | 3 | 15 min |
| Phase 4 | 2 | 5 min |
| **总计** | **23** | **~75 min** |

---

## 风险控制

1. **先备份再操作** - 保留原目录直到验证通过
2. **逐个模块验证** - 每更新一个模块路径就测试
3. **保留旧路径兼容** - 考虑添加路径兼容层（可选）
