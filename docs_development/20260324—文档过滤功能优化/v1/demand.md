# 需求文档：文档过滤功能优化

## Issue
[#12: 文档过滤功能去除杂质](https://github.com/wxuanyu888-max/mul_agent/issues/12)

## 需求背景
- 工具调用返回的 JSON 数据包含大量无用字段，占用上下文空间
- MCP API 返回的元数据（annotations, metadata, uri 等）通常不需要展示
- 某些 API（如 GitHub）返回大量冗余字段（url, node_id, avatar_url 等）

## 期望结果
- 智能过滤 JSON 中的无用字段
- 保留关键数据（title, name, description, content, text 等）
- 字符串内容完整保留，不截断

## 约束条件
- 保持向后兼容，不过度过滤
- smart 模式为默认模式

## 解决方案
1. 扩展 METADATA_FIELDS 黑名单，增加 URL 相关字段和 ID 字段
2. 字符串完整保留，不截断
3. 数组不过度限制数量

## 实施文件
- `src/tools/types.ts` - filterJsonData 函数
