# 任务拆分

## 修改文件

- [src/tools/system/cron-manager.ts](src/tools/system/cron-manager.ts)

## 修改内容

修改 `parseCronExpression` 函数，处理通配符 `*` 的情况：

1. 当 `min === '*'` 时，直接返回 `now + 60000`
2. 修正指定分钟时的时间计算逻辑

## 依赖

无

## 验证方式

运行项目并创建测试任务验证