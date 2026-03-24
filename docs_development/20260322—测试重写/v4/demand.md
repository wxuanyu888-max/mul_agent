# 需求文档：测试重写 V4 - 测试架构优化

> 创建时间：2026-03-23
> 版本：v4

---

## 1. 需求背景

当前测试目录结构混乱，存在以下问题：

### 1.1 当前问题

| 问题 | 描述 | 示例 |
|-----|------|------|
| 集成测试放错位置 | `integration.test.ts` 放在 `tests/src/tools/` | `tests/src/tools/integration.test.ts` |
| 命名不一致 | 既有 `index.test.ts` 又有单独测试文件 | `file/read.test.ts` vs `file/index.test.ts` |
| 分类不清晰 | 单元测试和集成测试混在一起 | `tests/src/` 下有 78 个测试 |
| 缺少统一规范 | 没有明确的测试分类标准 | - |

### 1.2 当前测试分布

```
tests/
├── src/                      # 78 个测试 ❌ 混合了单元和集成测试
│   ├── tools/
│   │   ├── integration.test.ts   # ❌ 真实 LLM API 测试，应该移出
│   │   ├── bash/
│   │   │   ├── index.test.ts     # 单元测试
│   │   │   └── integration.test.ts # ❌ 真实 LLM API 测试
│   │   ├── web/
│   │   │   ├── index.test.ts
│   │   │   └── integration.test.ts # ❌
│   │   ├── session/
│   │   │   ├── index.test.ts
│   │   │   └── integration.test.ts # ❌
│   │   └── ...
│   ├── agents/               # 17 个
│   ├── api/                  # 5 个
│   └── ...
├── integration/              # 11 个 ✅ 正确的位置
│   ├── agent.test.ts
│   ├── api.test.ts
│   └── ...
└── e2e/                     # 3 个 ✅
    ├── api-e2e.test.ts
    └── ...
```

---

## 2. 详细需求

### 2.1 重新组织测试目录

将测试分为三个明确的层级：

| 测试类型 | 位置 | 特征 |
|---------|------|------|
| **单元测试** | `tests/unit/` | 使用 mock，不调用外部 API |
| **集成测试** | `tests/integration/` | 真实 API 调用，多模块组合 |
| **E2E 测试** | `tests/e2e/` | 完整用户流程，真实环境 |

### 2.2 迁移规则

| 当前位置 | 目标位置 | 说明 |
|---------|---------|------|
| `tests/src/tools/integration.test.ts` | `tests/integration/tools.test.ts` | 工具集成测试 |
| `tests/src/tools/*/integration.test.ts` | `tests/integration/` | 各类工具集成测试 |
| `tests/src/tools/*.test.ts` | `tests/unit/tools/` | 工具单元测试 |
| `tests/src/agents/*.test.ts` | `tests/unit/agents/` | Agent 单元测试 |
| `tests/integration/*.test.ts` | 保持不变 | 已经是正确位置 |

### 2.3 目录结构目标

```
tests/
├── unit/                         # 单元测试 (使用 mock)
│   ├── tools/                   # 工具单元测试
│   │   ├── file/
│   │   │   ├── read.test.ts
│   │   │   ├── write.test.ts
│   │   │   └── index.test.ts
│   │   ├── bash/
│   │   ├── web/
│   │   ├── memory/
│   │   ├── session/
│   │   ├── tasks/
│   │   ├── system/
│   │   ├── teammate/
│   │   ├── media/
│   │   ├── browser/
│   │   ├── message/
│   │   └── index.ts             # 工具索引测试
│   ├── agents/                  # Agent 单元测试
│   │   ├── loop.test.ts
│   │   ├── llm.test.ts
│   │   └── ...
│   ├── api/                     # API 单元测试
│   ├── memory/                  # 内存单元测试
│   ├── session/                 # 会话单元测试
│   └── ...
├── integration/                 # 集成测试 (真实 API)
│   ├── agent.test.ts           # Agent 循环集成
│   ├── api.test.ts             # API 集成
│   ├── tools.test.ts           # 工具集成 (原 tests/src/tools/integration.test.ts)
│   ├── bash.test.ts            # Bash 工具集成
│   ├── web.test.ts             # Web 工具集成
│   ├── session.test.ts         # Session 工具集成
│   └── ...
└── e2e/                        # E2E 测试
    ├── api-e2e.test.ts
    ├── session-e2e.test.ts
    └── tools-e2e.test.ts
```

### 2.4 测试命名规范

| 类型 | 命名模式 | 示例 |
|-----|---------|------|
| 单元测试 | `{module}.test.ts` | `loop.test.ts`, `read.test.ts` |
| 集成测试 | `{feature}.integration.test.ts` | `tools.integration.test.ts` |
| E2E 测试 | `{feature}.e2e.test.ts` | `session.e2e.test.ts` |

### 2.5 保留的目录

以下目录保持不变：

| 目录 | 说明 |
|-----|------|
| `tests/factories/` | 测试工厂 |
| `tests/fixtures/` | 测试 fixtures |
| `tests/helpers/` | 测试辅助函数 |
| `tests/mocks/` | Mock 数据 |

---

## 3. 迁移步骤

### 3.1 步骤 1：创建新目录结构

```bash
mkdir -p tests/unit/{tools,agents,api,memory,session,providers,skills,hooks,commands,logger,cli,storage,message}
```

### 3.2 步骤 2：移动单元测试

```bash
# 移动 tools 单元测试
mv tests/src/tools/file/* tests/unit/tools/file/
mv tests/src/tools/bash/* tests/unit/tools/bash/
# ... 其他 tools 子目录

# 移动其他模块
mv tests/src/agents/* tests/unit/agents/
mv tests/src/api/* tests/unit/api/
# ... 其他模块
```

### 3.3 步骤 3：移动集成测试

```bash
# 移动工具集成测试
mv tests/src/tools/integration.test.ts tests/integration/tools.test.ts
mv tests/src/tools/bash/integration.test.ts tests/integration/bash.test.ts
mv tests/src/tools/web/integration.test.ts tests/integration/web.test.ts
mv tests/src/tools/session/integration.test.ts tests/integration/session.test.ts
```

### 3.4 步骤 4：删除旧目录

```bash
rm -rf tests/src
```

### 3.5 步骤 5：更新 vitest 配置

更新 `vitest.config.ts` 中的测试路径配置。

---

## 4. 期望结果

| 交付物 | 描述 |
|-------|------|
| 清晰的测试目录结构 | `tests/unit/`, `tests/integration/`, `tests/e2e/` |
| 正确的测试分类 | 单元测试/mock，集成测试/真实 API，E2E/完整流程 |
| 更易于维护 | 测试按类型和模块组织 |
| 更清晰的覆盖率报告 | 按测试类型分别统计 |

---

## 5. 约束条件

- 保持现有测试的功能不变
- 只做目录迁移，不修改测试代码
- 更新所有 import 路径
- 更新 vitest 配置

---

## 6. 优先级

| 优先级 | 任务 | 原因 |
|-------|------|------|
| P0 | 创建新目录结构 | 基础设施 |
| P1 | 移动单元测试 | 主要测试数量 |
| P2 | 移动集成测试 | 整理集成测试 |
| P3 | 删除旧目录 | 清理 |
| P4 | 更新 vitest 配置 | 确保测试能运行 |

---

## 7. 下一步

确认需求后开始实施。
