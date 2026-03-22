# MulAgent 源码模块综述

> 本文档详细介绍 MulAgent 项目 `src/` 目录下各模块的功能、职责及其在系统中的重要作用。

---

## 目录结构概览

```
src/
├── agents/          # 核心 Agent 引擎
├── api/             # HTTP API 服务
├── tools/           # 工具集
├── memory/          # 记忆系统
├── session/         # 会话管理
├── message/         # 消息队列
├── providers/       # LLM 提供商
├── skills/          # Skill 系统
├── hooks/           # 钩子系统
├── commands/        # 命令系统
├── cli/             # CLI 工具
├── logger/          # 日志系统
├── plugins/         # 插件系统
├── auth/            # 认证系统
├── boot/            # 启动机制
├── sandbox/         # 安全沙箱
└── multi-model/     # 多模型协作
```

---

## 核心模块详解

### 1. Agents 模块 — 核心智能体引擎

**路径**: `src/agents/`

**功能概述**: 这是整个系统的核心，负责 Agent 的运行、循环、工具调用、上下文管理等。

**主要子模块**:

| 子模块 | 功能 | 关键类/函数 |
|--------|------|------------|
| `loop.ts` | Agent 主循环，LLM + Tools 迭代执行 | `AgentLoop`, `createAgentLoop` |
| `llm.ts` | LLM 客户端封装 | `LLMClient`, `getLLMClient` |
| `session.ts` | 会话状态管理 | `SessionManager`, `createSessionManager` |
| `compaction.ts` | 上下文压缩，节省 token | `compactMessages`, `autoCompact` |
| `prompt/builder.ts` | 动态构建系统提示词 | `buildSystemPrompt` |
| `subagent.ts` | 子 Agent 管理 | `runSubagent`, `listSubagents` |
| `teammate.ts` | 队友智能体系统 (s09) | `spawnTeammate`, `sendToTeammate` |
| `supervisor/` | 多 Agent 协作编排 | `createSupervisor`, `delegateTask` |
| `checkpoint/` | 检查点与时间旅行 | `createCheckpoint`, `restoreFromCheckpoint` |
| `tracing/` | 分布式追踪 | `AgentTracer`, `traceTool`, `traceLLM` |
| `human-in-loop/` | 人工介入机制 | `HumanInLoopManager` |
| `planning/` | 自主规划系统 | LLM 驱动的任务规划与自我反思 |
| `context-engine/` | 上下文压缩策略 | `DefaultContextEngine` |
| `lifecycle.ts` | Agent 生命周期管理 | `LifecycleManager` |
| `degradation.ts` | 降级策略 | `DegradationManager` |
| `error-recovery.ts` | 错误自动恢复 | `ErrorRecoverySystem` |
| `learning.ts` | 学习系统 | `LearningSystem` |
| `planner.ts` | 任务规划器 | `TaskPlanner` |
| `websocket.ts` | WebSocket 实时通信 | `createWSClient` |
| `retry.ts` | 重试机制 | `withRetry` |

**支撑作用**: Agents 模块是整个 MulAgent 的大脑，负责任务规划、工具调用、上下文维护、错误处理等核心逻辑。所有其他模块都围绕它提供服务。

---

### 2. API 模块 — HTTP 服务层

**路径**: `src/api/`

**功能概述**: 提供 RESTful API 接口，供前端 UI 或外部调用。

**路由列表**:

| 路由 | 功能 |
|------|------|
| `info.ts` | 系统信息 |
| `agents.ts` | Agent 管理 |
| `chat.ts` | 聊天/消息队列 |
| `memory.ts` | 记忆操作 |
| `logs.ts` | 日志查询 |
| `projects.ts` | 项目管理 |
| `token.ts` | Token 使用统计 |
| `integrations.ts` | 第三方集成 |
| `tasks.ts` | 任务管理 |

**支撑作用**: API 模块是系统的入口层，将前端的 HTTP 请求转换为 Agent 可执行的任务，并返回结果。

---

### 3. Tools 模块 — 工具集

**路径**: `src/tools/`

**功能概述**: 定义 Agent 可调用的各种工具（Tool），每个工具对应一个具体的能力。

**工具分类**:

| 类别 | 工具 | 功能 |
|------|------|------|
| **文件操作** | `read`, `write`, `edit`, `grep`, `find`, `ls` | 文件读写、搜索 |
| **命令执行** | `exec`, `process`, `background_*` | Shell 命令执行 |
| **Web** | `web_search`, `web_fetch` | 网络搜索与抓取 |
| **记忆** | `memory_search`, `memory_get` | 向量记忆检索 |
| **会话** | `sessions_list`, `sessions_send`, `sessions_spawn` | 会话管理 |
| **任务** | `task`, `task_create`, `task_update`, `task_list` | 任务图管理 |
| **队友 (s09)** | `teammate_spawn`, `teammate_send`, `teammate_broadcast` | 多 Agent 通信 |
| **自主 (s11)** | `claim_task`, `team_list` | 任务认领与团队列表 |
| **Supervisor** | `supervisor` | 多 Agent 编排 |
| **媒体** | `browser`, `canvas`, `image`, `pdf`, `video`, `tts` | 多媒体处理 |
| **其他** | `compact`, `workspace`, `git`, `http`, `search` | 压缩、工作区、Git、HTTP |

