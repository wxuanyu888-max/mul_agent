# 实施过程 - Storage 重组 (v4)

## 目标

将 storage 目录按功能域重组，解决目录臃肿和路径混乱问题。

---

## 最终结构

```
storage/
├── agent/                    # Agent 运行时数据
│   ├── sessions/             # Session 数据（每个 session 包含 workspace/、tasks/）
│   │   └── {sessionId}/
│   │       ├── workspace/    # Session 专属工作区（自动创建）
│   │       └── tasks/        # Session 专属任务（自动创建）
│   └── cron-jobs/           # 定时任务
├── memory/
│   └── memory/               # 向量记忆 + 持久记忆 + memory.db
├── runtime/                  # 运行时调试数据
│   ├── logs/                 # 应用日志
│   ├── llm_logs/            # LLM 调用日志
│   ├── llm_use/             # LLM 使用统计
│   ├── checkpoints/         # Agent 检查点
│   ├── workspace/           # 全局工作区（工具默认使用）
│   └── transcripts/         # 压缩前的对话原始数据备份
└── config/                   # 静态配置
    ├── prompts/             # 提示词模板（版本控制）
    ├── skills/              # 运行时技能
    ├── teammates/          # 队友配置
    └── config.json          # 主配置文件
```

---

## 实施步骤

### 1. 数据迁移

```bash
# 创建目录结构
mkdir -p agent/sessions
mkdir -p runtime/{logs,llm_logs,llm_use,checkpoints,workspace,transcripts}
mkdir -p memory/memory
mkdir -p config/{prompts,skills,teammates}

# 移动数据
cp -r logs/* runtime/logs/
cp -r llm_logs/* runtime/llm_logs/
cp -r llm_use/* runtime/llm_use/
cp -r memory/* memory/memory/
cp -r prompts/* config/prompts/
cp -r skills/* config/skills/
cp -r teammates/* config/teammates/
cp config.json config/config.json
cp -r checkpoints/* runtime/checkpoints/
```

### 2. 代码修改

| 文件 | 修改内容 |
|------|----------|
| `src/utils/path.ts` | 更新 STORAGE_DIRS 映射，新增 getSessionWorkspacePath/getSessionTasksPath |
| `src/session/manager.ts` | 创建 session 时自动创建 workspace/ 和 tasks/ 目录 |
| `src/agents/checkpoint/time-travel.ts` | 路径改为 runtime/checkpoints |
| `src/agents/prompt/builder.ts` | 路径改为 config/prompts，session workspace 改为 agent/sessions/{id}/workspace |
| `src/agents/prompt/version-manager.ts` | 路径改为 config/prompts |
| `src/agents/config.ts` | 路径改为 config/config.json |
| `src/agents/compaction.ts` | transcriptDir 改为 storage/runtime/transcripts |
| `src/agents/context-engine/types.ts` | transcriptDir 改为 storage/runtime/transcripts |
| `src/tools/compact.ts` | transcriptDir 改为 storage/runtime/transcripts |
| `src/tools/web/fetch.ts` | 路径改为 runtime/workspace |
| `src/tools/media/video.ts` | 路径改为 runtime/workspace |
| `src/tools/file/grep.ts` | 路径改为 runtime/workspace 和 memory/memory |
| `src/tools/memory/get.ts` | 改为 getMemoryPath() |
| `src/tools/memory/search.ts` | 改为 getMemoryPath() |
| `src/memory/unified.ts` | 路径改为 memory/memory 和 runtime/workspace |
| `src/memory/routes.ts` | 路径改为 memory/memory |
| `src/api/routes/memory.ts` | 路径改为 memory/memory |

### 3. 问题修复

1. **Session 自动创建 workspace/tasks**
   - 修改 `src/session/manager.ts`，在 createSession 时创建目录

2. **根目录生成 memory.db 问题**
   - 原因：工具使用 `process.cwd()` 作为 workspaceDir
   - 修复：改为使用 `getMemoryPath()`

3. **根目录生成 .transcripts 问题**
   - 原因：默认使用 `.transcripts` 目录
   - 修复：改为 `storage/runtime/transcripts`

4. **测试目录问题**
   - 原因：测试代码在 storage 根目录创建 `team-memory-test`
   - 修复：改为使用 `os.tmpdir()`

### 4. .gitignore 更新

```gitignore
# Storage - Runtime Data
storage/memory/
storage/agent/
storage/runtime/
storage/config/skills/
storage/config/teammates/
storage/config/config.json
storage/*.db
storage/*.db-shm
storage/*.db-wal

# 保留配置模板在版本控制中
!storage/config/prompts/
```

---

## 关键设计决策

1. **Session 工作区**：每个 session 有独立的 `workspace/` 和 `tasks/`，创建 session 时自动生成
2. **Runtime 归类**：日志、检查点、transcripts 等运行时调试数据都放在 runtime/
3. **Config 归类**：静态配置（prompts, skills, teammates）放在 config/
4. **路径集中管理**：通过 `src/utils/path.ts` 统一管理所有存储路径
