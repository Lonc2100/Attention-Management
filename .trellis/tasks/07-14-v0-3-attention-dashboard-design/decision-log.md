# Decision Log

## 2026-07-15

### D-01 Unified attention denominator

首页圆环与列表都以排除 AFK 后的电脑活跃时间为同一分母。Codex 项目是 Codex 应用时间的子级，不与 Codex 总量重复计入。

### D-02 Truthful attribution states

只有能从 Codex 上下文可靠识别的时间才归入具体项目。离开 Codex 后可以显示“最近确认”，但不会继续累加为已确认项目时间；无可靠上下文的 Codex 时间归入待分类。

### D-03 Timeline granularity

时间轴直接展示项目级叶子切片：普通应用、Codex 具体项目、Codex 待分类和 AFK。连续且同类的片段只在展示层合并，原始事件不修改。

### D-04 Floating widget behavior

默认置顶、可折叠、可拖动，关闭后可从托盘和设置重新打开。用户可切换为桌面模式。首次位置为主屏幕右上角，显示器变化时安全回退。

### D-05 Version boundary

本次发布版本为 `v0.3.0`，名称为“悬浮专注窗与注意力驾驶舱”。Activity Details、跨应用项目归属和成果关联分别留到后续版本。
