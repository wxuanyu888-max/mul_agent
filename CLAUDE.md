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
