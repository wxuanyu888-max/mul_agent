# 实施逻辑：压缩上下文优化

## 问题分析

### 根因
原 `autoCompact` 函数在执行压缩时，会把所有消息都压缩成摘要，包括用户最近的消息（包含当前任务需求）。

### 关键代码位置
- `src/agents/compaction.ts` 第 204-316 行（修改前）
- `src/agents/context-engine/strategies.ts` 第 187-300 行（修改前）

## 解决方案

### 核心思路
在压缩前，先识别并保留用户最近的消息（包含当前需求），只对历史上下文进行 LLM 摘要。

### 实现步骤

#### 1. 添加配置项

**文件**: `src/agents/compaction.ts`
```typescript
export interface CompactionConfig {
  // ... 原有配置
  /** 保留最近 N 条用户消息（包含当前需求），不压缩 */
  keepRecentUserMessages?: number;
}

const DEFAULT_CONFIG = {
  // ... 原有配置
  keepRecentUserMessages: 2,
};
```

#### 2. 修改 autoCompact 逻辑

**核心改动**:
```typescript
// 1. 识别需要保留的用户消息
const keepRecentUserCount = cfg.keepRecentUserMessages ?? 2;
const recentUserIndices = new Set<number>();
let userCount = 0;
for (let i = messages.length - 1; i >= 0; i--) {
  if (messages[i].role === 'user') {
    if (userCount < keepRecentUserCount) {
      recentUserIndices.add(i);
      userCount++;
    }
  }
}

// 2. 分类消息
const messagesToCompress = messages.filter((_, i) => !recentUserIndices.has(i));
const messagesToPreserve = messages.filter((_, i) => recentUserIndices.has(i));

// 3. 只对历史消息做摘要
const summaryText = await llm.summarize(messagesToCompress);

// 4. 构建新消息列表
const compacted = [
  ...(preserveSystem ? systemMsgs : []),
  summaryMessage,  // 历史摘要
  ...messagesToPreserve,  // 用户最近消息
  confirmationMessage,
];
```

#### 3. 压缩后的消息结构

```
[System messages]           ← 保留
[Historical summary]         ← 只压缩这部分
[User message N-1]           ← 保留（用户历史消息）
[User message N]             ← 保留（当前需求）
[Assistant response]         ← 确认消息
```

## 测试方案

### 手动测试
1. 启动 agent，设置低阈值触发压缩
2. 发送多个用户消息
3. 触发压缩后，检查保留的消息是否包含用户当前需求

### 边界情况
- 消息数少于 keepRecentUserMessages：全部保留
- 只有 1 条用户消息：保留该消息
- 没有用户消息（纯系统对话）：正常压缩

## 回滚方案

如有问题，可回滚到上一提交：
```bash
git revert HEAD
```
