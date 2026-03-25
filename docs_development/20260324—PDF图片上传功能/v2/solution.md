# 实施记录 - V2

## 实施概述

为 PDF 和图片上传功能添加 Markdown 文件支持。

## 修改文件

### 1. 前端 - 文件类型允许列表
- **文件**: `ui/src/services/endpoints/files.ts`
- **修改**: `isAllowedFileType` 函数添加 markdown 类型
- **添加类型**:
  - `text/markdown`
  - `text/x-markdown`
  - `text/plain`

### 2. 前端 - 上传按钮 accept 属性
- **文件**: `ui/src/components/chat/FileUploadButton.tsx`
- **修改**: input 的 accept 属性添加 `.md,text/markdown,text/x-markdown`

### 3. 前端 - 文件预览图标
- **文件**: `ui/src/components/chat/FileUploadButton.tsx`
- **修改**: `FilePreviewItem` 组件添加 markdown 文件类型判断
- **效果**: markdown 文件显示蓝色文件图标

### 4. 前端 - 提示文字更新
- **文件**: `ui/src/components/chat/FileUploadButton.tsx`
- **修改**: 按钮 title 属性添加 Markdown 支持说明
- **文件**: `ui/src/components/chat/ChatPanel.tsx`
- **修改**: 拖拽文件时的不支持类型提示添加 Markdown

### 5. 后端 - 允许的文件类型
- **文件**: `src/api/routes/files.ts`
- **修改**:
  - 添加 `ALLOWED_MARKDOWN_TYPES` 数组
  - 合并到 `ALLOWED_TYPES`
  - 在文件获取路由添加 `.md` 和 `.txt` 的 mimeType 判断

### 6. 后端 - 元数据路由
- **文件**: `src/api/routes/files.ts`
- **修改**: 元数据路由添加 `.md` 和 `.txt` 的 mimeType 判断

## 文件类型支持

| 文件类型 | 前端 accept | 后端允许 | 预览图标 |
|----------|-------------|----------|----------|
| PNG/JPG/GIF/WebP | ✅ | ✅ | 图片缩略图 |
| PDF | ✅ | ✅ | 红色图标 |
| Markdown (.md) | ✅ | ✅ | 蓝色图标 |
| 文本 (.txt) | ✅ | ✅ | 蓝色图标 |

## 测试验证

1. 点击上传按钮选择 `.md` 文件
2. 拖拽 `.md` 文件到输入区域
3. 验证文件预览显示蓝色图标
4. 发送消息，验证消息中显示文件
5. 测试不支持的文件类型（应被拒绝）
