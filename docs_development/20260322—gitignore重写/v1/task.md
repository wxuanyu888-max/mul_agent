# 任务拆分：重新书写 .gitignore

## 任务列表

### 1. 分析当前 .gitignore 和项目结构
- 读取现有 `.gitignore` 文件
- 分析 storage/ 目录结构
- 确认需要保留和忽略的内容

### 2. 编写新的 .gitignore 文件
按照 demand.md 中的要求，重新编写忽略规则：

| 顺序 | 类别 | 文件位置 |
|------|------|----------|
| 1 | 环境变量 | `.env`、`.env.local`、`.venv` 等 |
| 2 | IDE 配置 | `.vscode/`、`.idea/` 等 |
| 3 | Node.js | `node_modules/`、构建产物 |
| 4 | Python | `__pycache__/`、`.pytest_cache/` 等 |
| 5 | UI (React/Vite) | `ui/node_modules/`、`ui/dist/`、`ui/.vite/` 等 |
| 6 | 测试产物 | `coverage/`、`playwright-report/` 等 |
| 7 | 日志 | `*.log`、`storage/logs/` 等 |
| 8 | Storage 运行时数据 | 全部忽略，**但 `storage/prompts/` 保留** |
| 9 | 其他运行时数据 | `.transcripts/`、`plugins/`、`docs_development/`、`memory.db*` 等 |
| 10 | 敏感文件 | `.mcp.json`、密钥文件 |

### 3. 验证 .gitignore 语法
- 确保例外规则正确（`!ui/postcss.config.js` 等）
- 确保 storage/prompts/ 没有被意外忽略

## 依赖关系

无依赖，直接按顺序执行。

## 关键文件

- `.gitignore` - 项目根目录

## 测试方案

1. 使用 `git status` 验证忽略规则是否生效
2. 确保 `storage/prompts/` 目录下的文件 **不被忽略**
3. 确保其他 storage/ 目录下的文件 **被忽略**
