# 实施文档：Tool-use 前端渲染问题 - 方案 A

## 概述

重构前后端职责边界，实现后端闭环：后端控制工具执行事件的发送，前端只负责展示。

---

## 改动文件

### 1. src/agents/loop.ts

**新增配置项**
```typescript
// 新增接口
export interface SseEvent {
  type: 'status' | 'tool' | 'response' | 'complete' | 'error';
  [key: string]: any;
}

// 在 AgentLoopConfig 中新增
onSseWrite?: (event: SseEvent) => void;
```

**构造函数更新**
```typescript
this.config = {
  // ... 其他配置
  onSseWrite: config.onSseWrite ?? (() => {}),
};
```

**工具执行时发送 SSE 事件**
```typescript
// 工具开始执行
this.config.onSseWrite({
  type: 'tool',
  tool: toolCall.name,
  status: 'start',
  input: toolCall.input,
  tool_call_id: toolCall.id,
});

// 工具执行完成
this.config.onSseWrite({
  type: 'tool',
  tool: toolCall.name,
  status: 'complete',
  output: result.output,
  isError: result.isError,
  duration: toolDuration,
  tool_call_id: toolCall.id,
});
```

---

### 2. src/api/routes/chat.ts

**传递 SSE 回调**
```typescript
const agent = new AgentLoop({
  // ... 其他配置
  onSseWrite: (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  },
});
```

**广播模式同样处理**
```typescript
const agent = new AgentLoop({
  // ... 其他配置
  onSseWrite: (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  },
});
```

---

### 3. ui/src/components/chat/ChatPanel.tsx

**新增 tool 事件处理**
```typescript
case 'tool':
  // 后端发送的工具执行事件
  setExecutionSteps((prev) => {
    if (event.status === 'start') {
      // 添加新步骤
    } else if (event.status === 'complete') {
      // 更新完成状态
    } else if (event.status === 'rejected') {
      // 工具被拒绝
    }
  });
  break;
```

**移除 response 解析逻辑**
- 移除解析 JSON 中 tool_calls 的代码
- 直接显示 finalResponse，不再做特殊处理

---

## 测试结果

- 后端启动正常 ✅
- 前端启动正常 ✅
- TypeScript 编译通过 ✅

---

## 后续待处理

- [ ] 删除 VoiceChat.tsx（用户暂停中）
