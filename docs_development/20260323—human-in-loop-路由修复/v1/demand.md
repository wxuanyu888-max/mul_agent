# 需求文档 - Human-in-Loop API 路由修复

## 需求背景

前端 HumanInLoopPanel 组件调用后端 API 时出现 404 错误：
- `GET /api/v1/human-in-loop/config` 返回 404
- `GET /api/v1/human-in-loop/stats` 返回 404

## 详细描述

### 问题现象
前端组件 `HumanInLoopPanel.tsx` 在加载数据时调用以下 API：
1. `GET /api/v1/human-in-loop/config` - 获取中断配置列表
2. `GET /api/v1/human-in-loop/stats` - 获取统计信息

这两个接口均返回 404 Not Found。

### 根本原因
Express 路由顺序问题：在 `human-in-loop.ts` 路由文件中，`/:id` 路由定义在 `/config` 和 `/stats` 之前。

当请求 `/api/v1/human-in-loop/config` 时，Express 会先匹配到 `/:id` 路由，把 "config" 当作 id 参数处理，导致 404。

## 期望结果

1. `GET /api/v1/human-in-loop/config` 正常返回配置列表
2. `GET /api/v1/human-in-loop/stats` 正常返回统计信息
3. 前端 HumanInLoopPanel 组件能正常加载数据

## 约束条件

- 不能破坏其他现有路由的功能
- 需要重启后端服务才能生效
- 前端无需修改

## 优先级

高 - 阻塞前端功能正常使用
