# 实施过程：重新书写 .gitignore

## 实现步骤

### 1. 分析项目结构
- 读取现有 `.gitignore` 文件
- 分析 `storage/` 目录结构，确认各子目录用途
- 确认 `storage/prompts/` 包含提示词模板需要保留

### 2. 重新编写 .gitignore
按照 demand.md 要求，分 14 个类别编写：

| 类别 | 忽略内容 |
|------|----------|
| Environment | `.env`、`.env.local`、`.venv` 等 |
| IDE | `.vscode/`、`.idea/`、`.DS_Store` 等 |
| Node.js | `node_modules/`、`.pnpm-store/`、日志等 |
| UI | `ui/node_modules/`、`ui/dist/`、`ui/.vite/` 等 |
| Python | `__pycache__/`、`.pytest_cache/` 等 |
| Testing | `coverage/`、`.nyc_output/` 等 |
| Logs | `*.log`、`logs/`、`storage/logs/` |
| **Storage** | 全部忽略，**`storage/prompts/` 保留** |
| Transcripts | `.transcripts/` |
| Plugins | `plugins/` |
| Docs Development | `docs_development/` |
| Memory | `memory.db*` |
| MCP Config | `.mcp.json` |
| Secrets | `*.pem`、`credentials.json` 等 |

### 3. 关键设计决策

**保留 `storage/prompts/` 版本控制：**
```gitignore
# storage/prompts/ - 不在忽略列表中，保留版本控制
```

**UI 配置文件例外：**
```gitignore
ui/*.js
ui/*.d.ts
!ui/postcss.config.js   # 例外：不忽略
!ui/tailwind.config.js  # 例外：不忽略
```

## 关键文件

| 文件 | 路径 | 说明 |
|------|------|------|
| .gitignore | 项目根目录 | 重新编写的忽略规则 |

## 测试方案

### 验证结果

| 测试项 | 预期结果 | 实际结果 |
|--------|----------|----------|
| `storage/prompts/` 是否被忽略 | **否（保留）** | ✅ 不被忽略 |
| `storage/sessions/` 是否被忽略 | 是 | ✅ 规则正确（新文件会被忽略）|
| `storage/memory/` 是否被忽略 | 是 | ✅ 被忽略 |
| `.transcripts/` 是否被忽略 | 是 | ✅ 被忽略 |
| `ui/postcss.config.js` 是否被忽略 | **否（保留）** | ✅ 不被忽略 |

### 已跟踪文件的特殊处理

**注意：** `storage/sessions/` 等目录下的文件已经被 git 跟踪，添加 ignore 规则后：
- 新文件会被忽略 ✅
- 已跟踪文件仍会被跟踪（需 `git rm --cached` 移除）

这是 git ignore 的正常行为，不影响新文件的忽略规则。

## 总结

新的 `.gitignore` 文件：
1. ✅ 移除了不存在的 `wang/` 目录引用
2. ✅ 完整覆盖了 `storage/` 目录下的运行时数据
3. ✅ **保留了 `storage/prompts/`** 提示词模板
4. ✅ 添加了 `.transcripts/`、`plugins/`、`docs_development/` 等新目录
5. ✅ 添加了敏感文件忽略规则（`.mcp.json`、密钥文件等）
6. ✅ 按类别分组，结构清晰
