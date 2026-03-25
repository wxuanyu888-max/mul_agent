# 实施逻辑 - V2 All Agents 广播功能

## 实现细节

### 1. 前端下拉框

**文件**: `ui/src/components/chat/ChatPanel.tsx`

```tsx
<select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
  <option value="__all__">All Agents (广播)</option>
  <option value="core_brain">Core Brain</option>
  {agents.filter(a => a.agent_id !== 'core_brain').map((agent) => (
    <option key={agent.agent_id} value={agent.agent_id}>
      {agent.name}
    </option>
  ))}
</select>
```

### 2. 后端广播逻辑

**文件**: `src/api/routes/chat.ts`

```typescript
// 处理广播模式
if (agent_id === '__all__') {
  await handleBroadcastChat(req, res, message, session_id, teammates);
  return;
}

// handleBroadcastChat 使用 Promise.all 并行处理
const results = await Promise.all(
  teammates.map(async (teammate) => {
    const agent = new AgentLoop({
      extraSystemPrompt: teammate.prompt || '',
      // ...
    });
    const result = await agent.run({ message, history: historyMessages });
    return { name: teammate.name, response: result.content };
  })
);

// 分别返回每个 agent 的响应
for (const r of results) {
  res.write(`data: ${JSON.stringify({
    type: 'agent_response',
    agent_id: r.name,
    agent_name: r.name,
    response: r.response,
  })}\n\n`);
}
```

### 3. 前端处理 agent_response

**文件**: `ui/src/components/chat/ChatPanel.tsx`

```typescript
case 'agent_response':
  // 作为单独的消息显示，带有 agent 名字
  setMessages((prev) => [
    ...prev,
    {
      role: 'assistant',
      content: event.response,
      agentId: event.agent_id,
      agentName: event.agent_name,
      timestamp: Date.now(),
    },
  ]);
  break;
```

### 4. 消息显示（头像 + 名字标签）

```tsx
const isAgentResponse = !isUser && msg.agentName;

// 头像根据类型显示不同颜色和内容
{isAgentResponse ? (
  <span className="w-4 h-4 text-xs font-bold text-green-600">
    {msg.agentName?.charAt(0).toUpperCase()}
  </span>
) : (
  <Bot className="w-4 h-4 text-purple-600" />
)}

// 名字标签
{isAgentResponse && (
  <div className="text-xs font-medium text-green-600 mb-1">
    {msg.agentName}
  </div>
)}
```

### 5. Workflow 面板显示 agent 详细信息

**文件**: `src/api/routes/info.ts`

```typescript
// GET /info/agent/:agent_id/details
router.get('/info/agent/:agent_id/details', (req: Request, res: Response) => {
  const agent_id = req.params.agent_id as string;

  // 如果是 Core Brain，返回默认配置
  if (agent_id === 'core_brain') {
    res.json({
      agent_id,
      name: 'Core Brain',
      description: 'Central Coordinator',
      role: 'coordinator',
      soul: '你是中央协调者，负责协调多个 agent 完成复杂任务。',
      // ...
    });
    return;
  }

  // 从 teammates config.json 读取
  const configPath = path.join(process.cwd(), 'storage', 'teammates', 'config.json');
  const teammate = configData.teammates?.find((t) => t.name === agent_id);

  if (teammate) {
    res.json({
      agent_id: teammate.name,
      name: teammate.name,
      role: teammate.role || '',
      soul: teammate.prompt || '',  // 显示 agent 的 prompt 作为 soul
      // ...
    });
  }
});
```

---

## 测试验证

1. 选择 All Agents (广播) → 消息同时发送给 Alex, Bella, Chris
2. 每个 agent 的回复单独显示，带有绿色头像（首字母）+ 名字标签
3. 选择 Core Brain → 正常的单一回复
4. 选择单个 agent → 正常的单一回复
5. Workflow 面板显示 agent 的详细信息（soul/prompt, role）
