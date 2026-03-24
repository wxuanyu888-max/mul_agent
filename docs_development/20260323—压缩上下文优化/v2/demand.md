# 需求文档：MCP 返回数据过滤优化 (v2)

## 需求背景

当前 MCP 工具调用返回的数据直接以完整 JSON 格式返回，包含大量不必要的元数据/结构信息，导致：
1. **上下文污染**：冗余的 JSON 数据占用大量 token
2. **信息噪音**：关键内容被埋没在嵌套的 JSON 结构中

## 解决方案

综合采用方案 A + B + C：

### 1. 按内容类型过滤（方案 A）
- `type: "text"` → 提取 `text` 字段
- `type: "resource"` → 提取关键信息，过滤 uri/mimeType/data
- `type: "image"` → 替换为描述文本

### 2. 深度过滤 JSON（方案 B）
- 过滤元数据字段：annotations, metadata, mimeType, uri, data, encoding 等
- 保留顶层关键字段：title, name, description, content, text, result 等

### 3. 可配置过滤级别（方案 C）
- `full`: 保留完整 JSON（向后兼容）
- `smart`: 智能过滤（默认，推荐）
- `minimal`: 最小化（只保留关键字段）

## 实现内容

### 修改文件

| 文件 | 改动 |
|------|------|
| [src/tools/types.ts](src/tools/types.ts) | 添加 filterJsonData 函数和过滤逻辑 |

### 核心函数

```typescript
// 过滤函数
filterJsonData(data: unknown, level: FilterLevel = 'smart'): unknown

// 使用过滤的 jsonResult
jsonResult(data: unknown, options?: { level?: FilterLevel; pretty?: boolean }): JsonToolResult
```

### 过滤级别

| 级别 | 描述 | 示例 |
|------|------|------|
| `full` | 完整保留 | 原始 JSON |
| `smart` | 智能过滤（默认） | 过滤 annotations, metadata, 提取 text |
| `minimal` | 最小化 | 只保留 title, name, text 等关键字段 |

### 示例

**输入（MCP 格式）：**
```json
{
  "content": [
    { "type": "text", "text": "关键内容", "annotations": { "important": true } },
    { "type": "resource", "resource": { "uri": "file://test", "mimeType": "text/plain", "data": "base64..." } }
  ]
}
```

**smart 模式输出：**
```json
{
  "content": [
    { "type": "text", "text": "关键内容" },
    { "type": "resource", "text": "[Resource content]" }
  ]
}
```

---

## 状态

✅ 已完成实现和测试
