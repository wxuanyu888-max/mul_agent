# 集成测试报告

## 概述

本文档描述 Agent 核心模块的集成测试，覆盖 Session 管理、消息管理、工具执行和日志系统。

## 测试环境

- 测试框架: Vitest
- 测试类型: 集成测试
- 测试文件: `tests/integration/agent.test.ts`

## 运行测试

```bash
# 运行所有集成测试
npx vitest run tests/integration/agent.test.ts

# 运行并显示详细输出
npx vitest run tests/integration/agent.test.ts --reporter=verbose
```

## 测试用例

### 1. Session 管理 (Session Management)

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| should create a new session | 创建新 session，验证 ID 生成、初始状态、配置 | ✅ 通过 |
| should get session by id | 根据 ID 获取 session | ✅ 通过 |
| should update session status | 更新 session 状态 (active/idle/completed/error) | ✅ 通过 |

**测试覆盖**:
- `createSession()` - 创建新 session
- `getSession()` - 获取 session
- `updateSessionStatus()` - 更新状态

### 2. 消息管理 (Message Management)

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| should add message to session | 向 session 添加消息 | ✅ 通过 |
| should add multiple messages | 添加多条消息 | ✅ 通过 |
| should query session history | 查询 session 历史 | ✅ 通过 |

**测试覆盖**:
- `addMessage()` - 添加消息
- `querySessions()` - 查询会话列表

### 3. 工具执行 (Tool Execution)

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| should execute read tool | 执行文件读取工具 | ✅ 通过 |
| should execute ls tool | 执行目录列表工具 | ✅ 通过 |
| should execute exec tool | 执行 shell 命令工具 | ✅ 通过 |

**测试覆盖**:
- `createReadTool()` - 文件读取
- `createLsTool()` - 目录列表
- `createExecTool()` - Shell 命令执行

### 4. 日志系统 (Logger)

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| should create logger instance | 创建日志实例 | ✅ 通过 |
| should log errors | 记录错误日志 | ✅ 通过 |

**测试覆盖**:
- `getLogger()` - 获取日志实例
- `logger.info()` - 信息日志
- `logger.error()` - 错误日志

### 5. LLM 集成 (LLM Integration)

| 测试用例 | 描述 | 状态 |
|---------|------|------|
| should call LLM and get response | 调用 LLM 获取响应 | ⏭️ 跳过 |
| should complete tool call loop | 完整工具调用循环 | ⏭️ 跳过 |

**注意**: 这些测试需要 API key (ANTHROPIC_API_KEY 或 OPENAI_API_KEY)，默认跳过。

## 测试结果

```
✓ 11 passed | 2 skipped
```

## 依赖模块

测试依赖以下核心模块:

```
src/
├── session/          # Session 管理
│   ├── types.ts     # 类型定义
│   └── manager.ts   # 核心功能
├── tools/           # 工具系统
│   ├── file/       # 文件工具
│   ├── bash/       # Bash 工具
│   └── index.ts    # 统一导出
└── logger/         # 日志系统
    ├── types.ts    # 类型定义
    ├── manager.ts  # 核心功能
    └── llm.ts     # LLM 日志
```

## 扩展测试

如需添加更多测试:

1. **单元测试**: 在 `tests/src/` 目录添加
2. **E2E 测试**: 在 `tests/e2e/` 目录添加
3. **性能测试**: 在 `tests/performance/` 目录添加

## 注意事项

- Session 测试会自动清理测试数据
- 日志测试使用异步写入，不等待写入完成
- LLM 测试需要环境变量配置 API key
