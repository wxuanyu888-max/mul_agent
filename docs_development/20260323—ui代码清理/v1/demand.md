# UI 代码清理需求文档

## 需求背景

UI 部分存在冗余文件，包括未使用的组件、测试产物、重复配置等。

## 当前分析结果

### 未使用的组件（确认删除）

| 目录 | 组件 | 引用情况 |
|------|------|----------|
| debug/ | DebugPanel.tsx, StateInspector.tsx, AgentTimeline.tsx, TokenBreakdown.tsx | **无引用** |
| monitor/ | AgentMonitor.tsx | **无引用** |
| team/ | TeamCollaboration.tsx | **无引用** |

### 测试产物（确认删除）

- `ui/test-results/` - E2E测试截图和视频
- `ui/playwright-report/` - Playwright HTML报告

### 冗余配置（确认删除）

- `ui/vite.config.js` - 与 vite.config.ts 重复
- `ui/vite.config.d.ts` - vite.config.ts 的类型声明，可能重复

### 其他检查

- hooks: useChat.ts, useAgent.ts - **使用中**
- stores: chatStore, agentStore, uiStore, taskStore - **使用中**
- services/endpoints - **使用中**
