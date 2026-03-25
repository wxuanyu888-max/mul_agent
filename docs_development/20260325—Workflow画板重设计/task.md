# Workflow 画板重设计 - 任务拆分

> 文档位置：`docs_development/20260325—Workflow画板重设计/task.md`

## 任务概览

| 阶段 | 任务 | 优先级 |
|------|------|--------|
| 1 | 创建新的Canvas组件架构 | P0 |
| 2 | 实现自由游走动画系统 | P0 |
| 3 | 实现边界检测和反弹 | P0 |
| 4 | 实现交互吸附逻辑 | P0 |
| 5 | 实现5分钟释放机制 | P0 |
| 6 | 保持现有Agent点击/编辑功能 | P0 |
| 7 | 视觉样式优化 | P1 |

---

## 阶段 1：创建新的Canvas组件架构

### 1.1 新组件结构

**新建文件：**
- `ui/src/components/workflow/AnimatedCanvas.tsx` - 主画布组件（完全重写）

**主要组件设计：**
```
AnimatedCanvas
├── CanvasBoundary (边界容器)
├── AgentNode (agents + user + core-brain)
│   └── 位置由 animation engine 控制
├── InteractionEdge (连接线)
└── AnimationEngine (动画控制器)
```

### 1.2 状态定义

```typescript
interface CanvasState {
  // 所有实体的位置和状态
  entities: {
    id: string;
    type: 'user' | 'brain' | 'agent';
    position: { x: number; y: number };
    velocity: { vx: number; vy: number };
    state: 'idle' | 'active' | 'executing';
    lastActiveTime: number; // timestamp
  }[];

  // 当前活跃的连接
  connections: {
    id: string;
    source: string;
    target: string;
    type: string;
    task: string;
  }[];

  // 画板边界
  bounds: { width: number; height: number };
}
```

### 1.3 相关文件

| 文件 | 操作 |
|------|------|
| `ui/src/components/workflow/AnimatedCanvas.tsx` | 新建 |
| `ui/src/components/workflow/WorkflowCanvas.tsx` | 暂时保留，动画稳定后删除 |

---

## 阶段 2：实现自由游走动画系统

### 2.1 Animation Engine

```typescript
// 使用 requestAnimationFrame 的动画循环
class AnimationEngine {
  private entities: Entity[];
  private bounds: Bounds;
  private animationId: number;

  // 每帧更新位置
  tick = () => {
    this.entities.forEach(entity => {
      if (entity.state === 'idle') {
        this.updateIdleMovement(entity);
      }
    });
    this.animationId = requestAnimationFrame(this.tick);
  };

  // 随机漂浮算法
  private updateIdleMovement(entity: Entity) {
    // 1. 随机改变速度方向（小幅度）
    entity.velocity.vx += (Math.random() - 0.5) * 0.5;
    entity.velocity.vy += (Math.random() - 0.5) * 0.5;

    // 2. 限制最大速度
    const maxSpeed = 2;
    const speed = Math.sqrt(entity.velocity.vx ** 2 + entity.velocity.vy ** 2);
    if (speed > maxSpeed) {
      entity.velocity.vx = (entity.velocity.vx / speed) * maxSpeed;
      entity.velocity.vy = (entity.velocity.vy / speed) * maxSpeed;
    }

    // 3. 更新位置
    entity.position.x += entity.velocity.vx;
    entity.position.y += entity.velocity.vy;
  }
}
```

### 2.2 性能优化

- 使用 `useRef` 存储动画状态，避免 React 重新渲染
- 使用 CSS transform 进行位置更新（GPU 加速）
- 动画循环和 React 状态分离

---

## 阶段 3：实现边界检测和反弹

### 3.1 边界检测逻辑

```typescript
private checkBounds(entity: Entity) {
  const padding = 50; // 边界内边距

  // 左边界
  if (entity.position.x < padding) {
    entity.position.x = padding;
    entity.velocity.vx *= -1; // 反弹
  }
  // 右边界
  if (entity.position.x > this.bounds.width - padding) {
    entity.position.x = this.bounds.width - padding;
    entity.velocity.vx *= -1;
  }
  // 上边界
  if (entity.position.y < padding) {
    entity.position.y = padding;
    entity.velocity.vy *= -1;
  }
  // 下边界
  if (entity.position.y > this.bounds.height - padding) {
    entity.position.y = this.bounds.height - padding;
    entity.velocity.vy *= -1;
  }
}
```

---

## 阶段 4：实现交互吸附逻辑

### 4.1 吸附触发

