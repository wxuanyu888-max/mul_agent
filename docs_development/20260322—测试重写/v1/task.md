# 任务拆分：单元测试重写

> 创建时间：2026-03-22
> 版本：v1

---

## 1. 任务概览

按照 TDD 规范重写所有单元测试，确保：
- **输入输出明确**
- **约束条件清晰**
- **真实行为验证**
- **80%+ 覆盖率**

---

## 2. 模块任务拆分

### 2.1 agents/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T1 | `src/agents/loop.ts` | AgentLoop 核心循环测试 | P0 |
| T2 | `src/agents/llm.ts` | LLMClient 调用测试 | P0 |
| T3 | `src/agents/tools.ts` | ToolRegistry 和 ToolLoop 测试 | P0 |
| T4 | `src/agents/prompt/builder.ts` | Prompt 构建器测试 | P1 |
| T5 | `src/agents/compaction.ts` | 上下文压缩测试 | P1 |
| T6 | `src/agents/config.ts` | 配置加载测试 | P1 |
| T7 | `src/agents/step.ts` | Step 运行测试 | P1 |
| T8 | `src/agents/runner.ts` | AgentRunner 测试 | P1 |
| T9 | `src/agents/teammate.ts` | TeammateManager 测试 | P2 |
| T10 | `src/agents/subagent.ts` | SubagentManager 测试 | P2 |
| T11 | `src/agents/autonomous.ts` | 自主 Agent 测试 | P2 |

### 2.2 tools/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T12 | `src/tools/types.ts` | 工具类型和工具结果测试 | P0 |
| T13 | `src/tools/file/read.ts` | 文件读取工具测试 | P0 |
| T14 | `src/tools/file/write.ts` | 文件写入工具测试 | P0 |
| T15 | `src/tools/file/edit.ts` | 文件编辑工具测试 | P0 |
| T16 | `src/tools/file/grep.ts` | 文件搜索工具测试 | P1 |
| T17 | `src/tools/file/ls.ts` | 目录列表工具测试 | P1 |
| T18 | `src/tools/bash/index.ts` | Bash 执行工具测试 | P0 |
| T19 | `src/tools/teammate/index.ts` | Teammate 工具测试 | P1 |
| T20 | `src/tools/web/index.ts` | Web 相关工具测试 | P2 |
| T21 | `src/tools/workspace.ts` | Workspace 工具测试 | P1 |
| T22 | `src/tools/load.ts` | 工具加载测试 | P1 |
| T23 | `src/tools/compact.ts` | 压缩工具测试 | P2 |
| T24 | `src/tools/tasks/index.ts` | 任务管理工具测试 | P1 |
| T25 | `src/tools/session/index.ts` | Session 工具测试 | P1 |
| T26 | `src/tools/system/index.ts` | System 工具测试 | P2 |
| T27 | `src/tools/memory/index.ts` | Memory 工具测试 | P1 |

### 2.3 memory/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T28 | `src/memory/database.ts` | MemoryDatabase 测试 | P0 |
| T29 | `src/memory/manager.ts` | MemoryIndexManager 测试 | P1 |
| T30 | `src/memory/embeddings/index.ts` | Embeddings 测试 | P1 |
| T31 | `src/memory/hybrid.ts` | 混合搜索测试 | P2 |

### 2.4 session/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T32 | `src/session/index.ts` | Session Manager 测试 | P0 |
| T33 | `src/session/types.ts` | Session 类型测试 | P1 |

### 2.5 commands/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T34 | `src/commands/registry.ts` | CommandRegistry 测试 | P1 |
| T35 | `src/commands/executor.ts` | CommandExecutor 测试 | P1 |
| T36 | `src/commands/predefined.ts` | 预定义命令测试 | P2 |

### 2.6 hooks/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T37 | `src/hooks/registry.ts` | HookRegistry 测试 | P1 |
| T38 | `src/hooks/executor.ts` | HookExecutor 测试 | P1 |
| T39 | `src/hooks/predefined.ts` | 预定义 Hooks 测试 | P2 |

### 2.7 providers/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T40 | `src/providers/index.ts` | Provider 工厂测试 | P1 |
| T41 | `src/providers/base.ts` | Base Provider 测试 | P1 |
| T42 | `src/providers/types.ts` | Provider 类型测试 | P1 |

### 2.8 api/routes/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T43 | `src/api/routes/index.ts` | 路由注册测试 | P1 |
| T44 | `src/api/routes/agents.ts` | Agent 路由测试 | P1 |
| T45 | `src/api/routes/memory.ts` | Memory 路由测试 | P1 |
| T46 | `src/api/routes/tasks.ts` | Task 路由测试 | P2 |
| T47 | `src/api/routes/token.ts` | Token 路由测试 | P2 |
| T48 | `src/api/routes/info.ts` | Info 路由测试 | P2 |

### 2.9 skills/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T49 | `src/skills/loader.ts` | Skill 加载器测试 | P1 |
| T50 | `src/skills/invoker.ts` | Skill 调用器测试 | P1 |
| T51 | `src/skills/manager.ts` | Skill 管理器测试 | P1 |
| T52 | `src/skills/types.ts` | Skill 类型测试 | P2 |

### 2.10 logger/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T53 | `src/logger/manager.ts` | Logger 测试 | P2 |

### 2.11 cli/ 模块

| 序号 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|-------|
| T54 | `src/cli/argv.ts` | CLI 参数解析测试 | P2 |
| T55 | `src/cli/commands.ts` | CLI 命令测试 | P2 |
| T56 | `src/cli/registry.ts` | CLI 注册表测试 | P2 |
| T57 | `src/cli/executor.ts` | CLI 执行器测试 | P2 |

---

## 3. 任务依赖关系

```
T1 (loop) ──┬── T2 (llm)
            ├── T3 (tools)
            ├── T4 (prompt)
            ├── T5 (compaction)
            └── T13-18 (tools/*)

T28 (memory/database) ──┬── T29 (memory/manager)
                        └── T30 (memory/embeddings)

T32 (session) ─── T33 (session/types)

T34 (commands/registry) ──┬── T35 (commands/executor)
                          └── T36 (commands/predefined)

T37 (hooks/registry) ──┬── T38 (hooks/executor)
                       └── T39 (hooks/predefined)

T49 (skills/loader) ──┬── T50 (skills/invoker)
                      └── T51 (skills/manager)
```

---

## 4. 测试执行顺序

1. **先跑 T1-T3**（核心依赖）
2. **再跑 T12-T18, T32**（工具和会话）
3. **然后 T28-T31, T34-T35, T37-T38**（存储和注册表）
4. **最后跑其他模块**

---

## 5. 验收标准

- [ ] 每个测试文件有且只对应一个源代码文件
- [ ] 每个公开函数/方法都有测试覆盖
- [ ] 输入输出、约束条件写入 solution.md
- [ ] 不使用 `as any` 类型断言
- [ ] 不存在 `expect(x).toBeDefined()` 这种虚假测试
- [ ] Mock 层级清晰，不过度 Mock
- [ ] 测试名称清晰描述测试场景

---

## 6. 下一步

确认任务拆分后，开始执行。先从 P0 优先级的任务开始（T1, T2, T3, T12, T13, T14, T15, T18, T28, T32）。
