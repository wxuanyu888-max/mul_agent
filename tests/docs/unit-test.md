# 测试文档

## 测试目标

验证 src 模块是否符合实际用法，包括：
1. **Tools** - 工具元数据正确，能正常执行
2. **Commands** - 命令注册、解析、执行正常
3. **Hooks** - 钩子注册、触发、执行正常

## 运行测试

```bash
# 进入项目目录
cd D:/Resource/200-项目/220-计算机/220-005-mul_agent/mul-agent-main

# 安装依赖（如未安装）
npm install

# 运行所有测试
npm test

# 运行特定模块测试
npm test -- tests/src/tools/
npm test -- tests/src/commands/
npm test -- tests/src/hooks/
```

---

## 测试文件清单

### Tools 模块

| 测试文件 | 测试工具 | 状态 |
|---------|---------|------|
| `src/tools/types.test.ts` | jsonResult, errorResult | ✅ |
| `src/tools/file/index.test.ts` | read, write, ls, grep | ✅ |
| `src/tools/bash/index.test.ts` | exec, process | ✅ |
| `src/tools/web/index.test.ts` | search, fetch | ✅ |
| `src/tools/memory/index.test.ts` | search, get | ✅ |
| `src/tools/session/index.test.ts` | list, history, send, spawn, status | ✅ |
| `src/tools/system/index.test.ts` | cron, gateway, subagents, agents_list | ✅ |
| `src/tools/media/index.test.ts` | browser, canvas, nodes, tts, image, pdf | ✅ |

### Commands 模块

| 测试文件 | 测试内容 | 状态 |
|---------|---------|------|
| `src/commands/registry.test.ts` | 命令注册、解析、注销 | ✅ |
| `src/commands/executor.test.ts` | 命令执行、帮助文本 | ✅ |
| `src/commands/predefined.test.ts` | 预定义命令工厂 | ✅ |

### Hooks 模块

| 测试文件 | 测试内容 | 状态 |
|---------|---------|------|
| `src/hooks/registry.test.ts` | 钩子注册、注销、优先级 | ✅ |
| `src/hooks/executor.test.ts` | 钩子触发、错误处理 | ✅ |
| `src/hooks/predefined.test.ts` | 预定义钩子工厂 | ✅ |

### CLI 模块

| 测试文件 | 测试内容 | 状态 |
|---------|---------|------|
| `src/cli/registry.test.ts` | 命令注册、别名、注销 | ✅ |
| `src/cli/executor.test.ts` | 命令执行、帮助打印 | ✅ |
| `src/cli/argv.test.ts` | 参数解析、验证、默认值 | ✅ |
| `src/cli/commands.test.ts` | 预定义命令工厂 | ✅ |

---

## 模块测试详情

### 1. Tools 模块

#### 1.1 File Tools

| 工具 | 测试内容 | 期待结果 |
|------|---------|---------|
| **read** | 元数据 | label: "Read", name: "read", required: ["path"] |
| | 读取文件 | 返回文件内容，无 error |
| | 读取行范围 | from=2, lines=2 返回第2-3行 |
| | 文件不存在 | 返回 error |
| **write** | 元数据 | required: ["path", "content"] |
| | 写入文件 | 文件内容正确写入 |
| **ls** | 列出目录 | 返回目录内容 |
| **grep** | 搜索模式 | 返回匹配结果 |

#### 调用示例

```typescript
import { createReadTool } from '../../../src/tools/file/index.js';

const readTool = createReadTool();
const result = await readTool.execute("call-1", { path: "/test/file.txt" });
console.log(result.content); // 文件内容
console.log(result.error);   // undefined 或错误信息
```

#### 1.2 Bash Tools

| 工具 | 测试内容 | 期待结果 |
|------|---------|---------|
| **exec** | 元数据 | label: "Exec", name: "exec" |
| | 执行命令 | 返回 stdout，无 error |
| | 超时处理 | 返回 timedOut: true |
| **process** | 元数据 | 有 action 参数 |

#### 1.3 Web Tools

| 工具 | 测试内容 | 期待结果 |
|------|---------|---------|
| **web_search** | 元数据 | name: "web_search", required: ["query"] |
| | 执行搜索 | 返回 results 数组 |
| **web_fetch** | 元数据 | name: "web_fetch", required: ["url"] |

---

### 2. Commands 模块

#### 测试文件: `tests/src/commands/`

##### CommandRegistry

| 功能 | 测试内容 | 期待结果 |
|------|---------|---------|
| **register** | 注册命令 | getCommand 返回正确定义 |
| | 注册别名 | textAliases 正确映射 |
| **unregister** | 注销命令 | 命令和处理器都被移除 |
| **resolveTextCommand** | 解析命令 | /test → { key: "test" } |
| | 解析参数 | /test arg → { key: "test", args: "arg" } |
| | 大小写不敏感 | /TEST → { key: "test" } |
| **parseArgs** | 位置参数 | "John Mr" → { name: "John", title: "Mr" } |
| | 原始字符串 | argsParsing: "none" 返回 raw |
| **buildDetection** | 构建检测器 | exact 和 regex 正确 |

##### CommandExecutor

