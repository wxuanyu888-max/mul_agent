# 需求文档：简化 Teammate 工具

## 需求背景

参考 v1 对 Task 工具的简化思路，当前的 Teammate 工具系统功能过多，需要简化。

## 简化方案

**保留 2 个核心工具：**
| 工具 | 功能 | 说明 |
|------|------|------|
| `teammate_spawn` | 创建队友 | 核心功能 |
| `teammate_send` | 发消息给队友 | 核心功能，消息进入队列自动处理 |

**默认加载（不作为工具）：**
| 内容 | 说明 |
|------|------|
| `teammate_list` | 队友列表在 Prompt Builder 自动注入 |

**移除/禁用（代码保留，只是不暴露）：**
| 工具 | 原因 |
|------|------|
| `teammate_inbox` | 不需要，消息队列自动处理 |
| `teammate_broadcast` | 使用频率低 |
| `teammate_delegate` | 与 send 功能重叠 |
| `teammate_delegation_status` | 与 send 功能重叠 |
| `teammate_ask` | 同步等待有风险 |

## 期望结果

- Agent 只需要 `spawn` 和 `send` 两个工具
- 队友列表自动加载到提示词
- 消息通过队列自动处理，无需收件箱
- 简化提示词，减少工具数量

## 约束条件

- 不删除现有代码逻辑，只是不在提示词中暴露
- 保持向后兼容
