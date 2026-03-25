# 前端 Settings 设置页面需求

## 需求背景

当前前端已有 "Settings" 入口（标签页），但功能比较单一，主要只包含：
- Global LLM Configuration（全局 LLM 配置，包括 API Key、Provider、Model 等）
- Platform Integrations（平台集成管理）

用户希望在 Settings 页面中添加更多设置项，使其成为一个统一的配置管理入口。

## 详细描述

建议将以下内容整合到 Settings 页面：

### 1. LLM 配置（已有，保留优化）
- 全局 LLM 配置（API Key、Provider、Model、URL）
- 平台集成管理（可配置的 LLM 集成）

### 2. API Keys 管理
- 各提供商的 API Keys（Anthropic、OpenAI、Ollama、MiniMax 等）
- 环境变量配置查看/编辑
- API Key 状态检测（是否已配置）

### 3. Agent 配置
- 默认 Agent 行为设置
- 超时配置
- 重试策略
- 并发数限制

### 4. Skill 配置
- 已启用的 Skill 列表
- Skill 参数配置

### 5. 系统设置
- 日志级别
- 调试模式开关
- 主题（Light/Dark）

### 6. 工具配置
- 文件操作路径限制
- Bash 命令白名单/黑名单
- 浏览器自动化设置

### 7. 记忆系统配置
- 向量存储选择
- Embedding 模型
- 记忆保留策略

## 期望结果

1. Settings 页面采用分类/标签页形式组织不同类型的配置
2. 每类配置有清晰的分组和说明
3. 配置修改后能实时生效或提供保存按钮
4. 敏感信息（如 API Key）需要加密显示或脱敏

## 约束条件

1. 保持与现有 UI 风格一致
2. 配置数据需要持久化到后端
3. 部分配置可能需要重启服务才能生效

## 讨论点

1. 以上分类是否合理？是否需要增删？
2. 配置优先级如何？哪些是高频使用的配置？
3. 是否需要区分"基础配置"和"高级配置"？
4. 配置的持久化方式（本地 vs 服务端）？