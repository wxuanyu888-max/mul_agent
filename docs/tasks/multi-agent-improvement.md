# 多Agent系统完善任务

## 概述

完善 MulAgent 项目中的多Agent协作系统，包括 Teammate（队友系统）和 Autonomous（自治智能体）。

---

## 当前实现

### Teammate (队友系统)

**位置**: `src/agents/teammate.ts`

**已实现功能**:
- 队友创建/销毁 (`spawn`, `shutdown`)
- 消息发送 (`teammate_send`)
- 消息广播 (`teammate_broadcast`)
- 收件箱读取 (`teammate_inbox`)
- 队友列表 (`teammate_list`)
- JSONL 邮箱通信
- 任务委派 (`teammate_delegate`) ✅
- 同步问答 (`teammate_ask`) ✅
- 团队共享记忆 (`src/memory/team.ts`) ✅
- 事件通知系统 (`src/events/`) ✅

### Autonomous (自治智能体)

**位置**: `src/agents/autonomous.ts`

**已实现功能**:
- WORK / IDLE 两阶段循环
- 任务看板轮询
- 自动认领任务 (`claim_task`)
- 身份重注入
- 团队状态管理 (`team_list`)
- 任务依赖检查 ✅
- 任务优先级支持 ✅

---

## 任务清单（已完成）

### 第一阶段：核心修复 ✅

#### T-001 修复 Autonomous 任务依赖处理 ✅

**状态**: 已完成

**修改文件**: `src/agents/autonomous.ts`

- 重写 `scanUnclaimedTasks` 函数，增加显式依赖检查
- 增强 `claimTask` 函数，添加原子性验证
- 按创建时间排序

#### T-002 增加任务优先级支持 ✅

**状态**: 已完成

**修改文件**:
- `src/tools/tasks/manager.ts` - Task 接口添加 priority 字段
- `src/agents/autonomous.ts` - 按优先级排序

#### T-003 修复 Teammate 状态同步 ✅

**状态**: 已完成

**修改文件**: `src/agents/teammate.ts`

- 添加定期同步定时器（30秒）
- 添加 `persistAll()` 方法
- 添加 `destroy()` 方法

---

### 第二阶段：协作增强 ✅

#### T-004 实现任务委派工具 ✅

**状态**: 已完成

**新增文件**: `src/tools/teammate/delegate.ts`

- `teammate_delegate`: 委派任务给队友
- `teammate_delegation_status`: 查询委派状态

#### T-005 实现同步请求-响应 ✅

**状态**: 已完成

**新增文件**: `src/tools/teammate/ask.ts`

- `teammate_ask`: 同步等待响应

#### T-006 实现团队共享记忆 ✅

**状态**: 已完成

**新增文件**: `src/memory/team.ts`

- 团队级别的事实库
- 自动过期清理

#### T-007 实现事件通知系统 ✅

**状态**: 已完成

**新增文件**: `src/events/emitter.ts`

- 事件订阅/发布
- 事件持久化

---

### 第三阶段：前端可视化 ✅

#### T-008 任务看板界面 ✅

**状态**: 已完成

**修改文件**: `ui/src/components/tasks/TaskPanel.tsx`

- 添加优先级输入支持
- 优先级字段已添加到 Task 类型

#### T-009 Agent 状态监控 ✅

**状态**: 已完成

**新增文件**: `ui/src/components/monitor/AgentMonitor.tsx`

- 显示所有 Agent 状态
- 定时刷新
- 控制操作

#### T-010 团队协作视图 ✅

**状态**: 已完成

**新增文件**: `ui/src/components/team/TeamCollaboration.tsx`

- 队友列表
- 消息流
- 团队记忆
- 协作网络

---

## 里程碑

| 里程碑 | 任务 | 状态 |
|--------|------|------|
| M1 | T-001, T-002, T-003 | ✅ 完成 |
| M2 | T-004, T-005, T-006, T-007 | ✅ 完成 |
| M3 | T-008, T-009, T-010 | ✅ 完成 |

---

## 关联文件

### 核心文件
- `src/agents/teammate.ts` - 队友系统
- `src/agents/autonomous.ts` - 自治智能体
- `src/agents/loop.ts` - Agent 循环

### 工具文件
- `src/tools/teammate/spawn.ts`
- `src/tools/teammate/send.ts`
- `src/tools/teammate/broadcast.ts`
- `src/tools/teammate/inbox.ts`
- `src/tools/teammate/list.ts`
- `src/tools/teammate/delegate.ts` (新增)
- `src/tools/teammate/ask.ts` (新增)

### 存储
- `storage/teammates/config.json`
- `storage/teammates/inbox/`
- `storage/team_memory/` (新增)
- `storage/events/` (新增)

### 消息系统
- `src/message/teammate-bus.ts`

### 新增模块
- `src/memory/team.ts` - 团队共享记忆
- `src/events/emitter.ts` - 事件通知系统

