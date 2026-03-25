# 实施过程

## 实现步骤

### 1. 检查工具异常情况

首先搜索项目中所有使用 `throw` 的工具文件：

```bash
grep -r "^\s*throw " src/tools/
```

**结果**:
- `src/tools/media/asr.ts` - ASR 服务类（内部实现，不是工具）
- `src/tools/browser/mcp.ts` - Browser MCP 工具

### 2. 修改 Agent 循环 (loop.ts)

**核心逻辑**: 在 LLM 调用时添加重试和错误处理机制

```typescript
// === 调用 LLM（带错误处理，保证 Agent 持续运行）===
let response: LLMResponse | null = null;
let llmError: Error | null = null;
const maxRetries = 3;
let retryCount = 0;

while (retryCount < maxRetries) {
  try {
    response = await llm.chat({
      model: (llm as any).model,
      messages: toLLMMessages(messages),
      system: systemPrompt,
      tools: tools && tools.length > 0 ? tools : undefined,
    });
    llmError = null;
    break;
  } catch (error) {
    llmError = error instanceof Error ? error : new Error(String(error));
    retryCount++;
    console.error(`[LLM] Call failed (attempt ${retryCount}/${maxRetries}): ${llmError.message}`);
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

if (llmError || !response) {
  // LLM 调用全部失败，记录错误但继续循环
  messages.push({
    role: 'user',
    content: `<system_error>\nLLM call failed: ${llmError?.message || 'Unknown error'}\nPlease try a different approach or provide guidance.</system_error>`,
  });
  messages.push({
    role: 'assistant',
    content: 'I encountered an issue with the LLM service. Let me try an alternative approach.',
  });
  continue;
}
```

### 3. 修复 Browser MCP 工具

**文件**: `src/tools/browser/mcp.ts`

```typescript
async function callMcpTool(toolName: string, args: Record<string, unknown>, retry = true): Promise<any> {
  try {
    const client = await getMcpClient();
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    return result;
  } catch (error) {
    if (retry && error instanceof Error && error.message.includes('connection')) {
      console.log('[Browser MCP] Connection error, resetting and retrying...');
      resetMcpClient();
      return callMcpTool(toolName, args, false);
    }
    // 返回错误信息而不是抛出
    return { error: error instanceof Error ? error.message : String(error), isError: true };
  }
}
```

外层的 `execute` 函数已有 try-catch，会将错误转换为 `errorResult`。

### 4. 修复 Voice API

**文件**: `src/api/routes/voice.ts`

```typescript
// 识别
let result;
try {
  result = await asrService.recognize(audioBuffer);
} catch (err) {
  return res.status(500).json({
    error: `ASR recognition failed: ${err instanceof Error ? err.message : String(err)}`,
    details: 'Please check your audio format or try a different ASR provider'
  });
}
```

### 5. 验证

运行类型检查：

```bash
pnpm typecheck
# ✅ 通过
```

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/agents/loop.ts` | 添加 LLM 重试机制和错误处理 |
| `src/tools/browser/mcp.ts` | 返回错误对象而不是抛出异常 |
| `src/api/routes/voice.ts` | 添加 ASR 调用的 try-catch |

## 测试方案

1. **LLM 调用失败测试**: 模拟网络错误，验证 Agent 继续运行
2. **工具执行失败测试**: 使用不存在的工具，验证返回错误结果
3. **集成测试**: 运行完整 Agent 循环，验证错误处理正确

## 注意事项

- ASR 服务内部的 throw 是服务类实现，被 API 路由捕获，不影响 Agent
- 大多数工具已使用 `errorResult()` 返回错误，本次只需修复少数几个
- 类型检查必须通过才能提交