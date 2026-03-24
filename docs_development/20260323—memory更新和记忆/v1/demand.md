# 需求文档：Memory 更新和记忆管理（交接文档系统）

## 需求背景

当前项目已有 Memory 索引系统，支持三种记忆类型：
- **短期记忆 (short_term)**：会话级
- **长期记忆 (long_term)**：持久化
- **交接记忆 (handover)**：Agent 间传递

但存在以下问题：
1. `handover` 记忆没有被真正使用
2. subagent/teammate 之间无法传递上下文
3. Session 按会话加载，Agent 按 ID 加载，两者没有关联

## 详细需求

### 1. 交接文档系统

当使用 subagent 或 teammate 协作时，需要自动生成交接文档，包含：
- 当前任务进度
- 已完成的步骤
- 待完成的事项
- 关键上下文信息

### 2. 记忆加载时机

| 记忆类型 | 加载时机 | 说明 |
|---------|---------|------|
| short_term | 会话开始（自动） | 当前会话的相关记忆 |
| long_term | 会话开始（自动） | Agent 的长期知识 |
| handover | Subagent/Teammate 调用时（自动） | 任务交接信息 |

### 3. 记忆更新时机

| 记忆类型 | 更新时机 | 触发方式 |
|---------|---------|---------|
| short_term | 有需要时 / 压缩前 | Agent 主动 / 系统强制 |
| long_term | 有需要时 / 压缩前 | Agent 主动 / 系统强制 |
| handover | 调用 subagent 前 / 任务进度变化时 | Agent 主动（在 tool description 中要求） |

### 4. 记忆更新机制

#### 4.1 Session 加载（默认）

- **short_term**：会话开始时自动加载
- **long_term**：会话开始时自动加载

#### 4.2 有需要时更新（Agent 主动）

Agent 根据任务需要主动更新记忆：
- 任务进度变化时
- 关键上下文变化时
- 需要传递给 subagent/teammate 时

#### 4.3 压缩/清退前强制更新

在上下文压缩或清退**之前**，系统自动触发记忆更新，确保重要信息不丢失：

- **short_term**：当前会话的重要信息（任务进度、已完成步骤）
- **long_term**：需要持久化的知识（项目结构、技术栈、规范）

### 5. 实现方案

#### 5.1 提示词更新（重点）

更新 `storage/config/prompts/system/memory.md`，添加：

```markdown
## 记忆类型和使用时机

### 短期记忆 (short_term)
- **使用场景**：当前会话的工作进展、临时笔记
- **写入时机**：完成重要步骤后、需要记住的临时信息
- **读取时机**：会话开始时自动加载

### 长期记忆 (long_term)
- **使用场景**：Agent 的核心知识、常用配置、偏好设置
- **写入时机**：需要跨会话持久化的重要信息
- **读取时机**：Agent 启动时自动加载

### 交接记忆 (handover)
- **使用场景**：subagent/teammate 任务交接
- **写入时机**：调用子 Agent 前、任务进行中更新进度
- **读取时机**：子 Agent 被调用时自动加载

## 交接文档规范

当需要交接任务给 subagent/teammate 时，必须写入 handover 记忆，包含：

### 任务交接模板
```
## 交接文档

### 任务来源
- 主 Agent：{agent_name}
- 原始需求：{user_request}

### 当前进度
- 已完成：{completed_steps}
- 进行中：{in_progress}
- 待完成：{pending_steps}

### 关键上下文
- {context_key_1}: {context_value_1}
- {context_key_2}: {context_value_2}

### 约束条件
- {constraint_1}
- {constraint_2}

### 验收标准
- {acceptance_criteria}
```

#### 5.1 Handover 在工具 description 中强制要求（重点）

在 subagent/teammate 调用的**工具 description** 中明确要求写入 handover：

##### task 工具 description (src/tools/task.ts)

```typescript
description: `Task management - Create and manage subtasks.

## 交接文档要求（必须遵守）
每次调用 task 工具前，必须使用 memory 工具写入 handover 类型的记忆，包含：
- task_goal: 任务目标
- completed_steps: 已完成的步骤（列表）
- pending_steps: 待完成的步骤（列表）
- key_context: 关键上下文（文件路径、配置等）
- constraints: 约束条件

请先写入 handover，再调用 task。
...`
```

##### teammate_spawn 工具 description (src/tools/teammate/spawn.ts)

```typescript
description: `Create a new teammate agent.

## 交接文档要求（必须遵守）
创建 teammate 前，必须使用 memory 工具写入 handover 类型的记忆，包含：
- task_goal: 任务目标
- completed_steps: 已完成的步骤
- pending_steps: 待完成的步骤
- key_context: 关键上下文

请先写入 handover，再创建 teammate。
...`
```

##### teammate_send 工具 description (src/tools/teammate/send.ts)

```typescript
description: `Send a message to a teammate.

## 交接文档要求（必须遵守）
发送消息前，如果涉及任务交接，必须写入 handover。
...`
```

#### 5.2 需要修改的文件

| 文件 | 改动 |
|------|------|
| [storage/config/prompts/system/memory.md](storage/config/prompts/system/memory.md) | 添加三种记忆类型说明 |
| [src/tools/task.ts](src/tools/task.ts) | 在 description 中添加 handover 要求 |
| [src/tools/teammate/spawn.ts](src/tools/teammate/spawn.ts) | 在 description 中添加 handover 要求 |
| [src/tools/teammate/send.ts](src/tools/teammate/send.ts) | 在 description 中添加 handover 要求 |
| [src/agents/compaction.ts](src/agents/compaction.ts) | 压缩前触发 short_term/long_term 更新 |
| [src/memory/persistence.ts](src/memory/persistence.ts) | 添加记忆更新方法 |

#### 5.3 预期效果

```
用户发起任务
    ↓
主 Agent 处理
    ↓
调用 Subagent/Teammate 前
    ↓
自动写入 handover 记忆（包含任务进度、上下文）
    ↓
提示词中包含 handover 记忆内容
    ↓
Subagent 读取 handover，理解任务
    ↓
完成后更新 handover
```

---

## 确认问题

1. **交接文档模板是否合适？**
2. **需要支持哪些触发时机？**（上面列出的 4 个是否完整）
3. **优先级？** P0/P1/P2