```typescript
// 当收到新的 interaction 时
function handleNewInteraction(interaction: Interaction) {
  const now = Date.now();

  // 将 source 和 target 标记为 active
  entities.forEach(entity => {
    if (entity.id === interaction.source || entity.id === interaction.target) {
      entity.state = 'active';
      entity.lastActiveTime = now;
    }
  });

  // 添加连接
  connections.push({
    id: `conn-${interaction.run_id}`,
    source: interaction.source,
    target: interaction.target,
    type: interaction.type,
    task: interaction.task,
  });

  // 启动向中心移动的动画
  animateToCenter(entity);
}
```

### 4.2 向中心移动动画

```typescript
// 使用 CSS transition 或 requestAnimationFrame 平滑动画
function animateToCenter(entity: Entity) {
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;

  // 添加随机偏移，避免所有 agents 堆叠在同一位置
  const offsetX = (Math.random() - 0.5) * 200;
  const offsetY = (Math.random() - 0.5) * 150;

  const targetX = centerX + offsetX;
  const targetY = centerY + offsetY;

  // 使用 lerp 平滑移动到目标位置
  function animate() {
    entity.position.x += (targetX - entity.position.x) * 0.05;
    entity.position.y += (targetY - entity.position.y) * 0.05;

    if (Math.abs(targetX - entity.position.x) > 1) {
      requestAnimationFrame(animate);
    }
  }
  animate();
}
```

---

## 阶段 5：实现5分钟释放机制

### 5.1 释放计时器

```typescript
const RELEASE_TIMEOUT = 5 * 60 * 1000; // 5分钟
let releaseTimer: NodeJS.Timeout;

// 每次有新交互时，重置所有计时
function resetReleaseTimers() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseAllAgents();
  }, RELEASE_TIMEOUT);
}

// 释放所有 agents
function releaseAllAgents() {
  entities.forEach(entity => {
    if (entity.state === 'active' || entity.state === 'executing') {
      entity.state = 'idle';
      // 恢复随机速度
      entity.velocity = {
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      };
    }
  });
  connections = [];
}
```

### 5.2 定时检查

- 每秒检查一次所有 entities 的 `lastActiveTime`
- 如果距离现在超过 5 分钟，释放该 entity

---

## 阶段 6：保持现有Agent点击/编辑功能

### 6.1 点击事件处理

```typescript
// Agent 节点点击
function handleAgentClick(entity: Entity, event: MouseEvent) {
  if (entity.state === 'active' || entity.state === 'executing') {
    // 显示详细信息（已有功能）
    setSelectedAgent({
      agentId: entity.agentId,
      agentType: entity.type,
      projectId: entity.projectId,
    });
  } else {
    // 空闲状态也可以点击查看
    setSelectedAgent({
      agentId: entity.agentId,
      agentType: entity.type,
      projectId: entity.projectId,
    });
  }
}
```

### 6.2 Modal 保持不变

- `AgentDetailsModal` 组件保持现有实现
- 所有 tabs（soul, role, skill, memory, work, logs）功能不变

---

## 阶段 7：视觉样式优化

### 7.1 状态样式

| 状态 | 样式 |
|------|------|
| idle | `opacity: 0.6`, `filter: grayscale(30%)`, `transition: all 0.3s` |
| active | `opacity: 1`, `filter: none`, `box-shadow: 0 0 20px rgba(94, 92, 230, 0.5)` |
| executing | active + `animation: pulse 1.5s infinite` |

### 7.2 连接线样式

```typescript
// 活跃连接
const activeEdgeStyle = {
  stroke: '#22c55e',
  strokeWidth: 3,
  animation: 'dashFlow 1s linear infinite',
};

// 空闲时隐藏连接
// 连接线的显示与隐藏通过 opacity transition
```

### 7.3 背景

- 纯白色背景 `#ffffff`
- 无网格、无点阵

---

## 依赖关系

```
阶段1 (组件架构)
    ↓
阶段2 (自由游走) ──→ 阶段3 (边界反弹) ──→ 阶段5 (释放机制)
    │
    └──→ 阶段4 (吸附逻辑)
    │
    └──→ 阶段7 (视觉样式)
    │
阶段6 (点击功能保持不变，并行进行)
```

---

## 文件清单

| 文件路径 | 操作 | 阶段 |
|----------|------|------|
| `ui/src/components/workflow/AnimatedCanvas.tsx` | 新建 | 1 |
| `ui/src/components/workflow/WorkflowCanvas.tsx` | 保留(过渡) | - |
| `ui/src/App.tsx` | 可能需要修改引入 | - |

---

## 测试计划

1. **空闲动画测试**：agents 应该自由漂浮，不会跑出边界
2. **吸附测试**：发送 interaction 后，agents 应该移动到中心
3. **释放测试**：5分钟无交互后，agents 应该恢复空闲
4. **点击测试**：点击 agent 应该显示详情弹窗
5. **性能测试**：10个 agents 同时动画时，帧率应该保持 60fps