**支撑作用**: Tools 是 Agent 的"手"和"眼睛"，让 Agent 能够操作文件系统、执行命令、访问网络、搜索记忆等。

---

### 4. Memory 模块 — 记忆系统

**路径**: `src/memory/`

**功能概述**: 提供完整的记忆管理能力，支持向量搜索、全文搜索、混合搜索。

**核心功能**:

| 功能 | 说明 |
|------|------|
| **向量嵌入** | 支持 OpenAI、Voyage、Gemini、Mistral、Ollama 等多种 embedding 提供商 |
| **混合搜索** | BM25 排序 + 向量相似度 + MMR 重排 + 时间衰减 |
| **统一记忆管理** | `UnifiedMemoryManager` 支持短期/长期/向量/工作区多种记忆层 |
| **团队记忆** | `teamMemoryWrite`, `teamMemoryRead` 支持多 Agent 共享记忆 |
| **文档解析** | `parseDocument` 支持多种文档格式 |

**支撑作用**: 记忆系统让 Agent 具备"长期记忆"能力，能够跨会话记住重要信息、代码规范、项目知识等。

---

### 5. Session 模块 — 会话管理

**路径**: `src/session/`

**功能概述**: 管理 Agent 会话的生命周期，包括会话创建、消息添加、工具调用记录、使用统计等。

**核心功能**:

- `createSession` — 创建新会话
- `addMessage` — 添加消息
- `addToolCall` — 记录工具调用
- `updateUsage` — 更新 token 使用统计
- `querySessions` — 查询历史会话

**支撑作用**: Session 模块维护每个用户/任务的会话上下文，是上下文管理的基石。

---

### 6. Message 模块 — 消息队列

**路径**: `src/message/`

**功能概述**: 用户消息的缓冲池，支持非阻塞输入。

**核心功能**:

- `enqueue` — 添加消息到队列
- `dequeue` — 获取并标记处理中
- `complete` / `fail` — 标记完成/失败
- `getStatus` — 获取队列状态

**支撑作用**: 消息队列实现请求的异步处理，支持消息批量处理和流量控制。

---

### 7. Providers 模块 — LLM 提供商

**路径**: `src/providers/`

**功能概述**: 封装多种 LLM 提供商的 API。

**支持提供商**:

| 提供商 | 说明 |
|--------|------|
| OpenAI | GPT-4, GPT-4o 等 |
| Anthropic | Claude 系列 |
| Ollama | 本地模型 |
| Azure | Azure OpenAI |

**核心功能**:

- `createProvider` — 创建 provider 实例
- `chat` — 统一聊天接口
- `setDefaultProvider` — 设置默认 provider
- `ProviderDiscoveryManager` — 自动发现可用 provider

**支撑作用**: Providers 模块解耦了 LLM 调用逻辑，支持灵活切换模型和提供商。

---

### 8. Skills 模块 — Skill 系统

**路径**: `src/skills/`

**功能概述**: Skill 是可被 Agent 发现和调用的能力单元，类似插件。

**核心功能**:

- `loadSkillsFromDir` — 从目录加载 skills
- `findSkillByKey` — 按 key 查找 skill
- `getUserInvocableSkills` — 获取用户可调用的 skills
- `SkillInvoker` — 执行 skill

**支撑作用**: Skill 系统扩展 Agent 能力，让用户可以自定义和复用 Agent 行为模式。

---

### 9. Hooks 模块 — 钩子系统

**路径**: `src/hooks/`

**功能概述**: 事件驱动的钩子机制，允许在特定生命周期点注入自定义逻辑。

**钩子类型**:

| 类别 | 钩子点 |
|------|--------|
| Agent | `agent.start`, `agent.end`, `agent.bootstrap`, `agent.error` |
| Session | `session.start`, `session.end`, `session.pause`, `session.resume` |
| Message | `message.received`, `message.before_process`, `message.after_process` |
| Tool | `tool.before_call`, `tool.after_call`, `tool.error` |
| Memory | `memory.before_save`, `memory.after_save`, `memory.before_recall` |

**支撑作用**: Hooks 实现了系统的可扩展性，让开发者可以在不修改核心代码的情况下添加日志、监控、认证等功能。

---

### 10. Commands 模块 — 命令系统

**路径**: `src/commands/`

**功能概述**: 解析和执行聊天中的命令（如 `/help`, `/status`）。

**核心功能**:

- `registerCommand` — 注册命令
- `executeCommand` — 执行命令
- `listCommands` — 列出所有命令

**预定义类别**: session, options, status, management, media, tools, info

**支撑作用**: Commands 模块让用户可以在对话中触发特定操作，如查看状态、切换选项等。

---

### 11. CLI 模块 — 命令行工具

**路径**: `src/cli/`

**功能概述**: 命令行接口，支持独立运行 CLI 命令。

**核心功能**:

- `CliRegistry` — 命令注册表
- `CliExecutor` — 命令执行器
- `createCli` — 创建 CLI 应用

