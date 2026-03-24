# 需求文档：重新书写 .gitignore

## 需求背景

当前项目的 `.gitignore` 文件存在以下问题：
1. 包含不存在的目录引用（`wang/`）
2. 缺少新增的运行时数据目录
3. 项目结构发生变化后未及时更新忽略规则

## 详细描述

需要重新编写项目根目录的 `.gitignore` 文件，使其：
- 忽略所有运行时生成的数据
- 忽略开发/调试过程中生成的临时文件
- **保留 storage/prompts/ 下的提示词模板**（重要！）

## 期望结果

`.gitignore` 文件应包含以下类别的忽略规则：

| 类别 | 内容 |
|------|------|
| **环境变量** | `.env`、`.env.local`、`.venv` 等 |
| **IDE 配置** | `.vscode/`、`.idea/` 等 |
| **Node.js** | `node_modules/`、构建产物 |
| **Python** | `__pycache__/`、`.pytest_cache/` 等 |
| **UI (React/Vite)** | `ui/node_modules/`、`ui/dist/`、`ui/.vite/` 等 |
| **测试产物** | `coverage/`、`playwright-report/` 等 |
| **日志** | `*.log`、`storage/logs/` 等 |
| **Storage 运行时数据** | 全部忽略，**但保留 `storage/prompts/`** |
| **其他运行时数据** | `.transcripts/`、`plugins/`、`docs_development/`、`memory.db*` 等 |
| **敏感文件** | `.mcp.json`、密钥文件 |

## 约束条件

- 保留 `ui/postcss.config.js` 和 `ui/tailwind.config.js` 的例外规则（不被忽略）
- **保留 `storage/prompts/` 目录版本控制** - 这是唯一的例外
- 不忽略 `.claude/` 目录本身
- Git 相关目录（`.git/`、`.github/`）应该忽略

## Storage 目录处理方式

```
storage/
├── memory/          # 忽略 ❌
├── sessions/        # 忽略 ❌
├── workspace/       # 忽略 ❌
├── llm_logs/        # 忽略 ❌
├── llm_use/         # 忽略 ❌
├── tasks/           # 忽略 ❌
├── team-memory-test/ # 忽略 ❌
├── teammates/       # 忽略 ❌
├── checkpoints/    # 忽略 ❌
├── skills/          # 忽略 ❌
├── logs/            # 忽略 ❌
├── config.json      # 忽略 ❌
├── *.db*            # 忽略 ❌
└── prompts/         # 保留 ✅ - 提示词模板
```

---

请确认以上需求是否正确，确认后我开始实施。
