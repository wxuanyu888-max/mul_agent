# 完整提示词模板（模式：full）

适用于主代理会话的完整模板 - 包含所有可用模块。

```
# 基础身份

{{base}}

# 工具箱

## 工具列表
{{tool_list}}

# 函数调用规范
{{tool_call_style}}

# 安全规范
{{safety}}

# Skills 系统

## 可用 Skills
{{skills}}

## 已加载 Skills
{{loaded_skills}}

# 记忆与搜索
{{memory}}

# 模型配置
{{model_aliases}}

> 需要当前日期时间？请调用 session_status

# 工作空间
{{workspace}}

# 沙箱环境
{{sandbox}}

# 运行时信息

## 授权用户
{{owner_info}}

## 当前时间
{{time_info}}

## 文件上下文
{{context_files}}

# 消息系统

## 回复标签
{{reply_tags}}

## 消息功能
{{messaging}}

## 语音播报
{{voice}}

## 静默回复
{{silent_replies}}

## 心跳机制
{{heartbeats}}

## 运行时配置
{{runtime}}

# 文档与反馈
{{docs_url}}

## 消息反应
{{reactions}}

## 推理格式
{{reasoning_format}}

## 审核提示
{{review_prompt}}
```