### 前端组件
- `ui/src/components/tasks/TaskPanel.tsx` (更新)
- `ui/src/components/monitor/AgentMonitor.tsx` (新增)
- `ui/src/components/team/TeamCollaboration.tsx` (新增);
  // 过滤掉被阻塞的任务
  return tasks.filter(task => {
    if (!task.blockedBy || task.blockedBy.length === 0) return true;
    // 检查所有依赖任务是否完成
    return task.blockedBy.every(depId => {
      const depTask = taskManager.get(depId);
      return depTask?.status === 'completed';
    });
  });
}
```

**验收标准**:
- [ ] 阻塞任务不被认领
- [ ] 依赖完成才可认领

---

#### T-002 增加任务优先级支持

**问题**: 任务按创建时间排序，无优先级概念

**位置**: `src/tools/tasks/manager.ts`

**修复方案**:
- 在 Task 接口中添加 `priority` 字段
- 修改 `listRunnable()` 按优先级排序

**验收标准**:
- [ ] 高优先级任务优先被认领
- [ ] 同优先级按创建时间排序

---

#### T-003 修复 Teammate 状态同步

**问题**: 内存状态和文件配置可能不同步

**位置**: `src/agents/teammate.ts`

**修复方案**:
- 使用事件机制替代直接写文件
- 增加状态持久化定时器

**验收标准**:
- [ ] 异常退出不丢失状态
- [ ] 重启后正确恢复

---

### 第二阶段：协作增强

#### T-004 实现任务委派工具

**新增工具**: `teammate_delegate`

```typescript
interface TeammateDelegateParams {
  to: string;           // 目标队友
  task: string;         // 任务描述
  context?: string;    // 上下文信息
  deadline?: string;   // 截止时间
}
```

**位置**: `src/tools/teammate/delegate.ts`

**验收标准**:
- [ ] 可指定队友委派任务
- [ ] 任务可跟踪状态
- [ ] 完成后通知委托者

---

#### T-005 实现同步请求-响应

**新增工具**: `teammate_ask`

**区别于 `teammate_send`**:
- `send`: 异步消息
- `ask`: 同步等待响应

```typescript
interface TeammateAskParams {
  to: string;
  question: string;
  timeoutMs?: number;  // 默认 60000
}
```

**位置**: `src/tools/teammate/ask.ts`

**验收标准**:
- [ ] 发送问题并等待响应
- [ ] 超时自动取消
- [ ] 可中断等待

---

#### T-006 实现团队共享记忆

**新增模块**: `src/memory/team.ts`

**功能**:
- 团队级别的事实库
- 队友可读写
- 自动过期清理

**接口**:
```typescript
interface TeamMemory {
  write(agent: string, content: string): void;
  read(query: string): string[];
  list(): { agent: string; content: string; timestamp: number }[];
}
```

**验收标准**:
- [ ] 队友可写入经验
- [ ] 队友可查询历史
- [ ] 过期记忆自动清理

---

#### T-007 实现事件通知系统

**新增模块**: `src/events/`

**事件类型**:
- `task.completed` - 任务完成
- `task.failed` - 任务失败
- `member.joined` - 新成员加入
- `member.left` - 成员离开
- `message.received` - 收到新消息

**位置**: `src/events/emitter.ts`

**验收标准**:
- [ ] Agent 可订阅事件
- [ ] 事件触发通知
- [ ] 可过滤感兴趣的事件

---

### 第三阶段：前端可视化

#### T-008 任务看板界面

**位置**: `ui/src/components/board/`

**功能**:
- 显示所有任务
- 拖拽改变状态
- 筛选（按状态/优先级/负责人）
- 创建任务

**验收标准**:
- [ ] 实时显示任务状态
- [ ] 可拖拽操作
- [ ] 可创建/编辑任务

---

#### T-009 Agent 状态监控

**位置**: `ui/src/components/monitor/`

**功能**:
- 显示所有 Agent 状态
- 实时心跳
- 日志查看
- 控制（启动/停止/重启）

**验收标准**:
- [ ] 实时状态显示
- [ ] 可远程控制
- [ ] 日志实时更新

---

#### T-010 团队协作视图

**位置**: `ui/src/components/team/`

**功能**:
- 队友列表
- 消息流
- 协作关系图

**验收标准**:
- [ ] 显示队友在线状态
- [ ] 消息历史查看
- [ ] 协作关系可视化

---

## 技术债务

### 需重构

1. **Tool 注册方式** - 当前重复代码多
2. **Agent Loop 复用** - Autonomous 和 Teammate 有重复逻辑
3. **错误处理** - 各模块错误处理不一致

### 需测试

- [ ] Teammate 消息可靠性
- [ ] Autonomous 任务认领竞态
- [ ] 多任务依赖场景
- [ ] 内存/状态一致性

---

## 里程碑

| 里程碑 | 任务 | 预期结果 |
|--------|------|----------|
| M1 | T-001, T-002, T-003 | 系统可正常工作 |
| M2 | T-004, T-005, T-006, T-007 | 完整协作能力 |
| M3 | T-008, T-009, T-010 | 可视化管理 |

---

## 关联文件

### 核心文件
- `src/agents/teammate.ts` - 队友系统
- `src/agents/autonomous.ts` - 自治智能体
- `src/agents/loop.ts` - Agent 循环

### 工具文件
- `src/tools/teammate/spawn.ts`
- `src/tools/teammate/send.ts`
- `src/tools/teammate/broadcast.ts`
- `src/tools/teammate/inbox.ts`
- `src/tools/teammate/list.ts`

### 存储
- `storage/teammates/config.json`
- `storage/teammates/inbox/`

### 消息系统
- `src/message/teammate-bus.ts`
