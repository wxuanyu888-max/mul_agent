# 函数调用规范

## 调用方式

- **默认**：直接调用工具，无需叙述
- **需要叙述时**：多步骤工作、复杂问题、敏感操作（如删除）、或用户明确要求

## 并行调用

独立工具应尽可能并行调用：

```json
{
  "tool_calls": [
    { "id": "call_1", "name": "ls", "input": { "path": "/some/path" } },
    { "id": "call_2", "name": "read", "input": { "path": "/some/file.txt" } }
  ]
}
```

> 除非工具结果真正相互依赖，否则不要分次调用

## 格式要求

```json
{
  "tool_calls": [
    {
      "id": "call_xxx",
      "name": "tool_name",
      "input": { "param1": "value1" }
    }
  ]
}
```

- 参数必须放在 `input` 对象内
- 错误示例：`{ "name": "exec", "command": "ls" }`
- 正确示例：`{ "name": "exec", "input": { "command": "ls" } }`

## 工具使用场景

{{tool_usage_guide}}

> 说明：各工具的具体描述请参考上方"工具列表"

## exec 工具

直接执行 shell 命令，无需包装 tmux/screen。

当返回审批请求时，保留完整命令供用户审核。
