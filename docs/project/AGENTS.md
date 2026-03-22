# Mul-Agent Project Guide

> A multi-agent collaboration system

---

## Quick Start

### Start Agent Service

```bash
# Install dependencies
pnpm install

# Start frontend dev server
cd ui && pnpm dev

# Start API server (in another terminal)
pnpm api:dev
```

### Development

```bash
# Run tests
pnpm test:run
pytest tests/

# Lint and format
pnpm lint
pnpm format:write
```

---

## Project Structure

```
mul-agent/
├── src/                      # TypeScript main codebase
│   ├── agents/               # Agent core system
│   │   ├── loop.ts          # Agent loop engine
│   │   ├── prompt/          # Prompt builder
│   │   ├── llm.ts          # LLM client
│   │   ├── compaction.ts   # Context compaction
│   │   ├── session.ts      # Session management
│   │   ├── subagent.ts     # Sub-agent support
│   │   ├── teammate.ts     # Teammate system
│   │   └── autonomous.ts   # Autonomous agent
│   │
│   ├── api/routes/          # Express API routes
│   │   ├── agents.ts       # Agent management
│   │   ├── chat.ts        # Chat & message queue
│   │   ├── memory.ts       # Memory endpoints
│   │   └── ...
│   │
│   ├── tools/               # Tool system
│   │   ├── file/           # File operations (read/write/edit)
│   │   ├── bash/           # Command execution
│   │   ├── browser/        # Browser automation
│   │   └── ...
│   │
│   ├── memory/             # Memory system
│   ├── providers/          # LLM providers
│   ├── session/            # Session management
│   ├── message/            # Message queue
│   ├── skills/            # Skill system
│   ├── hooks/             # Hook system
│   ├── logger/            # Logger
│   ├── commands/           # Command system
│   └── cli/                # CLI tools
│
├── ui/                      # React + TypeScript UI
├── storage/                 # Runtime data (gitignored)
│   ├── prompts/            # Prompt templates
│   │   ├── templates/      # Templates (full/minimal/none)
│   │   └── system/         # System modules
│   ├── sessions/           # Session persistence
│   ├── memory/             # Vector memory
│   └── logs/               # Log files
│
├── skills/                  # Custom skills
├── docs/                    # Documentation (Mintlify)
├── tests/                   # Test files
└── scripts/                 # Utility scripts
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Main Backend** | Node.js 22+, TypeScript, Express 5 |
| **Auxiliary** | Python 3.10+ (embeddings, utilities) |
| **Frontend** | React 19, TypeScript, Vite 6 |
| **LLM Providers** | Anthropic, OpenAI, Ollama, MiniMax |
| **Testing** | Vitest, Playwright, pytest |
| **Linting** | Oxlint, Oxfmt (TS), Ruff (Python) |
| **Docs** | Mintlify |

---

## Development Guidelines

### Code Quality

**TypeScript:**
```bash
pnpm lint              # Oxlint check
pnpm format:write     # Oxfmt format
pnpm typecheck        # Type check
pnpm test:run         # Run tests
```

**Python:**
```bash
ruff check .          # Ruff check
ruff format .         # Ruff format
pytest tests/         # Run tests
```

### Pre-commit Hooks

Install pre-commit hooks:
```bash
pip install pre-commit
pre-commit install
```

Hooks will run on every commit.

---

## Testing

### Frontend Tests

```bash
# Run tests
pnpm test:run

# Run with coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Python Tests

```bash
pytest tests/
```

---

## Documentation

### Setup

```bash
# Install Mintlify
npm install -g mintlify

# Start local docs server
cd docs && npx mintlify dev
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js project config |
| `pnpm-workspace.yaml` | pnpm workspace |
| `tsconfig.json` | TypeScript config |
| `oxlint.json` | Oxlint rules |
| `oxfmt.config.json` | Oxfmt settings |
| `pyproject.toml` | Python project config |
| `ruff.toml` | Ruff config |
| `vitest.config.ts` | Vitest config |
| `.pre-commit-config.yaml` | Pre-commit hooks |
| `mint.json` | Mintlify config |

---

## Available Scripts

### Root Level

```bash
pnpm dev              # Start dev server (frontend)
pnpm api:dev         # Start API server
pnpm build            # Build for production
pnpm lint             # Run Oxlint
pnpm format:write    # Format code
pnpm typecheck       # Type check
pnpm test:run        # Run tests
pnpm test:e2e       # Run E2E tests
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Cleanup (Reference Code)

The following directories contain reference code and can be removed:

```bash
# OpenClaw reference extensions (42 subdirectories)
rm -rf extensions/

# OpenClaw reference code
rm -rf openclaw/

# Reference project
rm -rf agentrx/

# Python build metadata
rm -rf src/mul_agent.egg-info/
```

---

## Related Resources

- [OpenClaw](https://github.com/openclaw/openclaw) - Reference architecture
- [Mintlify Docs](https://mintlify.com/docs)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html)
- [Ruff](https://docs.astral.sh/ruff/)
- [Vitest](https://vitest.dev/)
