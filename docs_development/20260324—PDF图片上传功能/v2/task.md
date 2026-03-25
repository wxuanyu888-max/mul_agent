# 任务拆分 - V2

## 任务列表

### T1: 前端修改

- [x] **T1.1** 更新前端文件类型允许列表
  - 文件：`ui/src/services/endpoints/files.ts`
  - 添加 text/markdown, text/x-markdown, text/plain

- [x] **T1.2** 更新上传按钮 accept 属性
  - 文件：`ui/src/components/chat/FileUploadButton.tsx`
  - 添加 .md, text/markdown, text/x-markdown

- [x] **T1.3** 添加 markdown 文件预览图标
  - 文件：`ui/src/components/chat/FileUploadButton.tsx`
  - FilePreviewItem 组件添加 markdown 类型判断

- [x] **T1.4** 更新提示文字
  - 文件：`ui/src/components/chat/FileUploadButton.tsx`
  - 按钮 title 添加 Markdown 支持
  - 文件：`ui/src/components/chat/ChatPanel.tsx`
  - 拖拽提示添加 Markdown 支持

### T2: 后端修改

- [x] **T2.1** 更新后端允许文件类型
  - 文件：`src/api/routes/files.ts`
  - 添加 ALLOWED_MARKDOWN_TYPES

- [x] **T2.2** 添加 .md/.txt 文件 mimeType 判断
  - 文件：`src/api/routes/files.ts`
  - 在文件获取路由和元数据路由添加判断

### T3: 测试验证

- [ ] **T3.1** 测试上传 .md 文件
- [ ] **T3.2** 测试拖拽上传 .md 文件
- [ ] **T3.3** 验证文件预览图标
- [ ] **T3.4** 验证消息中显示文件

## 文件位置

| 任务 | 文件 |
|------|------|
| T1.1 | `ui/src/services/endpoints/files.ts` |
| T1.2 | `ui/src/components/chat/FileUploadButton.tsx` |
| T1.3 | `ui/src/components/chat/FileUploadButton.tsx` |
| T2.1 | `src/api/routes/files.ts` |
| T2.2 | `src/api/routes/files.ts` |

## 依赖关系

```
T1.1 → T1.2 → T1.3
T2.1 → T2.2
T1 + T2 → T3
```
