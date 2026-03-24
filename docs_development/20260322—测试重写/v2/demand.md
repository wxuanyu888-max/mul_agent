# 需求文档：测试重写 V2 - 真实 LLM API 集成测试

> 创建时间：2026-03-22
> 版本：v2

---

## 1. 需求背景

V1 完成的测试全部使用 mock，不调用真实 LLM API。

需要补充**真正调用 LLM API 的集成测试**，验证：
- Agent 完整循环能否正常工作
- 工具执行是否成功
- LLM + Tools 协作是否正常

---

## 2. 详细需求

### 2.1 真实 LLM API 集成测试

| 测试场景 | 描述 |
|---------|------|
| `agent-run-real-api` | 创建 AgentLoop，调用真实 LLM API，验证能正常返回 |
| `tool-execution-real` | LLM 返回工具调用，验证工具真正执行并返回结果 |
| `multi-turn-conversation` | 多轮对话，验证上下文传递 |

### 2.2 测试环境

- 使用项目配置的 LLM（.env 中的 API Key）
- 使用真实的工具（file read/write 等）
- 临时工作目录，避免污染

### 2.3 测试隔离

- 每个测试前后清理临时文件
- 使用独立的 sessionId 避免冲突

---

## 3. 期望结果

| 测试名称 | 输入 | 期望输出 |
|---------|------|---------|
| `real-api-call` | `loop.run({message:'Say hello'})` | success=true, content非空 |
| `real-tool-execution` | `loop.run({message:'Read package.json'})` | 工具被执行，返回文件内容 |
| `real-error-handling` | 发送无效请求 | 正确抛出错误 |

---

## 4. 约束条件

- 需要有效的 LLM API Key（在 .env 中配置）
- 测试可能较慢（网络调用）
- 需要处理 API 限流

---

## 5. 优先级

| 优先级 | 测试 | 原因 |
|-------|------|------|
| P0 | 真实 LLM API 调用 | 核心功能验证 |
| P1 | 真实工具执行 | 验证工具链 |
| P2 | 多轮对话 | 可选 |

---

## 6. 下一步

等待 v1 review 完成后开始 v2 开发。
