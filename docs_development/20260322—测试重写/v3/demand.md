# 需求文档：测试重写 V3 - 测试覆盖率提升与工具集成测试完善

> 创建时间：2026-03-23
> 版本：v3

---

## 1. 需求背景

V2 已实现真实 LLM API 集成测试，但存在以下问题：

1. **覆盖率不足** - 缺少关键工具的单元测试（browser, message）
2. **集成测试分散** - 各工具测试风格不统一
3. **缺少覆盖率追踪** - 未建立 80% 覆盖率目标

---

## 2. 当前测试架构分析

### 2.1 测试目录结构

```
tests/
├── src/                      # 单元测试 (73个)
│   ├── tools/                # 工具单元测试
│   │   ├── file/            # ✅ 3个测试
│   │   ├── bash/            # ✅ 1个测试
│   │   ├── web/             # ✅ 1个测试
│   │   ├── memory/          # ✅ 1个测试
│   │   ├── session/         # ✅ 1个测试
│   │   ├── tasks/           # ✅ 2个测试
│   │   ├── system/          # ✅ 1个测试
│   │   ├── teammate/        # ✅ 1个测试
│   │   ├── media/            # ✅ 1个测试
│   │   ├── compact.test.ts  # ✅
│   │   ├── load.test.ts     # ✅
│   │   ├── workspace.test.ts# ✅
│   │   ├── types.test.ts    # ✅
│   │   └── integration.test.ts # ✅ 真实 LLM API 测试
│   ├── agents/              # Agent 单元测试
│   ├── api/                # API 单元测试
│   ├── memory/             # 内存单元测试
│   └── ...
├── integration/              # 集成测试 (11个)
│   ├── agent.test.ts
│   ├── api.test.ts
│   ├── llm.test.ts
│   └── ...
└── e2e/                     # E2E 测试 (3个)
```

### 2.2 工具覆盖情况

| 工具目录 | 单元测试 | 状态 |
|---------|---------|------|
| file | ✅ 3个 | 完整 |
| bash | ✅ 1个 | 基础 |
| web | ✅ 1个 | 基础 |
| memory | ✅ 1个 | 基础 |
| session | ✅ 1个 | 基础 |
| tasks | ✅ 2个 | 基础 |
| system | ✅ 1个 | 基础 |
| teammate | ✅ 1个 | 基础 |
| media | ✅ 1个 | 基础 |
| **browser** | ❌ 无 | **需补充** |
| **message** | ❌ 无 | **需补充** |

---

## 3. 详细需求

### 3.1 补充缺失的单元测试

| 工具 | 测试内容 | 优先级 |
|-----|---------|-------|
| browser | 浏览器自动化工具的 mock 测试 | P1 |
| message | 消息队列工具的 mock 测试 | P1 |

### 3.2 统一集成测试模式

参考 `tests/src/tools/integration.test.ts` 的模式：
- 使用真实 LLM API
- 临时工作目录
- 测试前后清理

需要为以下工具添加集成测试：
- Bash 工具集成测试
- Web 工具集成测试
- Session 工具集成测试

### 3.3 覆盖率目标

建立 80% 覆盖率目标：
- 配置 vitest coverage
- 添加覆盖率检查到 CI
- 定期检查覆盖率变化

---

## 4. 期望结果

| 交付物 | 描述 |
|-------|------|
| browser.test.ts | 浏览器工具单元测试 |
| message.test.ts | 消息工具单元测试 |
| bash/integration.test.ts | Bash 工具集成测试 |
| web/integration.test.ts | Web 工具集成测试 |
| coverage.config.ts | 覆盖率配置 |

---

## 5. 约束条件

- 单元测试使用 mock，不调用真实 API
- 集成测试使用真实 LLM API（需要有效 API Key）
- 测试需要隔离，避免相互影响

---

## 6. 优先级

| 优先级 | 任务 | 原因 |
|-------|------|------|
| P0 | 修复 coverage 依赖 | 当前无法运行覆盖率 |
| P1 | 补充 browser/message 单元测试 | 完善测试覆盖 |
| P2 | 添加集成测试 | 验证工具真实协作 |
| P3 | 配置 CI 覆盖率检查 | 质量保证 |

---

## 7. 下一步

确认需求后开始实施。
