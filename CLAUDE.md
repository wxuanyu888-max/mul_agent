# MulAgent Project Instructions

> Multi-Agent Collaboration System

---

## 项目架构

### 技术栈

| 层级 | 技术 |
|------|------|
| **主后端** | Node.js 22+, TypeScript, Express 5 |
| **辅助后端** | Python 3.10+ (memory embeddings, utilities) |
| **前端** | React 19, TypeScript, Vite 6 |
| **LLM 提供商** | Anthropic, OpenAI, Ollama, MiniMax |
| **向量存储** | 支持多种 embeddings |
| **测试** | Vitest, Playwright, pytest |
| **代码质量** | Oxlint, Oxfmt (TS), Ruff (Python) |

### 目录结构

```
mul-agent/
├── src/                      # TypeScript 主代码
│   ├── agents/               # Agent 核心系统
│   │   ├── loop.ts           # Agent 循环核心
│   │   ├── prompt/           # 提示词构建
│   │   ├── llm.ts            # LLM 客户端
│   │   ├── compaction.ts     # 上下文压缩
│   │   ├── session.ts        # 会话管理
│   │   ├── subagent.ts       # 子 Agent
│   │   ├── teammate.ts       # 队友系统
│   │   └── autonomous.ts     # 自主 Agent
│   │
│   ├── api/routes/           # Express API 路由
│   │   ├── agents.ts         # Agent 管理
│   │   ├── chat.ts           # 聊天/消息队列
│   │   ├── memory.ts         # 记忆端点
│   │   └── ...
│   │
│   ├── tools/                # 工具集
│   │   ├── file/             # 文件操作 (read/write/edit)
│   │   ├── bash/             # 命令执行
│   │   ├── browser/          # 浏览器自动化
│   │   └── ...
│   │
│   ├── memory/               # 记忆系统
│   ├── providers/            # LLM 提供商
│   ├── session/              # 会话管理
│   ├── message/             # 消息队列
│   ├── skills/               # Skill 系统
│   ├── hooks/                # Hook 系统
│   ├── logger/               # 日志系统
│   ├── commands/             # 命令系统
│   └── cli/                  # CLI 工具
│
├── ui/                       # React 前端
├── storage/                  # 运行时数据 (gitignored)
│   ├── prompts/              # 提示词模板
│   │   ├── templates/        # 模板 (full/minimal/none)
│   │   └── system/           # 系统模块 (base, skills, memory...)
│   ├── sessions/             # 会话持久化
│   ├── memory/               # 向量记忆
│   └── logs/                 # 日志文件
│
├── skills/                   # 自定义 skills
├── docs/                     # Mintlify 文档
├── tests/                    # 测试文件
└── scripts/                  # 工具脚本
```

---

## 开发规则

### 质量要求

- **测试覆盖率**: 80%+
- **TDD 开发**: 先写测试，再写实现
- **代码审查**: 提交前使用 code-reviewer agent
- **安全检查**: 使用 security-reviewer agent

### 代码规范

**TypeScript:**
```bash
pnpm lint          # Oxlint 检查
pnpm format:write # Oxfmt 格式化
pnpm typecheck    # 类型检查
pnpm test:run     # 运行测试
```

**Python:**
```bash
ruff check .      # 代码检查
ruff format .     # 代码格式化
pytest tests/     # 运行测试
```

### Git 工作流

1. 创建分支: `git checkout -b feature/xxx`
2. TDD 开发: 写测试 → 实现 → 重构
3. 代码审查: 使用 code-reviewer agent
4. 提交: `git commit -m "feat: description"`
5. 推送: `git push origin feature/xxx`

---

## 关键系统

### Agent Prompt 系统

提示词通过 `src/agents/prompt/builder.ts` 动态构建：

1. **模板模式**: `storage/prompts/templates/` (full/minimal/none)
2. **系统模块**: `storage/prompts/system/` (base, skills, memory...)
3. **动态变量**: 时间、工作目录、运行时信息等

```typescript
// 构建提示词
import { buildSystemPrompt } from './agents/prompt/builder.js';
const prompt = buildSystemPrompt({ config, tools, skills, runtime, context });
```

