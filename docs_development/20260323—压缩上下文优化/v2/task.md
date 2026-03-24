# 任务拆分：MCP 返回数据过滤优化 (v2)

## 需求概述

MCP 返回的 JSON 数据包含大量不必要的元数据（annotations, mimeType, uri 等），占用大量 token。需要添加智能过滤功能。

## 任务列表

### T1: 分析现有 jsonResult 函数
- [x] 分析 src/tools/types.ts 中的 jsonResult 函数
- [x] 确定需要过滤的元数据字段列表

### T2: 实现 filterJsonData 核心函数
- [x] 实现 MCP content 格式过滤（type: text/resource/image）
- [x] 实现普通 JSON 对象过滤
- [x] 实现数组元素递归过滤
- [x] 实现三种过滤级别（full/smart/minimal）

### T3: 修改 jsonResult 函数
- [x] 集成过滤功能
- [x] 添加过滤级别配置参数
- [x] 保持向后兼容（pretty print 默认开启）

### T4: 编写测试用例
- [x] 添加 MCP content 格式测试
- [x] 添加普通 JSON 过滤测试
- [x] 确保现有测试通过

### T5: 验证
- [x] TypeScript 类型检查通过
- [x] 单元测试通过
- [ ] 用户测试验证

## 文件位置

| 文件 | 改动类型 |
|------|----------|
| src/tools/types.ts | 修改 |
| tests/unit/tools/types.test.ts | 修改 |

## 依赖关系

T1 → T2 → T3 → T4 → T5（串行）

## 风险

- 过滤逻辑可能误删重要数据（需要用户反馈调整）
- 不同 MCP 返回格式可能不一致（需要扩展支持）
