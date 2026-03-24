# 实施记录

## 实施概述

已实现前端 PDF 和图片上传功能，包括：
- 文件上传 API
- 前端上传按钮和拖拽支持
- 文件预览
- 消息中显示附件

## 已完成的任务

### T1.1: 文件上传 API 端点
- **文件位置**: `src/api/routes/files.ts`
- **实现内容**:
  - `POST /api/v1/files/upload` - 文件上传接口
  - 支持图片 (PNG, JPG, GIF, WebP) 和 PDF
  - 文件大小限制 10MB
  - 文件保存到 `storage/uploads/` 目录

### T1.2: 文件获取 API 端点
- **文件位置**: `src/api/routes/files.ts`
- **实现内容**:
  - `GET /api/v1/files/:fileId` - 获取文件内容
  - `GET /api/v1/files/:fileId/metadata` - 获取文件元数据

### T1.3: 更新 Chat API 支持附件
- **文件位置**: `src/api/routes/chat.ts` (前端已更新)
- **实现内容**:
  - 前端发送消息时包含 attachments 字段
  - 消息对象包含附件信息

### T3.1 - T3.6: 前端实现
- **文件位置**:
  - `ui/src/services/endpoints/files.ts` - API 调用
  - `ui/src/components/chat/FileUploadButton.tsx` - 上传按钮组件
  - `ui/src/components/chat/ChatPanel.tsx` - 集成上传功能
  - `ui/src/types.ts` - 添加 Attachment 类型

- **实现功能**:
  - 上传按钮：点击选择文件
  - 拖拽上传：拖拽文件到输入区域
  - 文件预览：显示缩略图/图标和文件名
  - 发送消息：附件随消息一起发送
  - 消息显示：在聊天记录中显示已发送的附件

### T2.1: 文件内容提取服务
- **状态**: 待实现
- **说明**: 需要安装 OCR 库 (tesseract.js) 和 PDF 解析库 (pdf-parse)
- **后续工作**:
  - 安装依赖: `pnpm add tesseract.js pdf-parse`
  - 创建 `src/services/fileProcessor.ts`
  - 实现图片 OCR 和 PDF 文字提取

## 交互设计

### 上传入口
1. **按钮上传**: 输入框左侧新增回形针按钮，点击打开文件选择器
2. **拖拽上传**: 将文件拖拽到输入区域，显示紫色拖拽提示层

### 预览显示
- **输入时**: 输入框下方显示已选文件预览，包含缩略图/图标、文件名、大小、删除按钮
- **发送后**: 消息中显示附件缩略图/图标和文件名

### 文件限制
- 类型: PNG, JPG, JPEG, GIF, WebP, PDF
- 大小: 最大 10MB

## 依赖安装

```bash
pnpm add multer -w
pnpm add -D @types/multer -w
```

## 测试建议

1. 点击上传按钮选择图片/PDF
2. 拖拽文件到输入区域
3. 发送包含附件的消息
4. 验证聊天记录中显示附件
5. 测试大文件上传（应被拒绝）
6. 测试不支持的文件类型（应被拒绝）