**支撑作用**: CLI 模块让 MulAgent 可以作为命令行工具使用，脱离 UI 直接交互。

---

### 12. Logger 模块 — 日志系统

**路径**: `src/logger/`

**功能概述**: 统一的日志管理，包括运行时日志和 LLM 调用日志。

**核心功能**:

- `getLogger` — 获取日志实例
- `queryLogs` — 查询日志
- `logLlmCall` — 记录 LLM 调用
- `getLlmStats` — LLM 统计信息

**支撑作用**: Logger 模块提供可观测性，是调试和监控的基础。

---

### 13. Plugins 模块 — 插件系统

**路径**: `src/plugins/`

**功能概述**: 基于 OpenClaw 的插件架构，支持扩展 Provider 和 Channel。

**核心功能**:

- `loadPlugin` — 加载单个插件
- `loadPluginsFromDir` — 批量加载
- `initializePlugins` — 初始化所有插件
- `getProviderPlugin` / `getChannelPlugin` — 获取插件

**支撑作用**: Plugins 模块允许第三方扩展系统能力，如添加新的 LLM 提供商或通信渠道。

---

### 14. Auth 模块 — 认证系统

**路径**: `src/auth/`

**功能概述**: 身份认证和凭据管理。

**核心功能**:

- `profiles` — 认证配置文件
- `manager` — 凭据管理器

**支撑作用**: Auth 模块管理 API 密钥等敏感凭证，确保安全访问。

---

### 15. Boot 模块 — 启动机制

**路径**: `src/boot/`

**功能概述**: 读取并执行 `BOOT.md` 中定义的启动任务。

**支持的命令类型**:

- `message` — 发送消息到指定目标
- `run` — 执行命令
- `task` — 创建任务

**支撑作用**: Boot 模块让 Agent 能够在启动时自动执行初始化任务，如检查环境、发送欢迎消息等。

---

### 16. Sandbox 模块 — 安全沙箱

**路径**: `src/sandbox/`

**功能概述**: 隔离执行不受信任的代码，防止危险操作。

**安全措施**:

- 进程隔离
- 文件系统访问限制
- 网络访问控制
- 资源限制（内存、CPU、时间）
- 危险命令过滤
- 环境变量白名单

**预定义配置**: development, production, testing

**支撑作用**: Sandbox 模块保障系统安全，特别是执行用户提供的代码时。

---

### 17. Multi-Model 模块 — 多模型协作

**路径**: `src/multi-model/`

**功能概述**: 支持多个 LLM 同时工作，协同完成任务。

**协作策略**:

| 策略 | 说明 |
|------|------|
| `parallel` | 所有模型并行执行 |
| `sequential` | 顺序执行 |
| `primary-review` | 主模型执行，评审模型审核 |
| `research-execute` | 研究模型探索，执行模型实现 |

**预定义模板**: codeReview, researchExecute, parallelExplore

**支撑作用**: Multi-Model 模块让系统能够利用不同模型的专长，提升任务完成质量。

---

## 模块依赖关系

```
                    ┌─────────────────┐
                    │      API        │
                    │   (HTTP 入口)    │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
     ┌──────────┐      ┌──────────┐      ┌──────────┐
     │  CLI     │      │  Tools   │      │ Providers│
     │(命令行)   │      │(能力扩展) │      │ (LLM)    │
     └──────────┘      └────┬─────┘      └──────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Session  │  │  Memory  │  │  Hooks   │
        │(状态管理) │  │(记忆存储) │  │(扩展点)  │
        └────┬─────┘  └────┬─────┘  └──────────┘
             │             │
             └──────┬──────┘
                    │
                    ▼
            ┌──────────────┐
            │    Agents    │
            │  (核心引擎)   │
            └──────────────┘
```

---

## 总结

| 模块 | 职责 | 关键价值 |
|------|------|----------|
| **Agents** | 核心智能体引擎 | 任务规划、工具调用、上下文管理 |
| **API** | HTTP 服务层 | 外部访问入口 |
| **Tools** | 工具集 | 扩展 Agent 能力边界 |
| **Memory** | 记忆系统 | 长期记忆、向量搜索 |
| **Session** | 会话管理 | 上下文维护 |
| **Message** | 消息队列 | 异步处理、流量控制 |
| **Providers** | LLM 提供商 | 模型抽象、多源支持 |
| **Skills** | Skill 系统 | 能力复用、可扩展性 |
| **Hooks** | 钩子系统 | 事件驱动、插件化 |
| **Commands** | 命令系统 | 交互控制 |
| **CLI** | 命令行 | 脱 UI 运行 |
| **Logger** | 日志系统 | 可观测性 |
| **Plugins** | 插件系统 | 第三方扩展 |
| **Auth** | 认证系统 | 安全凭证管理 |
| **Boot** | 启动机制 | 初始化任务 |
| **Sandbox** | 安全沙箱 | 安全保障 |
| **Multi-Model** | 多模型协作 | 协同推理 |

这些模块共同构成了 MulAgent 的完整架构，使其成为一个功能强大、可扩展、安全可靠的多智能体协作系统。
