# 任务拆分

## 任务列表

### 1. 检查 docs_development/ 内容
- **文件位置**: docs_development/
- **依赖**: 无
- **状态**: 完成
- **说明**: 检查到有 `20260322—存储层清理` 需求目录，需要保留

### 2. 删除零散测试文件和临时文件
- **文件位置**: 根目录
- **依赖**: 任务1确认无依赖需求
- **执行**:
  ```bash
  rm -f test.txt test_output.txt memory.db memory.db-shm memory.db-wal tsconfig.tsbuildinfo
  ```

### 3. 删除空目录
- **文件位置**: 根目录
- **依赖**: 任务1确认
- **执行**:
  ```bash
  rm -rf docs_development/ examples/ plugins/  # docs_development 需先检查
  ```

### 4. 删除参考代码目录
- **文件位置**: 根目录, src/
- **依赖**: 无
- **执行**:
  ```bash
  rm -rf extensions/ openclaw/ agentrx/ src/mul_agent.egg-info/
  ```

### 5. 移动项目文档到 docs/project/
- **文件位置**: 根目录 → docs/project/
- **依赖**: 无
- **执行**:
  ```bash
  git mv LICENSE SECURITY.md CHANGELOG.md CONTRIBUTING.md VISION.md GOAL.md AGENTS.md CLEANUP_REPORT.md docs/project/
  ```
- **注意**: GOAL.md 是 untracked 文件，需要用 mv

### 6. 更新 CLAUDE.md 需求开发规范表述
- **文件位置**: CLAUDE.md
- **依赖**: 无
- **执行**: 将"每次需求开发"改为"所有用户需求"

---

## 依赖关系

```
任务1 (检查 docs_development)
    ↓
任务3 (删除空目录) ← 需要先确认任务1结果

任务2, 任务4, 任务5, 任务6 可并行执行
```
