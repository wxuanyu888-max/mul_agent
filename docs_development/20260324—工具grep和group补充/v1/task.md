# 任务拆分

## Issue
#2 - 工具的grep和group的补充

## 任务列表

### 1. Grep 工具增强 - contextLines 参数
- [x] 添加 `contextLines` 参数到 GrepParams 接口
- [x] 在 tool definition 中添加参数定义
- [x] 修改 exactSearch 函数支持可配置上下文行数
- [x] 编写单元测试
- [x] 测试通过

### 2. Find 工具增强 - glob pattern 支持
- [x] 添加 `pattern` 参数（glob 模式）
- [x] 添加 `ext` 参数（扩展名过滤）
- [x] 实现 parseGlobPattern 函数
- [x] 实现 globToRegex 函数
- [x] 实现 searchWithGlobRecursive 函数
- [x] 修复 ? 通配符匹配逻辑
- [x] 编写单元测试
- [x] 测试通过

### 3. 待完成
- [ ] JSON 文件关键信息提取（需求待确认）
- [ ] group 工具（需求待讨论）

## 依赖关系
- 任务1和任务2无依赖关系，可并行开发
- 任务3需要需求确认后才能开始

## 文件位置
- Grep 工具: `src/tools/file/grep.ts`
- Find 工具: `src/tools/file/find.ts`
- 测试文件:
  - `tests/unit/tools/file/grep.test.ts`
  - `tests/unit/tools/file/find.test.ts`
