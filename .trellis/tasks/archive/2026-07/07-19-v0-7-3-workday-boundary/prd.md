# v0.7.3 跨午夜工作日边界

## Goal

将跨午夜连续工作归属前一工作日，以主要休息边界开始新工作日，并增加最晚离开电脑与可纠错边界。

## Requirements

- 跨过午夜但尚未完成主要休息的前台非 AFK 活动继续归属上一工作日。
- 每个自然日期只允许第一次主要休息后的返回创建自动工作日边界，白天后续离开不切日。
- 默认主要休息阈值为 6 小时；用户可在活动明细中设置明确边界覆盖自动判断。
- 首页、活动明细、Codex 项目归属、计划、复盘、提醒和工作活动热力图使用同一个工作日键。
- 记录事实指标“最晚离开电脑”；睡眠只能标注为基于电脑活动的推测。
- 不修改 ActivityWatch 原始事件，不新增录屏、键盘正文或联网采集。

## Acceptance Criteria

- [x] 23:00–次日 02:30 的连续活动完整归属前一工作日。
- [x] 完成主要休息并在次日 10:00 返回后，从 10:00 开始归属新工作日。
- [x] 同日白天离开 6 小时后返回，仍归属同一日期且不会隔出一天。
- [x] 没有主要休息的通宵不会在 00:00 强制切日。
- [x] 人工边界可以覆盖自动边界，撤销后恢复自动判断。
- [x] 日、周、月工作活动总量守恒，并能显示最晚离开电脑时间。
- [x] ActivityWatch 断连时保留最近确认的工作日，不伪造新边界。
- [x] 升级后真实数据、计划、复盘、规则、自启动设置全部保留。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
