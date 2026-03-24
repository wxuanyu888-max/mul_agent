# 任务拆分：压缩上下文优化

## 需求概述

修复压缩上下文时把用户当前需求也压缩的问题。压缩时应该只压缩历史上下文，保留用户最近的需求。

## 任务列表

### T1: 分析现有压缩逻辑
- [x] 分析 compaction.ts 中的 autoCompact 函数
- [x] 分析 context-engine/strategies.ts 中的 AutoCompactStrategy
- [x] 确定问题根因：压缩时把所有消息都摘要了

### T2: 添加配置项
- [x] 在 CompactionConfig 添加 keepRecentUserMessages 字段
- [x] 设置默认值 2（保留最近 2 条用户消息）

### T3: 修改 autoCompact 函数
- [x] 实现保留用户最近消息的逻辑
- [x] 只对历史消息进行 LLM 摘要
- [x] 压缩后消息结构：系统消息 → 历史摘要 → 用户最近消息 → 确认消息

### T4: 修改 context-engine 策略
- [x] 在 types.ts 添加配置类型
- [x] 在 strategies.ts 修改 AutoCompactStrategy

### T5: 验证
- [x] TypeScript 类型检查通过
- [ ] 用户测试验证

## 文件位置

| 文件 | 改动类型 |
|------|----------|
| src/agents/compaction.ts | 修改 |
| src/agents/context-engine/types.ts | 修改 |
| src/agents/context-engine/strategies.ts | 修改 |

## 依赖关系

T1 → T2 → T3 → T4 → T5（串行）

## 风险

- 改动影响 autoCompact 核心逻辑，需测试验证
- 需要确认用户消息的识别逻辑是否正确（role === 'user'）
