# Workflow 画板重设计 - 实施方案 (Canvas版本)

> 文档位置：`docs_development/20260325—Workflow画板重设计/solution.md`
> 最后更新：2026-03-25

## 1. 核心技术

使用 **HTML5 Canvas** + **原生 requestAnimationFrame** 实现粒子系统，替代 React Flow 的 DOM 渲染方式。

### 1.1 为什么用 Canvas

| 对比项 | React Flow (DOM) | Canvas |
|--------|------------------|--------|
| 渲染方式 | 每个节点一个 DOM | 纯绘制 |
| 动画帧率 | 受 React 渲染限制 | 60fps 原生 |
| 节点数量 | 100+ 会卡顿 | 1000+ 流畅 |
| 视觉效果 | 有限 | 无限可能性 |
| 开发复杂度 | 中等 | 较低 |

---

## 2. 架构设计

### 2.1 组件结构

```
CanvasFlow (主组件)
├── ParticleSystem (粒子系统类)
│   ├── particles: Map<string, Particle>
│   ├── connections: Connection[]
│   └── update() - 每帧更新逻辑
├── Canvas 渲染
│   ├── drawParticles() - 绘制粒子
│   └── drawConnections() - 绘制连接线
└── AgentDetailsModal (保持不变)
```

### 2.2 关键设计决策

1. **粒子系统与 React 状态分离**
   - 粒子系统使用 `ref` 存储，不触发 React 渲染
   - 渲染循环独立运行，读取粒子数据直接绘制
   - 避免每帧 `setState` 导致的卡顿

2. **目标位置固定**
   - 粒子进入 active 状态时生成固定目标点
   - 后续轮询只更新时间，不重新生成目标
   - 避免粒子抖动

---

## 3. 粒子移动算法

### 3.1 空闲状态（基于力的随机游走）

```typescript
// 每帧添加小的随机加速度（像被水流推动）
const ax = (Math.random() - 0.5) * 0.15;
const ay = (Math.random() - 0.5) * 0.15;
particle.vx += ax;
particle.vy += ay;

// 摩擦系数让运动更平滑
particle.vx *= 0.96;
particle.vy *= 0.96;

// 限制最大速度
if (speed > MAX_SPEED) {
  particle.vx = (particle.vx / speed) * MAX_SPEED;
  particle.vy = (particle.vy / speed) * MAX_SPEED;
}

// 如果太慢，给一个轻推
if (speed < MIN_SPEED) {
  const angle = Math.random() * Math.PI * 2;
  particle.vx += Math.cos(angle) * MIN_SPEED * 0.5;
  particle.vy += Math.sin(angle) * MIN_SPEED * 0.5;
}
```

**特点：**
- 随机加速度模拟水流推动
- 摩擦力让方向变化平滑（不是突变）
- 自然弧线运动，不是蠕动

### 3.2 边界反弹

```typescript
// 左边界
if (particle.x < padding) {
  particle.x = padding;
  particle.vx = Math.abs(particle.vx) * 0.4 + 0.3; // 反弹
}
// 其他边界同理
```

### 3.3 活跃状态（吸附到中心）

```typescript
// 目标位置在激活时固定，不每帧重新生成
if (particle.targetX === undefined) {
  particle.targetX = centerX + (Math.random() - 0.5) * 200;
  particle.targetY = centerY + (Math.random() - 0.5) * 150;
}

// LERP 插值移动
particle.x += (particle.targetX - particle.x) * CENTER_ATTRACTION;
particle.y += (particle.targetY - particle.y) * CENTER_ATTRACTION;
```

---

## 4. 关键常量

```typescript
const RELEASE_TIMEOUT = 5 * 60 * 1000;  // 5分钟释放
const BOUNDARY_PADDING = 60;             // 边界内边距
const MAX_SPEED = 1.5;                  // 最大速度
const FRICTION = 0.96;                   // 摩擦系数
const MIN_SPEED = 0.5;                  // 最小速度
const CENTER_ATTRACTION = 0.02;         // 中心吸引系数
const DIRECTION_CHANGE = 0.15;          // 方向变化量（未使用，当前算法更自然）
```

---

## 5. 状态管理

### 5.1 Particle 接口

```typescript
interface Particle {
  id: string;
  name: string;
  type: 'user' | 'brain' | 'agent';
  agentType?: string;
  x: number;
  y: number;
  vx: number;           // 速度
  vy: number;
  radius: number;
  status: 'idle' | 'active' | 'executing';
  lastActiveTime: number;
  agentId?: string;
  projectId?: string;
  currentWork?: string;
  color: { bg: string; border: string; text: string };
  // 活跃状态的目标位置（固定直到释放）
  targetX?: number;
  targetY?: number;
}
```

### 5.2 状态流转

```
idle → (有新交互) → active → (5分钟无交互) → idle
         ↓
    (执行中) → executing
```

---

## 6. 渲染优化

### 6.1 DPR 适配

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = dimensions.width * dpr;
canvas.height = dimensions.height * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

### 6.2 渲染循环分离

- 粒子更新：`ParticleSystem.tick()` 使用 `requestAnimationFrame`
- 渲染绘制：独立的 `useEffect` 也使用 `requestAnimationFrame`
- 两者互不阻塞

### 6.3 ResizeObserver

使用 `ResizeObserver` 监听容器尺寸变化，而非 `window.resize`

---

## 7. 文件结构

```
ui/src/
├── components/
│   └── workflow/
│       ├── CanvasFlow.tsx       # Canvas + 粒子系统实现
│       ├── AnimatedCanvas.tsx    # React Flow 版本（保留）
│       └── WorkflowCanvas.tsx    # 原始实现（保留）
└── App.tsx                        # 导入 CanvasFlow
```

---

## 8. 视觉效果

### 8.1 粒子样式

- 圆形设计（半径 35px）
- 彩色边框 + 半透明背景
- 状态指示器在右上角
- 名字和状态标签在下方

### 8.2 图标

使用简单文字代替 emoji：
- User: `U`
- Brain: `B`
- Agent: `A`
- bash: `$_`
- chat: `#`
- memory: `M`

### 8.3 连接线

- 贝塞尔曲线
- 箭头指向目标
- 按类型显示不同颜色

---

## 9. 待完成项

- [x] Canvas 粒子系统实现
- [x] 基于力的随机游走算法
- [x] 边界反弹
- [x] 活跃状态吸附
- [x] 5分钟释放机制
- [x] Agent 点击/编辑功能
- [ ] 完善单元测试
- [ ] 完善 E2E 测试

---

## 10. 运行方式

```bash
pnpm dev
# 访问 http://localhost:5185/
# 点击 Workflow 标签查看效果
```
