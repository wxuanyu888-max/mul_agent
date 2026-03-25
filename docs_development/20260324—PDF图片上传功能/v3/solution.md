# 实施记录 - V3

## 实施概述

为 PDF 和图片上传功能添加文件解析状态显示和内容提取能力。

## 修改文件

### 1. 前端 - 类型定义
- **文件**: `ui/src/types.ts`
- **修改**:
  - 新增 `AttachmentStatus` 类型：`'pending' | 'uploading' | 'parsing' | 'done' | 'error'`
  - 扩展 `Attachment` 接口：添加 `status`, `extractedText`, `error` 字段

### 2. 前端 - API 服务
- **文件**: `ui/src/services/endpoints/files.ts`
- **新增**:
  - `ExtractResult` 接口
  - `extractFileContent(fileId)` 函数

### 3. 前端 - 上传组件
- **文件**: `ui/src/components/chat/FileUploadButton.tsx`
- **修改**:
  - 上传流程：上传文件 → 调用解析 API → 更新状态
  - 图片直接完成（通过 URL 识别）
  - PDF/MD 等文件解析后完成
  - `FilePreviewItem` 组件显示解析状态：
    - 上传中：转圈 + "上传中..."
    - 解析中：转圈 + "解析中..."
    - 已解析：✓ + "已解析" + 字数
    - 解析失败：✗ + "解析失败"

### 4. 前端 - 聊天面板
- **文件**: `ui/src/components/chat/ChatPanel.tsx`
- **修改**:
  - 发送消息时传递 `extractedText` 给后端

### 5. 后端 - 文件提取 API
- **文件**: `src/api/routes/files.ts`
- **新增** `GET /api/v1/files/:fileId/extract`:
  - PDF: 使用 `pdf-parse` 提取文字
  - MD/TXT: 读取文件内容
  - 图片: 返回空（LLM 通过 URL 处理）

### 7. 后端 - 文件向量存储服务
- **文件**: `src/services/fileMemory.ts`（新建）
- **功能**:
  - 封装 `FileMemoryService` 类
  - 使用 `MemoryDatabase` 存储向量
  - 内容分块后存入数据库
  - 支持搜索已上传的文件内容

### 8. 后端 - 修改提取 API 存入向量
- **文件**: `src/api/routes/files.ts`
- **修改**:
  - 导入 `storeFileContent` 函数
  - 提取内容后调用存入向量数据库

## 处理流程

```
1. 用户选择文件
   ↓
2. 前端上传到 /files/upload
   ↓
3. 前端调用 /files/:id/extract（图片跳过）
   ↓
4. 后端:
   - PDF: pdf-parse 提取文字
   - MD/TXT: 读取内容
   - 图片: 返回空
   ↓
5. 前端显示解析状态
   ↓
6. 用户发送消息（包含 extractedText）
   ↓
7. 后端将内容追加到消息，发送给 Agent
   ↓
8. Agent 收到完整的消息 + 附件内容
```

## 文件类型处理

| 文件类型 | 前端处理 | 后端提取 | 向量存储 | Agent 获取方式 |
|----------|----------|----------|----------|----------------|
| PNG/JPG/GIF/WebP | 直接完成 | 返回空 | ❌ | URL 传给 LLM vision |
| PDF | 解析后完成 | pdf-parse | ✅ | 提取的文本内容 |
| MD | 解析后完成 | 读取内容 | ✅ | 提取的文本内容 |
| TXT | 解析后完成 | 读取内容 | ✅ | 提取的文本内容 |

## 向量数据库流程

```
用户上传 PDF/MD/TXT
       ↓
后端 /extract API 提取内容
       ↓
调用 storeFileContent() 存入向量库
       ↓
内容分块 → 生成 embedding → 存入 MemoryDatabase
       ↓
后续可以通过 searchFileContent() 搜索文件内容
```

## 测试验证

1. 点击上传按钮选择图片 → 显示"已解析"
2. 上传 PDF → 显示"解析中..."后"已解析 · X 字"
3. 上传 MD → 显示"解析中..."后"已解析 · X 字"
4. 发送消息给 Agent → Agent 能看到文件内容
5. 上传文件后，内容已存入向量数据库
