# 实施逻辑 - Agent Team 下拉框支持

## 实现细节

### 1. 后端 API 返回 teammates 列表

**文件**: `src/api/routes/info.ts`

```typescript
// GET /info/agent-team - 从 config.json 加载 teammates
router.get('/info/agent-team', (req: Request, res: Response) => {
  const configPath = path.join(process.cwd(), 'storage', 'teammates', 'config.json');
  let teammatesAgents = [];

  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    teammatesAgents = configData.teammates.map(t => ({
      agent_id: t.name,
      name: t.name,
      description: t.role,
      role: t.role,
      status: t.status.toLowerCase(),
    }));
  }

  // Core Brain 始终显示
  const coreAgent = {
    agent_id: 'core_brain',
    name: 'Core Brain',
    description: 'Central Coordinator',
    role: 'coordinator',
    status: 'idle',
  };

  res.json({ agents: [coreAgent, ...teammatesAgents] });
});
```

### 2. Chat API 传递 extraSystemPrompt

**文件**: `src/api/routes/chat.ts`

```typescript
// 根据 agent_id 获取 extraSystemPrompt
const teammates = listTeammates();
const targetTeammate = teammates.find(t => t.name === agent_id);
const extraSystemPrompt = targetTeammate?.prompt || '';

const agent = new AgentLoop({
  maxIterations: 50,
  workspaceDir: process.cwd(),
  sessionId: session_id,
  promptMode: 'full',
  extraSystemPrompt,  // 传入角色 prompt
  // ...
});
```

### 3. Prompt 模板添加占位符

**文件**: `storage/config/prompts/templates/full.md`

```markdown
# 基础身份

{{base}}

# 自定义角色
{{extra}}

# 工具箱
```

---

## 测试验证

1. 选择 Alex → 问 "你是谁" → 回答 "我是 Alex，全栈开发工程师"
2. 选择 Bella → 问 "你是谁" → 回答 "我是 Bella，代码审核专家"
3. 选择 Core Brain → 正常回答
