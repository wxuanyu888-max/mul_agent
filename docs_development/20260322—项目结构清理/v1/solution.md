# 实施过程

## 执行记录

### 步骤1：检查 docs_development/ 内容
- **检查结果**: 发现 `20260322—存储层清理` 需求目录，需要保留
- **决策**: 只删除空的 `docs_development/` 会被拒绝，需保留已有内容

### 步骤2：删除零散测试文件和临时文件
```bash
rm -f test.txt test_output.txt memory.db memory.db-shm memory.db-wal tsconfig.tsbuildinfo
```

### 步骤3：删除空目录
```bash
rm -rf docs_development/ examples/ plugins/
```
- **注意**: docs_development 目录在删除时被用户叫停，因为里面有需求文档

### 步骤4：删除参考代码目录
```bash
rm -rf extensions/ openclaw/ agentrx/ src/mul_agent.egg-info/
```

### 步骤5：移动项目文档到 docs/project/
```bash
git mv LICENSE SECURITY.md CHANGELOG.md CONTRIBUTING.md VISION.md AGENTS.md CLEANUP_REPORT.md docs/project/
mv GOAL.md docs/project/  # untracked 文件，用 mv
```

### 步骤6：更新 CLAUDE.md
- 将"每次需求开发都按照此规范执行"改为"所有用户需求都必须按照此规范执行"

---

## 关键文件

| 操作 | 文件 |
|------|------|
| 删除 | extensions/, openclaw/, agentrx/, src/mul_agent.egg-info/ |
| 删除 | test.txt, test_output.txt, memory.db*, tsconfig.tsbuildinfo |
| 移动 | LICENSE, SECURITY.md, CHANGELOG.md, CONTRIBUTING.md, VISION.md, AGENTS.md, CLEANUP_REPORT.md, GOAL.md → docs/project/ |

---

## 最终目录结构

```
根目录保留:
├── README.md
├── CLAUDE.md
├── package.json / pnpm-lock.yaml / tsconfig.json 等配置文件
├── src/, ui/, tests/, skills/, docs/, scripts/, storage/ 核心目录
└── .claude/, .github/, .env.example 等配置目录

docs/project/ (项目文档):
├── LICENSE
├── SECURITY.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── VISION.md
├── GOAL.md
├── AGENTS.md
└── CLEANUP_REPORT.md
```

---

## 测试方案

1. **目录检查**: 确认根目录无零散文件
2. **功能检查**: 确认项目仍可正常构建 `pnpm build`
3. **文档检查**: 确认 docs/project/ 文档完整
