# 实施逻辑：MCP 返回数据过滤优化 (v2)

## 问题分析

### 根因
原 `jsonResult()` 函数直接将数据 JSON 字符串化，没有过滤不必要的元数据。

### 关键代码位置
- `src/tools/types.ts` 第 21-25 行（修改前）

## 解决方案

### 核心思路
添加 `filterJsonData()` 函数，根据过滤级别智能提取关键数据。

### 实现步骤

#### 1. 定义元数据字段和关键字段

```typescript
// 需要过滤的元数据字段
const METADATA_FIELDS = new Set([
  'annotations', 'metadata', 'mimeType', 'uri', 'data',
  'encoding', 'size', 'timestamp', 'created_at', 'updated_at',
  '_raw', '__typename',
]);

// minimal 模式保留的关键字段
const ESSENTIAL_FIELDS = new Set([
  'title', 'name', 'description', 'content', 'text',
  'body', 'message', 'result', 'status', 'error',
  'data', 'items', 'results', 'files', 'commit', 'branch', 'url', 'id',
]);
```

#### 2. 实现 MCP 内容过滤

```typescript
// MCP 标准格式：{ content: [{ type: 'text', text: '...' }, ...] }
function filterMcpContentItem(item, level) {
  if (item.type === 'text') {
    return { type: 'text', text: item.text };  // 只保留 text
  }
  if (item.type === 'resource') {
    return { type: 'resource', text: item.resource?.text || '[Resource content]' };
  }
  if (item.type === 'image') {
    return { type: 'image', text: '[Image content - see screenshot]' };
  }
  // ...
}
```

#### 3. 实现三种过滤级别

```typescript
function filterJsonData(data, level = 'smart') {
  if (level === 'full') return data;  // 不过滤
  if (level === 'minimal') return filterMinimal(data);  // 只保留关键字段
  return filterSmart(data);  // 智能过滤
}
```

## 使用方式

```typescript
// 默认 smart 模式
jsonResult(mcpData)

// 指定模式
jsonResult(mcpData, { level: 'minimal' })
jsonResult(mcpData, { level: 'full' })

// 单独使用过滤函数
const filtered = filterJsonData(data, 'smart')
```

## 压缩效果

| 输入 | smart 输出 |
|------|-----------|
| `{"content":[{"type":"text","text":"关键","annotations":{}}]}` | `{"content":[{"type":"text","text":"关键"}]}` |

Token 节省：约 30-50%（取决于元数据量）

## 测试方案

### 单元测试
- MCP content 格式过滤
- 普通 JSON 过滤
- 三种级别对比

### 手动测试
1. 调用 MCP 工具
2. 检查返回结果是否过滤了元数据
3. 验证关键信息未丢失

## 回滚方案

```bash
git revert HEAD
```
