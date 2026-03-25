# 任务拆分

## 子任务列表

### Phase 1: History 面板修复

#### Task 1.1: 修复 CheckpointPanel sessionId 获取逻辑
- **文件**: `ui/src/components/checkpoint/CheckpointPanel.tsx`
- **改动**:
  - 使用 `localStorage.getItem('chat_currentSessionId')` 获取 sessionId
  - 添加轮询机制每秒检查 localStorage 变化
  - 添加 storage 事件监听器支持跨 Tab 同步
- **依赖**: 无

#### Task 1.2: 添加空 sessionId 时自动获取最近 session
- **文件**: `ui/src/components/checkpoint/CheckpointPanel.tsx`
- **改动**:
  - 当 sessionId 为空时，调用 `chatApi.getSessions()` 获取最近 session
  - 使用 `initialized` 状态防止循环调用
- **依赖**: Task 1.1

#### Task 1.3: 修复 ChatPanel session not found 处理
- **文件**: `ui/src/components/chat/ChatPanel.tsx`
- **改动**:
  - 当 session 加载失败（404）时，清除无效 sessionId
  - 自动加载一个有效的 session
- **依赖**: 无

### Phase 2: Agent Prompt 编辑功能

#### Task 2.1: 后端添加 updateTeammate 方法
- **文件**: `src/agents/teammate.ts`
- **改动**:
  - 在 `TeammateManagerClass` 添加 `update()` 方法
  - 支持更新 `role` 和 `prompt` 字段
  - 立即保存到 `storage/teammates/config.json`
  - 导出 `updateTeammate()` 函数
- **依赖**: 无

#### Task 2.2: 后端添加 PUT API 端点
- **文件**: `src/api/routes/teammates.ts`
- **改动**:
  - 添加 `PUT /teammates/:name` 路由
  - 调用 `updateTeammate()` 保存配置
- **依赖**: Task 2.1

#### Task 2.3: 前端添加 update API 方法
- **文件**: `ui/src/services/endpoints/teammates.ts`
- **改动**:
  - 添加 `UpdateTeammateParams` 接口
  - 添加 `update()` 方法调用 PUT API
- **依赖**: Task 2.2

#### Task 2.4: AgentDetailsModal 添加编辑功能
- **文件**: `ui/src/components/workflow/WorkflowCanvas.tsx`
- **改动**:
  - 导入 `teammatesApi`
  - 添加编辑状态: `isEditing`, `editPrompt`, `editRole`, `isSaving`
  - 在 Soul tab 添加"编辑"按钮和 textarea
  - 添加 `handleSaveEdit()` 保存函数
- **依赖**: Task 2.3

### Phase 3: 清理和修复

#### Task 3.1: 修复 memory/manager.ts 类型错误
- **文件**: `src/memory/manager.ts`
- **改动**:
  - 移除 `DatabaseConfig` 中不存在的 `enabled` 属性
- **依赖**: 无

## 文件修改清单

| 文件路径 | 改动类型 |
|---------|---------|
| `ui/src/components/checkpoint/CheckpointPanel.tsx` | 修改 |
| `ui/src/components/chat/ChatPanel.tsx` | 修改 |
| `src/agents/teammate.ts` | 修改 |
| `src/api/routes/teammates.ts` | 修改 |
| `ui/src/services/endpoints/teammates.ts` | 修改 |
| `ui/src/components/workflow/WorkflowCanvas.tsx` | 修改 |
| `src/memory/manager.ts` | 修改 |
