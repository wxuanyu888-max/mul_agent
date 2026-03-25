# 任务拆分 - V3

## 任务列表

### T1: 前端修改

- [x] **T1.1** 扩展 Attachment 类型
  - 文件：`ui/src/types.ts`
  - 添加 `status`, `extractedText`, `error` 字段

- [x] **T1.2** 添加提取 API 调用
  - 文件：`ui/src/services/endpoints/files.ts`
  - 添加 `extractFileContent` 函数

- [x] **T1.3** 修改上传流程
  - 文件：`ui/src/components/chat/FileUploadButton.tsx`
  - 上传文件后调用解析 API
  - 更新附件状态

- [x] **T1.4** 添加状态显示
  - 文件：`ui/src/components/chat/FileUploadButton.tsx`
  - `FilePreviewItem` 组件显示解析状态

- [x] **T1.5** 修改消息发送
  - 文件：`ui/src/components/chat/ChatPanel.tsx`
  - 传递 `extractedText` 给后端

### T2: 后端修改

- [x] **T2.1** 添加内容提取 API
  - 文件：`src/api/routes/files.ts`
  - 新增 `GET /files/:fileId/extract`
  - 使用 pdf-parse 解析 PDF
  - 读取文本文件内容
  - 图片直接返回空（LLM 通过 URL 处理）

- [x] **T2.2** 修改 chat/stream 处理附件
  - 文件：`src/api/routes/chat.ts`
  - 提取附件内容并追加到消息
  - 单 agent 模式和广播模式都支持

### T3: 测试验证

- [ ] **T3.1** 测试上传图片（应显示"已解析"）
- [ ] **T3.2** 测试上传 PDF（应显示"解析中..."后"已解析"）
- [ ] **T3.3** 测试上传 Markdown（应显示"解析中..."后"已解析"）
- [ ] **T3.4** 验证 Agent 收到文件内容

## 文件位置

| 任务 | 文件 |
|------|------|
| T1.1 | `ui/src/types.ts` |
| T1.2 | `ui/src/services/endpoints/files.ts` |
| T1.3 | `ui/src/components/chat/FileUploadButton.tsx` |
| T1.4 | `ui/src/components/chat/FileUploadButton.tsx` |
| T1.5 | `ui/src/components/chat/ChatPanel.tsx` |
| T2.1 | `src/api/routes/files.ts` |
| T2.2 | `src/api/routes/chat.ts` |

## 依赖关系

```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5
T2.1 ← T1.3
T2.2 → T3
```