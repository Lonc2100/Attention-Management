# Design — v0.7.4

## Decision

保留 ActivityWatch 默认 3 分钟 AFK 作为原始传感事实，在产品派生层应用 `idleThresholdMinutes`。短于阈值的 AFK 与窗口存在区间相交后重新计入；达到阈值才作为主要离开。

## Canonical data flow

1. Query API 对窗口与 AFK bucket 先执行 `flood`，消除原始心跳间隙。
2. 当前摘要与明细使用同一 canonical 事件结果。
3. 年度统计以官方非 AFK 区间为基线，再合并短 AFK和人工计入区间。
4. 所有工作日边界、项目归属、成果证据和历史指标消费同一派生结果。

## State

- schema v8：设置增加 `idleThresholdMinutes`；增加按日期保存的 `idleOverrides`。
- Activity summary/details：增加 `softIdleSeconds` 与当前阈值，便于 UI 如实解释。
- 派生缓存 v3 记录 policy key；阈值变化时清空内存事实并重建，不删除原始数据。

## Risks and rollback

- 历史总量会上升，这是口径修正而非数据新增；UI必须披露低交互推定量。
- 阈值过大可能高估短暂离开，因此提供设置和单段纠正。
- 回滚只需还原代码；v8 新字段是附加字段，旧版会忽略，ActivityWatch 原始数据不受影响。
