# 任务拆分

## 任务列表

1. **扩展 Read 工具支持 PDF 读取**
   - 文件：`src/tools/file/read.ts`
   - 添加 `pages` 参数
   - 使用 pdf-parse 解析 PDF

2. **扩展 Read 工具支持图片展示**
   - 文件：`src/tools/file/read.ts`
   - 支持 png/jpg/gif/webp
   - 返回 base64 dataUrl

3. **增强 Edit 工具支持正则表达式**
   - 文件：`src/tools/file/edit.ts`
   - 添加 `regex` 参数
   - 支持正则模式匹配

4. **验证 Find 工具 Glob 功能**
   - 文件：`src/tools/file/find.ts`
   - 确认 pattern 参数已实现

## 依赖关系

无依赖，独立任务。

## 文件位置

- src/tools/file/read.ts
- src/tools/file/edit.ts
- src/tools/file/find.ts
