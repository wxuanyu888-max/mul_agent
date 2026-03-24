# 任务拆分

## 任务列表

### Phase 1: 后端 - 文件上传 API

- [ ] **T1.1** 创建文件上传 API 端点 `POST /api/v1/files/upload`
  - 文件位置：`src/api/routes/files.ts`
  - 支持 multipart/form-data
  - 验证文件类型（png, jpg, jpeg, gif, webp, pdf）
  - 验证文件大小（最大 10MB）
  - 保存文件到 `storage/uploads/` 目录
  - 返回文件元数据（id, filename, type, size, path）

- [ ] **T1.2** 创建文件获取 API 端点 `GET /api/v1/files/:fileId`
  - 返回文件内容或预览图

- [ ] **T1.3** 更新 Chat API 支持附件
  - 修改 `POST /api/v1/chat/stream` 接受 attachments 字段
  - 在消息中传递附件信息给 Agent

### Phase 2: 后端 - 文件内容提取

- [ ] **T2.1** 创建文件内容提取服务 `src/services/fileProcessor.ts`
  - 图片 OCR：使用 tesseract.js 或类似库
  - PDF 解析：使用 pdf-parse 或类似库

- [ ] **T2.2** 集成向量化服务（可选）
  - 使用现有的 embeddings 提供商
  - 存储向量到 memory 系统

### Phase 3: 前端 - 上传组件

- [ ] **T3.1** 创建文件上传组件 `ui/src/components/chat/FileUploadButton.tsx`
  - 隐藏的文件 input 元素
  - 支持多文件选择
  - 过滤允许的文件类型

- [ ] **T3.2** 添加拖拽支持
  - 在 ChatPanel 输入区域添加 drag & drop 事件
  - 拖拽时显示视觉反馈

- [ ] **T3.3** 创建文件预览组件 `ui/src/components/chat/FilePreview.tsx`
  - 图片显示缩略图
  - PDF 显示文件图标和名称
  - 支持删除已选文件

- [ ] **T3.4** 更新 ChatPanel 集成上传组件
  - 在输入框左侧添加上传按钮
  - 显示已选择的文件预览
  - 发送消息时包含附件

- [ ] **T3.5** 更新 Message 类型
  - 修改 `ui/src/types.ts` 的 Message 接口
  - 添加 attachments 字段

- [ ] **T3.6** 聊天记录显示附件
  - 在消息中显示文件缩略图/图标
  - 支持点击预览/下载

### Phase 4: 集成测试

- [ ] **T4.1** 端到端测试
  - 上传图片并发送
  - 上传 PDF 并发送
  - 拖拽上传
  - 多文件上传

## 依赖关系

```
T1.1 → T1.2 → T1.3
           ↓
T2.1 → T2.2
  ↓
T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6
  ↓
T4.1
```

## 文件位置

| 任务 | 文件 |
|------|------|
| T1.1 | `src/api/routes/files.ts`（新建） |
| T1.2 | `src/api/routes/files.ts` |
| T1.3 | `src/api/routes/chat.ts` |
| T2.1 | `src/services/fileProcessor.ts`（新建） |
| T2.2 | `src/services/fileProcessor.ts` |
| T3.1 | `ui/src/components/chat/FileUploadButton.tsx`（新建） |
| T3.2 | `ui/src/components/chat/ChatPanel.tsx` |
| T3.3 | `ui/src/components/chat/FilePreview.tsx`（新建） |
| T3.4 | `ui/src/components/chat/ChatPanel.tsx` |
| T3.5 | `ui/src/types.ts` |
| T3.6 | `ui/src/components/chat/ChatPanel.tsx` |
