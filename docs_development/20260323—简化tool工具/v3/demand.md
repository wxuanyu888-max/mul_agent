# 需求文档：禁用 Sessions 工具

## 需求背景

sessions 工具功能与 teammate 系统有重叠，且实际使用频率不高。为简化工具系统，决定不暴露 sessions 工具给 Agent。

## 简化方案

**不暴露 sessions 工具：**
- 不从 `createDefaultTools()` 加载
- 不在 `TOOL_DESCRIPTIONS` 中显示

**代码保留：**
- 所有 sessions 相关代码保持不变
- 工具定义文件 `src/tools/session/index.ts` 保留

## 约束条件

- 不删除现有代码逻辑
- 保持向后兼容
