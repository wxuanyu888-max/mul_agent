# 复盘改进：简化 Teammate 工具

## 实施评价

✅ 成功简化 Teammate 工具系统

## 修改内容

| 文件 | 修改 |
|------|------|
| `src/tools/index.ts` | 只保留 `spawn` 和 `send`，禁用其他 6 个工具 |
| `src/tools/teammate/spawn.ts` | 更新工具描述 |
| `src/tools/teammate/send.ts` | 更新工具描述 |
| `src/agents/prompt/builder.ts` | 添加队友列表自动加载 |

## 发现问题

无问题。

## 改进建议

1. 可考虑后续完全移除被禁用的 teammate 工具代码（inbox、broadcast、delegate 等）
2. 可添加 UI 显示队友列表

## 后续计划

- 可进行实际使用测试，验证 Agent 是否正确使用 `spawn` 和 `send`
