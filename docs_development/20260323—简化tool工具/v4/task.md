# 任务拆分：Sessions API 问题排查

## 任务列表

1. [ ] 检查浏览器 Network 请求
2. [ ] 确认 selectedAgent 过滤逻辑
3. [ ] 验证浏览器缓存问题
4. [ ] 修复问题（如有）

## 依赖关系

- 任务1 无依赖
- 任务2 依赖任务1
- 任务3 可选
- 任务4 依赖任务1-3

## 文件位置

- API: `src/api/routes/chat.ts`
- 前端: `ui/src/components/chat/SessionList.tsx`
