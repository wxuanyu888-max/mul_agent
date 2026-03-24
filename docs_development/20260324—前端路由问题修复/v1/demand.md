# 需求文档 - 前端路由问题修复

## 需求背景

用户反馈前端存在以下问题：
1. **LLM 重复注册问题**：简单的一句话"你好"都会触发不断的 LLM 注册
2. **Session 分隔问题**：Session 之间的分隔似乎有问题
3. **Function Call 显示问题**：前端显示有时候会把 function call 的返回结果展示出来

---

## 分析结果

### 问题 1: LLM 重复注册问题

**根本原因**：
- `React.StrictMode` 在开发模式下会让 useEffect **执行两次**
- `ChatPanel` 的 useEffect 依赖数组为空 `[]`，但内部使用了 `selectedAgent` 和 `currentSessionId`，导致闭包问题
- 没有使用 loading 状态防止重复请求

### 问题 2: Session 分隔问题

**根本原因**：
- 切换 agent 时没有正确加载对应 agent 的 sessions
- `loadSessions` 函数逻辑不完善

### 问题 3: Function Call 显示问题

**根本原因**：
- 前端对 tool_calls JSON 的解析和过滤逻辑可能不完善（这个问题需要进一步验证）

---

## 已完成的修复

### 1. 移除 React.StrictMode

**文件**: [main.tsx](ui/src/main.tsx)

```typescript
// 之前
<React.StrictMode>
  <App />
</React.StrictMode>

// 修复后
<App />
```

### 2. 修复 ChatPanel useEffect 和防重入

**文件**: [ChatPanel.tsx](ui/src/components/chat/ChatPanel.tsx)

- 添加 `isLoadingData` 状态和 `isLoadingDataRef` ref 防止重复请求
- 添加 `selectedAgent` 变化的 useEffect，当切换 agent 时重新加载 sessions
- 修复 `loadSessions` 函数，切换 agent 时正确加载对应 sessions

### 3. 修复 SessionList 重复加载

**文件**: [SessionList.tsx](ui/src/components/chat/SessionList.tsx)

- 添加 `isLoadingRef` 防止重复加载

---

## 待验证

1. 启动前端开发服务器 `cd ui && pnpm dev`
2. 发送简单的"你好"消息，确认 API 不会重复调用
3. 切换不同的 agent，确认 session 正确加载
4. 检查 function call 返回是否正确显示

---

## 相关文件

- 前端：
  - [ui/src/main.tsx](ui/src/main.tsx) - 移除 StrictMode
  - [ui/src/components/chat/ChatPanel.tsx](ui/src/components/chat/ChatPanel.tsx) - 修复 useEffect 和防重入
  - [ui/src/components/chat/SessionList.tsx](ui/src/components/chat/SessionList.tsx) - 修复重复加载
