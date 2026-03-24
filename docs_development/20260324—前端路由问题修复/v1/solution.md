# 解决方案 - 前端路由问题修复

## 问题描述

用户反馈前端存在以下问题：
1. **LLM 重复注册问题**：简单的一句话"你好"都会触发不断的 LLM 注册
2. **Session 分隔问题**：Session 之间的分隔似乎有问题
3. **Function Call 显示问题**：前端显示有时候会把 function call 的返回结果展示出来

## 问题分析

### 问题 1: LLM 重复注册问题

**根本原因**：
1. `React.StrictMode` 在开发模式下会让 useEffect **执行两次**
2. `ChatPanel` 的 useEffect 没有防重入机制
3. 没有使用 loading 状态防止重复请求

### 问题 2: Session 分隔问题

**根本原因**：
1. 切换 agent 时没有正确加载对应 agent 的 sessions
2. `loadSessions` 函数逻辑不完善

### 问题 3: Function Call 显示问题

**根本原因**：
- 前端有处理 tool_calls JSON 的代码（ChatPanel.tsx 第 586-615 行），但可能存在边界情况未处理
- 这个问题需要进一步验证具体场景

## 修复方案

### 修复 1: 移除 React.StrictMode

**文件**: `ui/src/main.tsx`

```diff
- <React.StrictMode>
-   <App />
- </React.StrictMode>
+ <App />
```

**说明**: React.StrictMode 在开发模式下会执行两次 useEffect，导致 API 重复调用。

### 修复 2: 添加防重入机制

**文件**: `ui/src/components/chat/ChatPanel.tsx`

1. 添加 loading 状态和 ref：
```typescript
const [isLoadingData, setIsLoadingData] = useState(false);
const isLoadingDataRef = useRef(false);
```

2. 修改 useEffect 添加防重入：
```typescript
useEffect(() => {
  if (isLoadingDataRef.current) return;
  isLoadingDataRef.current = true;

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // 加载 agents 和 sessions
    } finally {
      setIsLoadingData(false);
    }
  };

  loadData();

  return () => {
    isLoadingDataRef.current = false;
  };
}, []);
```

3. 添加 agent 切换时的 sessions 加载：
```typescript
useEffect(() => {
  if (!selectedAgent || isLoadingDataRef.current) return;
  // 重新加载 sessions
}, [selectedAgent]);
```

4. 修复 loadSessions 函数：
```typescript
const loadSessions = async () => {
  const res = await chatApi.getSessions(selectedAgent);
  const sessions = res.data.sessions || [];
  if (sessions.length > 0) {
    await loadSessionMessages(sessions[0].session_id);
  } else {
    setMessages([]);
    setCurrentSessionId('');
    localStorage.removeItem('chat_currentSessionId');
  }
};
```

### 修复 3: SessionList 防重复加载

**文件**: `ui/src/components/chat/SessionList.tsx`

```typescript
const isLoadingRef = useRef(false);

useEffect(() => {
  if (isOpen && !isLoadingRef.current) {
    loadSessions();
  }
}, [isOpen, selectedAgent]);

const loadSessions = async () => {
  if (isLoadingRef.current) return;
  isLoadingRef.current = true;
  // ...加载逻辑
  isLoadingRef.current = false;
};
```

## 验证步骤

1. 启动前端开发服务器：`cd ui && pnpm dev`
2. 发送简单的"你好"消息，确认 API 不会重复调用
3. 切换不同的 agent，确认 session 正确加载
4. 检查 function call 返回是否正确显示

## 相关文件

- `ui/src/main.tsx`
- `ui/src/components/chat/ChatPanel.tsx`
- `ui/src/components/chat/SessionList.tsx`

## 后续问题

- Function Call 显示问题需要进一步验证具体场景
