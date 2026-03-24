# 实施记录

## 完成的功能

### 1. Grep 工具 - contextLines 参数

**修改文件**: `src/tools/file/grep.ts`

**改动内容**:
1. 在 `GrepParams` 接口中添加 `contextLines?: number` 字段
2. 在 tool definition 中添加参数定义，默认值为 1
3. 修改 `exactSearch` 函数，接收 `contextLines` 参数并使用它计算上下文范围

**核心逻辑**:
```typescript
const start = Math.max(0, i - contextLines);
const end = Math.min(lines.length - 1, i + contextLines);
```

**使用示例**:
```json
{
  "query": "function",
  "mode": "exact",
  "contextLines": 3,
  "maxResults": 10
}
```

### 2. Find 工具 - glob pattern 支持

**修改文件**: `src/tools/file/find.ts`

**新增参数**:
- `pattern`: Glob 模式（如 `**/*.ts`, `src/**/*.js`, `*.json`）
- `ext`: 文件扩展名过滤（如 `.ts`, `.js`, `.py`）

**新增函数**:
1. `parseGlobPattern()` - 解析 glob 模式，分离目录部分和文件名部分
2. `globToRegex()` - 将 glob 模式转换为正则表达式
3. `searchWithGlobRecursive()` - 递归搜索支持 glob 模式
4. `searchWithGlob()` - 主入口函数

**核心逻辑**:
- 支持 `**/*.ts` 这样的递归匹配
- 支持 `*.ts` 这样的简单匹配
- `*` 匹配任意字符，`?` 匹配0或1个字符
- 支持 `ext` 参数进行扩展名过滤

**使用示例**:
```json
{
  "name": "*.ts",
  "path": "/project",
  "type": "file"
}
```
```json
{
  "pattern": "src/**/*.ts",
  "path": "/project",
  "type": "file",
  "ext": ".ts"
}
```

## 测试结果
- grep.test.ts: 7 tests passed
- find.test.ts: 13 tests passed

## 待完成
- JSON 文件关键信息提取（需求待确认）
- group 工具（需求待讨论）