### Skill 系统

Skill 放在 `skills/` 目录，每个 skill 包含：
- `SKILL.md` - Skill 定义
- `skill.yaml` - 元数据

Agent 通过 `<available_skills>` 标签动态发现和调用 skill。

### 工具系统

工具定义在 `src/tools/`，每个工具有：
- name, description
- input schema
- handler function

---

## 需求开发规范

> 所有用户需求都必须按照此规范执行，文档放在 `docs_development/` 目录下

### 核心理念

**需求讨论先于任何分析**。当用户提出任何任务（探索、分析、开发、修复等），Agent 应该：
1. 先创建 `demand.md` 记录自己的初步理解
2. 和用户讨论确认需求范围、目标、约束
3. 用户确认后才进入分析/实施阶段

### 目录结构

```
docs_development/
└── 20260322—用户登录/              # 第一层：年月日—需求名
    ├── v1/                          # 第二层：版本
    │   ├── demand.md               # 需求文档（agent与用户对接）
    │   ├── task.md                 # 任务拆分（claude拆分需求）
    │   ├── solution.md             # 实施逻辑（实现过程、文件位置、逻辑、测试）
    │   └── review.md               # 评价改进（用户与agent讨论）
    └── v2/                          # 如果v1没完成，继续在v2写
        ├── demand.md
        ├── task.md
        ├── solution.md
        └── review.md
```

### 文档说明

| 文档 | 目的 | 内容 |
|------|------|------|
| **demand.md** | 记录需求 | 需求背景、详细描述、期望结果、约束条件 |
| **task.md** | 拆解任务 | 任务列表、依赖关系、文件位置 |
| **solution.md** | 实施过程 | 实现步骤、关键文件、核心逻辑、测试方案 |
| **review.md** | 复盘改进 | 实施评价、发现问题、改进建议、后续计划 |

### 工作流程

```
用户提出需求（任何形式：开发、分析、探索、修复等）
    ↓
Agent 创建 demand.md 草稿（记录初步理解）
    ↓
Agent 和用户讨论确认：
  - 需求范围是什么？
  - 期望结果是什么？
  - 有什么约束条件？
  - 优先级如何？
    ↓
用户确认需求后，创建 task.md 开始拆分
    ↓
实施（solution.md）
    ↓
复盘（review.md）
    ↓
如果需求未完成，继续在 v2/ 写
```

### 常见任务类型对应的 demand.md 示例

| 任务类型 | demand.md 侧重点 |
|---------|------------------|
| 新功能开发 | 功能描述、用户故事、验收标准 |
| Bug 修复 | 问题现象、复现步骤、期望行为 |
| 重构/清理 | 当前问题、目标状态、约束条件 |
| 探索分析 | 研究目标、输出形式、结论用途 |
| 性能优化 | 性能指标、当前瓶颈、目标提升 |

### 命名规范

- 文件夹：`年月日—需求名`，如 `20260322—用户登录`
- 版本：`v1`, `v2`, `v3`...
- 文档：固定四个文件名

### 重要原则

**不要跳过需求讨论阶段**。即使用户说"给我意见"，Agent 也应该：
1. 先创建 `demand.md` 记录初步分析
2. 和用户确认：分析范围是否正确？优先级是否符合预期？
3. 用户确认后再深入分析或开始实施

---

## 可删除目录

以下目录是参考代码，可以删除：

```bash
# OpenClaw 参考扩展（42个）
rm -rf extensions/

# OpenClaw 参考代码
rm -rf openclaw/

# 参考项目
rm -rf agentrx/

# Python 构建元数据
rm -rf src/mul_agent.egg-info/
```

---

## 环境变量

必需的环境变量（复制 `.env.example` 到 `.env`）:

```bash
# LLM 提供商
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OLLAMA_BASE_URL=

# 可选
MINIMAX_API_KEY=
```

---

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发
pnpm dev              # 前端 + API
cd ui && pnpm dev    # 仅前端
pnpm api:dev         # 仅 API

# 测试
pnpm test:run        # 前端测试
pytest tests/        # Python 测试
pnpm test:e2e        # E2E 测试

# 构建
pnpm build           # 构建前端
```
