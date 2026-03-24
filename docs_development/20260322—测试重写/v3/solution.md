# 实施文档：测试重写 V3

> 创建时间：2026-03-23
> 版本：v3

---

## 1. 概述

V3 完成了以下任务：
1. 修复 vitest coverage 依赖版本问题
2. 补充缺失的 browser 和 message 工具单元测试
3. 添加 Bash、Web、Session 工具集成测试
4. 验证覆盖率功能正常工作

---

## 2. 完成的交付物

### 2.1 修复 Coverage 依赖

**问题**: `@vitest/coverage-v8` 与 `vitest@3.2.4` 版本不兼容

**解决方案**:
```bash
pnpm add -D -w @vitest/coverage-v8@3
```

**验证**:
```bash
pnpm vitest run tests/src/tools/types.test.ts --coverage
# ✅ 覆盖率功能正常工作
```

### 2.2 新增单元测试

#### Browser 工具测试
- 文件: `tests/src/tools/browser/index.test.ts`
- 测试数: 9 个
- 覆盖率: 63.76%

```typescript
// 主要测试内容
- 工具定义验证
- 参数模式验证
- list 动作测试
- 参数验证测试
```

#### Message 工具测试
- 文件: `tests/src/tools/message/index.test.ts`
- 测试数: 7 个
- 覆盖率: 92%

```typescript
// 主要测试内容
- 工具定义验证
- send/react/reply 动作测试
- 参数验证测试
```

### 2.3 新增集成测试

#### Bash 集成测试
- 文件: `tests/src/tools/bash/integration.test.ts`
- 使用真实 LLM API
- 测试 exec 命令执行

#### Web 集成测试
- 文件: `tests/src/tools/web/integration.test.ts`
- 使用真实 LLM API
- 测试 web_search/web_fetch

#### Session 集成测试
- 文件: `tests/src/tools/session/integration.test.ts`
- 使用真实 LLM API
- 测试 session_list/session_send

---

## 3. 覆盖率报告

运行覆盖率命令：
```bash
pnpm vitest run tests/src/tools/browser/ tests/src/tools/message/ --coverage
```

结果：
```
File           | % Stmts | % Branch | % Funcs | % Lines
---------------|---------|----------|---------|---------
tools/browser  |   63.76 |    56.25 |      80 |   63.76
 tools/message  |      92 |    66.66 |     100 |      92
```

---

## 4. 文件清单

### 新增文件

| 文件 | 描述 |
|-----|------|
| `tests/src/tools/browser/index.test.ts` | Browser 工具单元测试 |
| `tests/src/tools/message/index.test.ts` | Message 工具单元测试 |
| `tests/src/tools/bash/integration.test.ts` | Bash 工具集成测试 |
| `tests/src/tools/web/integration.test.ts` | Web 工具集成测试 |
| `tests/src/tools/session/integration.test.ts` | Session 工具集成测试 |
| `docs_development/20260322—测试重写/v3/demand.md` | 需求文档 |
| `docs_development/20260322—测试重写/v3/solution.md` | 实施文档 |

---

## 5. 运行测试

### 单元测试
```bash
pnpm vitest run tests/src/tools/browser/
pnpm vitest run tests/src/tools/message/
```

### 集成测试（需要真实 LLM API）
```bash
pnpm vitest run tests/src/tools/bash/integration.test.ts
pnpm vitest run tests/src/tools/web/integration.test.ts
pnpm vitest run tests/src/tools/session/integration.test.ts
```

### 覆盖率
```bash
pnpm test:coverage
```

---

## 6. 下一步

- 考虑将集成测试移到专门的目录（如 `tests/integration/tools/`）
- 为其他工具（media, teammate）添加更多集成测试
- 配置 CI 自动运行覆盖率检查
