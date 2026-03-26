# 工具箱对齐 Claude Code 需求

## 需求背景

对比 MulAgent 与 Claude Code 的工具箱能力，确保核心功能对齐。

## 需求描述

1. **Read 工具扩展**：支持 PDF 分页读取、图片展示
2. **Edit 工具增强**：支持正则表达式替换
3. **工具对比分析**：确认 Find 工具已包含 Glob 功能

## 期望结果

- [x] Read 工具支持 `pages` 参数读取 PDF 指定页码
- [x] Read 工具支持图片文件返回 base64 dataUrl
- [x] Edit 工具支持 `regex` 参数进行正则替换
- [x] 确认 Find 工具已实现完整的 Glob 功能

## 约束条件

- 保持与 Claude Code 参数命名一致
- 不破坏现有文本文件读取功能
