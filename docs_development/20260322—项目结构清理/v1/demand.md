# 需求文档：项目结构清理

## 需求背景

根目录存在大量零散文件，包括：
- 测试文件（test.txt, test_output.txt）
- 临时数据库（memory.db*）
- 未使用的空目录（docs_development/, examples/, plugins/）
- 项目文档分散在根目录（LICENSE, SECURITY.md 等）
- 参考代码目录（extensions/, openclaw/, agentrx/）

## 详细描述

1. **删除零散测试文件和临时文件**
   - test.txt, test_output.txt
   - memory.db, memory.db-shm, memory.db-wal
   - tsconfig.tsbuildinfo

2. **删除未使用的空目录**
   - docs_development/（已有内容需先检查）
   - examples/
   - plugins/

3. **删除 CLAUDE.md 指定的参考代码目录**
   - extensions/（OpenClaw 参考扩展）
   - openclaw/（OpenClaw 参考代码）
   - agentrx/（参考项目）
   - src/mul_agent.egg-info/（Python 构建元数据）

4. **整理项目文档到 docs/project/**
   - 将 LICENSE, SECURITY.md, CHANGELOG.md, CONTRIBUTING.md, VISION.md, GOAL.md, AGENTS.md, CLEANUP_REPORT.md 移动到 docs/project/

5. **更新 CLAUDE.md 中的需求开发规范表述**
   - 将"每次需求开发"改为"所有用户需求"

## 期望结果

- 根目录只保留必要的配置文件（package.json, tsconfig.json 等）
- 项目文档集中在 docs/ 目录下
- 无临时文件残留
- 目录结构清晰简洁

## 约束条件

- 删除前确认 docs_development/ 内是否有进行中的需求文档需要保留
- 文档移动使用 git mv 保持版本历史
- 不影响 node_modules、src、ui、tests 等核心代码目录
