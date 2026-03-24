# 任务拆分：Workflow增强 - Agent可视化监控

> 状态：需求讨论

---

## 任务概览

| 任务ID | 任务名称 | 优先级 | 状态 | 依赖 |
|--------|----------|--------|------|------|
| T1 | 分析后端API返回的Agent状态 | P0 | 待确认 | 无 |
| T2 | Agent节点状态实时显示 | P0 | 待实施 | T1 |
| T3 | 工具调用类型标签显示 | P0 | 待实施 | T1 |
| T4 | 交互详情面板优化 | P1 | 待实施 | 无 |
| T5 | 测试验证 | P0 | 待实施 | T2, T3 |

---

## 任务详情

### T1: 分析后端API返回的Agent状态

**需要确认的问题**：
1. 后端 `/api/v1/info/current-workflow` 返回什么状态字段？
2. Agent 的执行状态有哪些？用什么字段表示？
3. Tool 调用信息在哪个 API 返回？

**可能的数据结构**：
```typescript
// 预期后端返回
interface AgentStatus {
  agent_id: string;
  status: 'idle' | 'thinking' | 'executing' | 'completed' | 'error';
  current_task?: string;
  tool_calls?: Array<{
    tool: string;
    input: string;
    result: string;
  }>;
}
```

---

### T2: Agent节点状态实时显示

**当前状态**：节点只有静态颜色

**目标**：节点显示实时状态

**实现方案**：
1. 从 API 获取 Agent 状态
2. 更新节点 data 中的 status 字段
3. 节点颜色根据状态变化

**状态颜色映射**：
```typescript
const statusColors = {
  idle: 'bg-gray-400',
  thinking: 'bg-yellow-500 animate-pulse',
  executing: 'bg-green-500 animate-pulse',
  completed: 'bg-blue-500',
  error: 'bg-red-500',
};
```

---

### T3: 工具调用类型标签显示

**当前状态**：边只显示类型名称

**目标**：边的标签显示更清晰，工具调用时高亮

**实现方案**：
1. 边的 data 中添加 tool_name 字段
2. 工具类型使用不同颜色
3. 执行中的边添加动画效果

---

### T4: 交互详情面板优化

**当前状态**：已实现 InteractionHistoryModal

**优化方向**：
- 显示更多详细信息
- 添加时间线视图
- 支持查看完整的请求/响应

---

### T5: 测试验证

**测试用例**：
1. 发起一个任务，观察节点状态变化
2. 触发 Agent 执行工具，观察边的变化
3. 点击边查看交互详情

---

## 文件变更清单

| 文件 | 操作 | 修改点 |
|------|------|--------|
| `ui/src/components/workflow/WorkflowCanvas.tsx` | 修改 | Agent状态更新、边样式增强 |
| (可能需要) 后端API | 确认 | 返回状态字段 |

---

**创建时间**：2026-03-22
**版本**：v2
