# 需求文档：Sessions API 问题排查

## 问题描述

前端页面无法显示 sessions 列表，但 API `/api/v1/chat/sessions` 实际返回了正确数据。

## 排查结果

### API 状态：✅ 正常

通过 curl 测试，API 正常返回 sessions：

```bash
curl "http://localhost:8080/api/v1/chat/sessions"
# 返回：5 个 sessions，parentId 均为 "default"
```

### 前端代理：✅ 正常

```
前端 (5182) → 后端 (8080) → sessions API
返回正确
```

### 可能原因

1. **浏览器缓存** - 建议硬刷新或清除缓存
2. **selectedAgent 过滤问题** - 前端 agents 列表为空，可能导致特殊过滤行为
3. **前端代码问题** - 需要进一步检查前端请求逻辑

## 后续排查方向

1. 在浏览器 Network 标签查看 `/api/v1/chat/sessions` 请求的完整 URL 和响应
2. 检查 `selectedAgent` 为空时的 API 调用行为
3. 检查浏览器控制台是否有其他错误

## 代码位置

- API: `src/api/routes/chat.ts` - `/chat/sessions`
- 前端: `ui/src/components/chat/SessionList.tsx`
- 前端 API: `ui/src/services/endpoints/chat.ts`
