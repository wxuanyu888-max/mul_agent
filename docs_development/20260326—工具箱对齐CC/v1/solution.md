# 实施过程

## 实现步骤

### 1. Read 工具扩展 - PDF 和图片支持

**文件**: `src/tools/file/read.ts`

**修改内容**:
- 添加 `pages` 参数，支持 PDF 分页读取（如 "1-3" 或 "1,2,5"）
- 添加图片文件支持，返回 base64 dataUrl
- 根据文件扩展名自动判断类型

**关键代码**:
```typescript
// PDF 处理
if (ext === '.pdf') {
  return await readPdfFile(filePath, pages);
}

// 图片处理
if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
  return await readImageFile(filePath);
}
```

### 2. Edit 工具增强 - 正则表达式支持

**文件**: `src/tools/file/edit.ts`

**修改内容**:
- 添加 `regex` 参数，支持正则表达式匹配
- 支持 `replaceAll` + `regex` 组合

**关键代码**:
```typescript
if (regex) {
  const regexObj = new RegExp(oldString, replaceAll ? 'g' : '');
  content = content.replace(regexObj, newString);
}
```

### 3. Find 工具验证

**文件**: `src/tools/file/find.ts`

**确认结果**: 已完整实现 Glob 功能
- `pattern` 参数支持 `**/*.ts` 等模式
- `name` 参数支持 `*.ts` 等通配符

## 核心逻辑

| 工具 | 参数 | 功能 |
|------|------|------|
| Read | `pages` | PDF 分页 |
| Read | (自动) | 图片转 base64 |
| Edit | `regex` | 正则匹配 |
| Find | `pattern` | Glob 模式 |

## 测试方案

1. 测试 PDF 分页：`read({ path: "test.pdf", pages: "1-3" })`
2. 测试图片读取：`read({ path: "image.png" })` - 应返回 dataUrl
3. 测试正则替换：`edit({ path: "file.ts", oldString: "function\\s+(\\w+)", newString: "const $1 =", regex: true })`
4. 测试 Glob：`find({ pattern: "**/*.ts" })`
