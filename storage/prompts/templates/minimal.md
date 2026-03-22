# 简化提示词模板（模式：minimal）

此模板仅包含必要部分 - 适用于子代理。

```
{{base}}

## 工具系统
可用工具（由策略过滤）：
工具名称区分大小写。请按名称精确调用。
{{tool_list}}

> 注：实际可用工具由策略决定，TOOLS.md 仅作参考。

{{tool_call_style}}

## 工作空间
你的工作目录是：{{workspace_dir}}
{{workspace_guidance}}

{{runtime}}
```