| 功能 | 测试内容 | 期待结果 |
|------|---------|---------|
| **execute** | 执行命令 | handler 被调用，返回 reply |
| | 非命令文本 | shouldContinue: true |
| | 未知命令 | shouldContinue: true |
| | 错误处理 | 返回错误消息 |
| **listCommands** | 列出所有命令 | 返回命令数组 |
| **getHelpText** | 获取帮助 | 返回格式化的帮助文本 |

##### Predefined Commands

| 工厂函数 | 测试内容 | 期待结果 |
|---------|---------|---------|
| **createCommandHandler** | 创建处理器 | 返回 definition 和 handler |
| | 自定义别名 | aliases 选项生效 |
| **createHelpCommand** | 帮助命令 | 返回命令列表 |
| **createStatusCommand** | 状态命令 | 返回状态 JSON |
| **createMemoryCommand** | 记忆命令 | 调用 recallFn |
| **createHistoryCommand** | 历史命令 | 调用 getHistory |
| **createSkillsCommand** | 技能命令 | 返回技能列表 |
| **createResetCommand** | 重置命令 | 调用 resetFn |
| **createStopCommand** | 停止命令 | 调用 stopFn |

#### 调用示例

```typescript
import { CommandRegistry, CommandExecutor } from '../../../src/commands/index.js';
import { createHelpCommand } from '../../../src/commands/predefined.js';

// 创建注册表
const registry = new CommandRegistry();
const executor = new CommandExecutor({ registry });

// 注册命令
const { definition, handler } = createHelpCommand(() => [
  { key: "help", description: "Show help", textAliases: ["/help"] }
]);
registry.register(definition, handler);

// 执行命令
const result = await executor.execute({ sessionId: "test" }, "/help");
console.log(result.reply?.text); // 帮助文本
```

---

### 3. Hooks 模块

#### 测试文件: `tests/src/hooks/`

##### HookRegistry

| 功能 | 测试内容 | 期待结果 |
|------|---------|---------|
| **register** | 注册钩子 | getHandlers 返回处理器 |
| | 多个处理器 | 同一事件可注册多个 |
| | 优先级排序 | 高优先级在前 |
| **unregister** | 注销钩子 | 特定处理器被移除 |
| **getHandlers** | 获取处理器 | 返回处理器数组 |
| | 未注册事件 | 返回空数组 |
| **getEventTypes** | 获取事件类型 | 返回所有事件类型 |
| **clear** | 清空所有 | 所有处理器被移除 |
| **clearEvent** | 清空事件 | 特定事件被清空 |
| **hasHandlers** | 检查处理器 | 返回布尔值 |

##### HookExecutor

| 功能 | 测试内容 | 期待结果 |
|------|---------|---------|
| **emit** | 触发事件 | 所有处理器被调用 |
| | 禁用处理器 | enabled: false 不调用 |
| | 优先级顺序 | 高优先级先执行 |
| | 错误继续 | continueOnError: true 继续执行 |
| | 错误停止 | continueOnError: false 抛出异常 |
| | 无处理器 | 不抛异常 |
| | 时间戳 | 自动添加 timestamp |
| | 上下文合并 | 传入上下文合并到默认值 |
| **withContext** | 预设上下文 | 创建带上下文的执行器 |

##### Predefined Hooks

| 工厂函数 | 测试内容 | 期待结果 |
|---------|---------|---------|
| **createHookHandler** | 创建钩子 | 返回 HookHandler |
| | 自定义优先级 | priority 选项生效 |
| **createLoggingHook** | 日志钩子 | priority: -100 |
| **createMetricsHook** | 指标钩子 | priority: -200 |
| **createErrorHandlerHook** | 错误钩子 | event: "agent.error", priority: 100 |
| **createSessionStartHook** | 会话开始 | event: "session.start" |
| **createSessionEndHook** | 会话结束 | event: "session.end" |
| **createMessageReceivedHook** | 消息接收 | event: "message.received" |
| **createBeforeToolHook** | 工具前 | event: "tool.before_call" |
| **createAfterToolHook** | 工具后 | event: "tool.after_call" |

#### 调用示例

```typescript
import { HookRegistry, HookExecutor } from '../../../src/hooks/index.js';
import { createLoggingHook, createSessionStartHook } from '../../../src/hooks/predefined.js';

// 创建注册表和执行器
const registry = new HookRegistry();
const executor = new HookExecutor({ registry });

// 注册钩子
registry.register(createLoggingHook("session.start"));
registry.register(createSessionStartHook(async (sessionId, userId) => {
  console.log(`Session ${sessionId} started by ${userId}`);
}));

// 触发事件
await executor.emit("session.start", {
  sessionId: "session-123",
  userId: "user-456"
});
```

---

## 期待结果汇总

### ✅ 成功标志

1. **元数据正确**
   - label, name, description 都有值
   - parameters 是有效的 JSON Schema
   - required 数组包含必要参数

2. **执行成功**
   - error 字段为 undefined
   - content 字段包含预期数据

3. **错误处理**
   - 无效输入返回有意义的 error 消息
   - 异常情况不崩溃

### ❌ 失败标志

1. 元数据缺失或错误
2. execute 方法抛出异常
3. 返回的 error 不符合预期格式

---

## 后续测试计划

1. **集成测试** - 测试 LLM 调用工具的完整流程
2. **E2E 测试** - 端到端用户场景
3. **性能测试** - 工具执行时间、并发能力
