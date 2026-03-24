# 任务拆分

## 任务列表

### 1. 创建交互式 CLI 入口
- 文件: [src/cli/repl.ts](src/cli/repl.ts)
- 功能: 交互式 readline 界面
- 状态: ✅ 完成

### 2. 配置全局命令
- 修改: [package.json](package.json)
- 添加 bin 字段
- 状态: ✅ 完成

### 3. 创建启动脚本
- 文件: [mulagent.sh](mulagent.sh)
- 功能: 包装 npx tsx 调用
- 状态: ✅ 完成

### 4. 链接全局命令
- 命令: `npm link`
- 位置: `/usr/local/bin/mulagent`
- 状态: ✅ 完成

## 依赖关系

无依赖，独立任务

## 文件位置

| 文件 | 说明 |
|------|------|
| src/cli/repl.ts | 交互式 CLI 主程序 |
| mulagent.sh | 启动脚本 |
| package.json | bin 配置 |
