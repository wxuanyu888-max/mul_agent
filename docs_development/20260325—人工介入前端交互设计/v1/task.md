# 任务拆分 - Agent Team 下拉框支持

## 已完成

- [x] T1 后端 API 返回 teammates 列表
- [x] T2 前端下拉框显示所有 agents
- [x] T3 统一 AgentLoop，通过 extraSystemPrompt 区分
- [x] T4 Prompt 模板添加 {{extra}} 占位符

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/api/routes/info.ts` | 从 config.json 加载 teammates |
| `src/api/routes/chat.ts` | 传递 extraSystemPrompt 给 AgentLoop |
| `storage/config/prompts/templates/full.md` | 添加 {{extra}} 占位符 |
