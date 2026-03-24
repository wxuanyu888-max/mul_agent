# 实施文档：测试重写 V4 - 测试架构优化

> 创建时间：2026-03-23
> 版本：v4

---

## 1. 概述

完成了测试目录结构的重新组织，将测试按类型分为：
- 单元测试 (tests/unit/)
- 集成测试 (tests/integration/)
- E2E 测试 (tests/e2e/)

同时增加了 storage 目录用于存储测试产生的临时文件。

---

## 2. 新目录结构

```
tests/
├── unit/                      # 单元测试 (77个)
│   ├── tools/                 # 工具单元测试
│   │   ├── file/            # 文件工具
│   │   ├── bash/            # Bash 工具
│   │   ├── web/             # Web 工具
│   │   ├── memory/          # 记忆工具
│   │   ├── session/         # 会话工具
│   │   ├── tasks/           # 任务工具
│   │   ├── system/          # 系统工具
│   │   ├── teammate/        # 队友工具
│   │   ├── media/           # 媒体工具
│   │   ├── browser/         # 浏览器工具
│   │   └── message/         # 消息工具
│   ├── agents/              # Agent 单元测试
│   ├── api/                 # API 单元测试
│   ├── cli/                 # CLI 单元测试
│   ├── commands/            # 命令单元测试
│   ├── hooks/               # Hook 单元测试
│   ├── logger/              # 日志单元测试
│   ├── memory/              # 记忆单元测试
│   ├── message/             # 消息单元测试
│   ├── providers/           # Provider 单元测试
│   ├── session/             # 会话单元测试
│   ├── skills/              # Skill 单元测试
│   ├── storage/             # 存储单元测试
│   ├── factories/           # 测试工厂
│   ├── fixtures/            # 测试 fixtures
│   ├── helpers/             # 测试辅助函数
│   ├── mocks/               # Mock 数据
│   └── scripts/             # 测试脚本
│
├── integration/              # 集成测试 (12个)
│   ├── agent.test.ts        # Agent 集成
│   ├── api.test.ts          # API 集成
│   ├── tools.test.ts        # 工具集成
│   ├── llm.test.ts          # LLM 集成
│   ├── subagent.test.ts     # 子代理集成
│   ├── task-system.test.ts  # 任务系统集成
│   ├── memory-integration.test.ts
│   ├── team-memory.test.ts
│   ├── events.test.ts
│   ├── compaction-integration.test.ts
│   └── llm-diagnostics.test.ts
│
├── e2e/                     # E2E 测试 (8个)
│   ├── api/                 # API E2E 测试
│   ├── session/             # Session E2E 测试
│   ├── tools/               # Tools E2E 测试
│   └── ui/                  # UI E2E 测试
│
└── storage/                  # 测试存储
    ├── tmp/                 # 临时文件
    ├── logs/                # 测试日志
    └── test-results/        # 测试结果
```

---

## 3. 目录说明

| 目录 | 描述 |
|-----|------|
| `tests/unit/` | 单元测试，使用 mock，不调用外部 API |
| `tests/integration/` | 集成测试，真实 API 调用 |
| `tests/e2e/` | E2E 测试，完整用户流程 |
| `tests/storage/` | 测试产生的临时文件、日志等 |

---

## 4. 测试统计

| 类型 | 数量 |
|-----|------|
| 单元测试 | 77 个 |
| 集成测试 | 12 个 |
| E2E 测试 | 8 个 |
| **总计** | **97 个** |

---

## 5. 运行测试

### 单元测试
```bash
pnpm vitest run tests/unit/
```

### 集成测试
```bash
pnpm vitest run tests/integration/
```

### E2E 测试
```bash
pnpm vitest run tests/e2e/
```

### 全部测试
```bash
pnpm test:run
```

### 覆盖率
```bash
pnpm test:coverage
```

---

## 6. 测试文件命名规范

| 类型 | 模式 | 示例 |
|-----|------|------|
| 单元测试 | `{module}.test.ts` | `loop.test.ts` |
| 集成测试 | `{feature}.test.ts` | `tools.test.ts` |
| E2E 测试 | `{feature}.test.ts` 或 `{feature}.spec.ts` | `app.spec.ts` |

---

## 7. 验证

测试通过验证：
```bash
$ pnpm vitest run tests/unit/tools/browser/index.test.ts
 ✓ tests/unit/tools/browser/index.test.ts (9 tests)

$ pnpm vitest run tests/integration/agent.test.ts
 ✓ tests/integration/agent.test.ts (13 tests | 2 skipped)
```

---

## 8. 下一步

- 为 `tests/storage/tmp/` 配置自动清理
- 配置 CI 自动运行各类测试
- 建立覆盖率目标（当前 70%）
