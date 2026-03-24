# 解决方案：文档过滤功能优化

## 改动文件
`src/tools/types.ts`

## 核心改动

### 1. 扩展黑名单字段
新增 40+ 需要过滤的字段：
- URL 相关：html_url, avatar_url, forks_url, events_url, keys_url, collaborators_url 等
- ID 相关：node_id, temp_clone_token, network_count, subscribers_count 等
- 其他：license, permissions, private, fork, visibility 等

### 2. 保留完整字符串
不截断字符串内容，完整保留用户数据

### 3. 保留完整数组
不过度限制数组元素数量

## 过滤效果

| 测试场景 | 原始 | 过滤后 | 减少 |
|---------|------|--------|------|
| 超长字符串 | 5027 字符 | 5027 字符 | 完整保留 |
| GitHub API | 591 字符 | 162 字符 | 72.6% |
| MCP 格式 | 273 字符 | 139 字符 | 49.1% |

## 过滤级别
- `full`: 不做过滤
- `smart` (默认): 过滤元数据字段，保留关键数据
- `minimal`: 只保留顶层关键字段
