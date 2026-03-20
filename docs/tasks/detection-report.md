# 多Agent系统检测报告

## 测试思路

| 类型 | 范围 | 目的 |
|------|------|------|
| **集成测试** | Agent 干活 | 验证 Agent 能否完成真实任务 |
| **单元测试** | API/数据流 | 验证人类使用的数据正确性 |

---

## 一、集成测试（Agent 干活）

### 测试场景 1：自治 Agent 自主完成看板任务

**目标**：验证 Autonomous Agent 能从任务看板认领任务并完成

```
步骤：
1. 在任务看板创建 3 个任务
2. 启动一个 Autonomous Agent
3. 观察 Agent 是否自动认领任务
4. 验证任务状态变为 completed
```

**验证点**：
- [ ] Agent 扫描到 pending 任务
- [ ] Agent 正确认领（owner 变为 agent）
- [ ] Agent 执行任务（调用工具）
- [ ] 任务状态变为 completed

---

### 测试场景 2：Teammate 协作完成委派任务

**目标**：验证队友之间能通过委派协作完成任务

```
步骤：
1. 创建一个 coder 队友
2. 委派任务 "写一个 hello world 函数"
3. 队友收到任务并执行
4. 验证任务完成
```

**验证点**：
- [ ] 委派消息送达队友 inbox
- [ ] 队友开始执行任务
- [ ] 任务执行结果返回
- [ ] 委派状态变为 completed

---

### 测试场景 3：多 Agent 任务依赖协作

**目标**：验证有依赖关系的任务被正确执行

```
步骤：
1. 创建任务 A（无依赖）
2. 创建任务 B（依赖 A）
3. 创建任务 C（依赖 B）
4. 启动 2 个 Autonomous Agent
5. 观察任务执行顺序
```

**验证点**：
- [ ] Agent 优先执行无依赖任务 A
- [ ] A 完成后才执行 B
- [ ] B 完成后才执行 C
- [ ] 不会跳过依赖执行

---

### 测试场景 4：优先级任务执行

**目标**：验证高优先级任务被优先执行

```
步骤：
1. 创建低优先级任务（priority=100）
2. 创建高优先级任务（priority=1）
3. 启动 Autonomous Agent
4. 观察哪个任务先被执行
```

**验证点**：
- [ ] priority=1 的任务先被认领
- [ ] priority=100 的任务后被认领

---

### 测试场景 5：Agent 团队记忆共享

**目标**：验证队友之间能通过记忆共享知识

```
步骤：
1. 队友 A 写入记忆 "使用 try-catch"
2. 队友 B 查询记忆
3. 验证 B 能获取 A 的知识
```

**验证点**：
- [ ] 记忆正确写入存储
- [ ] 队友能查询到他人记忆
- [ ] 关键词搜索返回相关记忆

---

## 二、单元测试（API/数据流）

### 单元测试 1：任务 API 数据正确性

```typescript
// tests/api/tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../src/tools/tasks/manager.js';

describe('Task API', () => {
  let manager: TaskManager;

  beforeEach(() => {
    manager = new TaskManager(':memory:');
  });

  it('should create task with priority', () => {
    const task = manager.create({ subject: 'Test', priority: 50 });
    expect(task.priority).toBe(50);
  });

  it('should list runnable by priority', () => {
    manager.create({ subject: 'Low', priority: 100 });
    manager.create({ subject: 'High', priority: 1 });

    const runnable = manager.listRunnable();
    expect(runnable[0].subject).toBe('High');
  });

  it('should respect blockedBy', () => {
    const a = manager.create({ subject: 'A' });
    manager.create({ subject: 'B', blockedBy: [a.id] });

    const runnable = manager.listRunnable();
    expect(runnable.find(t => t.subject === 'B')).toBeUndefined();
  });

  it('should clear blocked after completion', () => {
    const a = manager.create({ subject: 'A' });
    const b = manager.create({ subject: 'B', blockedBy: [a.id] });

    manager.update({ task_id: a.id, status: 'completed' });

    const taskB = manager.get(b.id);
    expect(taskB?.blockedBy).toHaveLength(0);
  });
});
```

### 单元测试 2：Teammate 状态管理

```typescript
// tests/api/teammate.test.ts
import { describe, it, expect } from 'vitest';
import { TeammateManager } from '../../src/agents/teammate.js';

describe('Teammate Manager', () => {
  it('should persist status changes', () => {
    const manager = new TeammateManager();
    manager.spawn({ name: 'test', role: 'coder' });

    // 状态应写入文件
    const config = loadConfig();
    expect(config.teammates[0].status).toBe('IDLE');
  });

  it('should list active teammates', () => {
    const manager = new TeammateManager();
    manager.spawn({ name: 'a', role: 'coder' });
    manager.spawn({ name: 'b', role: 'reviewer' });
    manager.shutdown('a');

    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list.find(t => t.name === 'a')?.status).toBe('SHUTDOWN');
  });
});
```

### 单元测试 3：团队记忆

```typescript
// tests/api/team-memory.test.ts
import { describe, it, expect } from 'vitest';
import { TeamMemoryManager } from '../../src/memory/team.js';

describe('Team Memory', () => {
  it('should write and read', () => {
    const mem = new TeamMemoryManager();
    const id = mem.write('agent1', 'test content', ['tag1']);

    const result = mem.read('test');
    expect(result[0].content).toBe('test content');
  });

  it('should filter by agent', () => {
    const mem = new TeamMemoryManager();
    mem.write('agent1', 'content 1');
    mem.write('agent2', 'content 2');

    const agent1 = mem.listByAgent('agent1');
    expect(agent1).toHaveLength(1);
  });
});
```

### 单元测试 4：事件系统

```typescript
// tests/api/events.test.ts
import { describe, it, expect } from 'vitest';
import { EventEmitter } from '../../src/events/emitter.js';

describe('Event System', () => {
  it('should emit and subscribe', () => {
    const emitter = new EventEmitter();
    let received = false;

    emitter.subscribe('agent1', ['task.completed'], (evt) => {
      received = true;
    });

    emitter.emit('task.completed', 'agent2', { taskId: 1 });
    expect(received).toBe(true);
  });

  it('should filter by type', () => {
    const emitter = new EventEmitter();
    emitter.emit('task.completed', 'a', {});
    emitter.emit('task.failed', 'a', {});

    const history = emitter.getHistory('task.completed');
    expect(history).toHaveLength(1);
  });
});
```

---

## 三、测试检查清单

### 集成测试（必须人工/脚本验证）

| # | 场景 | 验证结果 |
|---|------|----------|
| 1 | Autonomous Agent 自主完成看板任务 | [ ] |
| 2 | Teammate 协作完成委派任务 | [ ] |
| 3 | 多 Agent 任务依赖协作 | [ ] |
| 4 | 高优先级任务优先执行 | [ ] |
| 5 | 团队记忆共享 | [ ] |

### 单元测试（可自动化）

| # | 模块 | 测试文件 |
|---|------|----------|
| 1 | 任务管理 | `tests/api/tasks.test.ts` |
| 2 | 队友管理 | `tests/api/teammate.test.ts` |
| 3 | 团队记忆 | `tests/api/team-memory.test.ts` |
| 4 | 事件系统 | `tests/api/events.test.ts` |

---

## 运行测试

```bash
# 运行单元测试
pnpm test:run

# 或只运行 API 测试
pnpm vitest run tests/api/
```
