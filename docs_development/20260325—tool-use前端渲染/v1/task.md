# 任务拆分：Tool-use 前端渲染问题 - 方案 A

## 目标
后端闭环：后端发送专门的 `tool` 事件给前端，前端只负责展示。

---

## 任务列表

### 阶段 1：后端改造

#### Task 1: 扩展 AgentLoop 支持 SSE 回调
- **文件**: [loop.ts](src/agents/loop.ts)
- **内容**:
  - 在 AgentLoop 构造函数中添加 SSE writer 回调参数
  - 在工具执行时调用 SSE 发送 `tool` 事件
  - 事件格式: `{ type: 'tool', tool: string, status: 'start'|'complete', input?: any, output?: any, duration?: number }`

#### Task 2: 修改 chat.ts 使用新的 SSE 回调
- **文件**: [chat.ts](src/api/routes/chat.ts)
- **内容**:
  - 创建 SSE writer 函数传递给 AgentLoop
  - 确保 tool 事件能正确发送到前端

---

### 阶段 2：前端改造

#### Task 3: 简化前端 SSE 解析
- **文件**: [ChatPanel.tsx](ui/src/components/chat/ChatPanel.tsx)
- **内容**:
  - 添加新的 `tool` 事件类型解析
  - 简化 executionSteps 的渲染逻辑（不再解析 JSON）
  - 移除解析 response 中 tool_calls 的代码

#### Task 4: 清理不需要的代码
- **文件**: [ChatPanel.tsx](ui/src/components/chat/ChatPanel.tsx)
- **内容**:
  - 移除 `stepStartTimes` 相关逻辑（后端计算 duration）
  - 移除 `ExecutionStepItem` 中手动判断 tool 的逻辑

---

### 阶段 3：测试

#### Task 5: 手动测试
- 启动后端和前端
- 发送消息触发工具执行
- 验证 tool 事件正确显示
- 验证 response 中不再显示原始 JSON

---

## 依赖关系

```
Task 1 ──┬──> Task 3 ──> Task 5
        │                ↑
Task 2 ──┘                │
                          │
        <── Task 4 ───────┘
```

## 文件位置

| 任务 | 文件 |
|------|------|
| Task 1 | src/agents/loop.ts |
| Task 2 | src/api/routes/chat.ts |
| Task 3 | ui/src/components/chat/ChatPanel.tsx |
| Task 4 | ui/src/components/chat/ChatPanel.tsx |
| Task 5 | - |