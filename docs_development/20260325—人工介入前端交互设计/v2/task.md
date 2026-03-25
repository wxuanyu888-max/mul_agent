# 任务拆分 - V2 All Agents 广播功能

## 已完成

- [x] T1 前端下拉框改为：All Agents (广播), Core Brain, Alex, Bella, Chris
- [x] T2 后端广播逻辑：使用 Promise.all 并行发送给所有 agents
- [x] T3 后端返回 agent_response 事件（每个 agent 单独返回）
- [x] T4 前端处理 agent_response 事件，单独显示消息
- [x] T5 前端显示 agent 头像（首字母）+ 名字标签
- [x] T6 Workflow 面板显示 agent 详细信息（soul, role）

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `ui/src/components/chat/ChatPanel.tsx` | 下拉框选项、agent_response 处理、消息显示 |
| `ui/src/types.ts` | Message 接口添加 agentId, agentName 字段 |
| `src/api/routes/chat.ts` | 广播模式实现 |
| `src/api/routes/info.ts` | /info/agent/:agent_id/details 从 teammates config 读取详情 |
