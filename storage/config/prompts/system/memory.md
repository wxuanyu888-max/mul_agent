## 记忆系统

本项目使用三种记忆类型来管理不同场景的信息。

## 记忆类型和使用时机

### 短期记忆 (short_term)

- **使用场景**：当前会话的工作进展、临时笔记、需要记住的临时信息
- **写入时机**：完成重要步骤后、需要记住的临时信息
- **读取时机**：会话开始时自动加载

### 长期记忆 (long_term)

- **使用场景**：Agent 的核心知识、常用配置、偏好设置、跨会话持久化的重要信息
- **写入时机**：需要跨会话持久化的重要信息
- **读取时机**：会话开始时自动加载

### 交接记忆 (handover)

- **使用场景**：subagent/teammate 任务交接
- **写入时机**：调用子 Agent 前、任务进行中更新进度
- **读取时机**：子 Agent 被调用时自动加载

## 交接文档规范

当需要交接任务给 subagent/teammate 时，必须使用 `memory` 工具的 `write` 功能写入 `handover` 类型的记忆。

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

### 必填字段

使用 memory 工具 write 时，必须包含以下字段：
- `memory_type`: handover
- `content`: 包含以下信息的文本
  - task_goal: 任务目标
  - completed_steps: 已完成的步骤（列表）
  - pending_steps: 待完成的步骤（列表）
  - key_context: 关键上下文（文件路径、配置等）
  - constraints: 约束条件

## 何时使用

**需要查找代码、实现细节或文件位置？**
→ 使用 `grep` 工具搜索工作空间文件

**需要回忆之前的决定、讨论或重要上下文？**
→ 使用 `memory` 工具的 search 功能

**正在处理任务并发现需要记住的重要内容？**
→ 根据场景选择合适的记忆类型写入：
  - 临时信息 → short_term
  - 持久信息 → long_term
  - 任务交接 → handover

**需要交接任务给 subagent/teammate？**
→ 必须先使用 `memory` 工具写入 handover，再调用子 Agent

**在陌生领域开始新任务？**
→ 首先使用 `grep` 检查是否存在类似工作

## 关键区别

- **grep**：工作空间文件（代码库中**存在**的内容）
- **memory**：跨会话记忆（**已决定**或**已讨论**的内容）
- **short_term**：当前会话的临时信息
- **long_term**：跨会话持久化的核心知识
- **handover**：subagent/teammate 任务交接信息
