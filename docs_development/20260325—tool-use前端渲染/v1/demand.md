# 需求文档：Tool-use 前端渲染问题

## 需求背景（更新）

当前架构存在职责混乱：后端把原始 tool_use 数据发送给前端，让前端负责解析、组装、渲染，这是不合理的。

## 问题描述

### 当前错误架构
1. 后端 `AgentLoop` 执行 tool_use 和 tool_result
2. 后端通过 SSE 发送原始数据（包含 JSON 格式的 tool_calls）
3. 前端被迫解析这些数据，计算执行时间，组装渲染逻辑
4. 前端有时候把原始 JSON 显示给用户

### 正确架构应该是
**后端闭环**：
- 后端负责执行工具
- 后端控制是否需要发送工具执行事件给前端
- 只发送**用户应该看到的内容**

**前端职责**：
- 展示后端发送的消息
- 可选：根据后端的 `tool` 事件显示工具执行通知（由后端控制）

### 当前架构（后端）

1. `AgentLoop.run()` 执行后会返回：
   - `content`: 最终响应文本
   - `messages`: 完整消息历史（包含 tool_use, tool_result）
   - `toolCalls`: 工具调用次数

2. 后端 SSE 发送的事件：
   - `status`: 初始化、执行中等状态
   - `response`: 最终内容 (`result.content`)
   - `complete`: 完成
   - `error`: 错误

3. **问题**：后端发送的 `response` 事件有时候包含原始 JSON（包含 tool_calls）

### 相关代码位置
- **后端返回结果**: [loop.ts:586-693](src/agents/loop.ts#L586-L693) - `run()` 方法返回
- **后端 SSE 发送**: [chat.ts:482](src/api/routes/chat.ts#L482) - 发送 response
- **前端 SSE 解析**: [ChatPanel.tsx:723-753](ui/src/components/chat/ChatPanel.tsx#L723-L753) - 解析 tool_calls

### 期望结果
1. 明确后端和前端的职责边界
2. 后端只发送需要展示给用户的内容
3. 前端不再需要解析和组装 tool_use 数据
4. 简化前端渲染逻辑

### 约束条件
- 保持 SSE 实时性
- 不破坏现有功能
- 保持用户能看到工具执行的基本反馈（可选）

---

## 确认方案：方案 A - 后端闭环

后端控制是否发送工具执行事件，前端只负责展示后端发送的内容。
