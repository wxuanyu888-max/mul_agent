# 实施文档：Agent Thinking 模式

## 修改文件

### 1. storage/config/prompts/system/tool-call-style.md

添加思考引导，要求模型在输出前先进行思考：

```markdown
## 思考后行动

在生成任何输出（包括工具调用和文本回复）之前，你必须先进行思考：

### 思考框架

1. **分析当前状态** - 用户意图是什么？当前对话上下文是什么？
2. **制定行动计划** - 需要采取什么步骤？优先级如何？
3. **预判结果** - 工具调用后会发生什么？是否有风险？
4. **确认最优方案** - 有没有更简单的实现方式？

### 思考输出格式

将你的思考过程用 <thinking></thinking> 标签包裹
```

### 2. storage/config/config.json

添加 thinking 配置：

```json
"thinking": {
  "enabled": true,
  "budget_tokens": 4096
}
```

### 3. src/agents/config.ts

添加 thinking 相关函数：

- `getThinkingConfig()` - 获取 thinking 配置
- `isThinkingEnabled()` - 判断是否启用

### 4. src/agents/llm.ts

在 LLM 请求中传递 thinking 参数：

- 添加 `thinking` 字段到 `LLMRequest` 接口
- 如果请求未指定 thinking，使用全局配置

## 测试验证

测试结果：
- 响应包含 `thinking` 类型内容块
- Thinking 内容正确输出
- API 配置生效
