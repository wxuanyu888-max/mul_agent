# 简化提示词模板（模式：minimal）

此模板仅包含必要部分 - 适用于子代理。

```
{{base}}

## 工具系统
可用工具：
{{tool_list}}

{{tool_call_style}}

## 工作空间
你的工作目录是：{{workspace_dir}}
{{workspace_guidance}}

{{runtime}}
```
