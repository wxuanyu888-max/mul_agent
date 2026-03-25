# 解决方案

## 修改文件

[src/tools/system/cron-manager.ts](src/tools/system/cron-manager.ts#L23-L63)

## 核心修改

修改 `parseCronExpression` 函数：

```typescript
function parseCronExpression(schedule: string, now: number): number {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return now + 60000;

  const [min, hour, day, month, dow] = parts;
  const date = new Date(now);

  date.setSeconds(0, 0);

  // 修复：分钟为 * 时直接返回 1 分钟后
  if (min === '*') {
    return now + 60000;
  } else {
    const targetMin = parseInt(min);
    date.setMinutes(targetMin);
    // 如果指定分钟已过，加 1 小时
    if (date.getTime() <= now) {
      date.setHours(date.getHours() + 1);
    }
  }

  // ... 其他逻辑保持不变
}
```

## 验证结果

- `* * * * *` → now + 60000ms ✓
- `30 14 * * *` → 今天 14:30 或明天 14:30 ✓