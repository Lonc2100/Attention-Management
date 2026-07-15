# 技术设计

## 根因

当前圆环、图例和时间轴都同时绑定 `onMouseEnter` 与 `onMouseMove`。每次 `mousemove` 都创建新的 tooltip 对象并调用 React state，导致整个 `TodayDashboard`、全部圆环切片、图例和时间轴块重新渲染。高亮期间，大量时间块还同时执行 `filter: saturate()`，提示卡使用 `backdrop-filter`，进一步扩大合成与重绘成本。

## 方案 A

1. 仅在 `mouseenter` 时计算目标矩形并写入 tooltip/activeKey。
2. 鼠标在同一目标内移动时不再更新任何 React state。
3. 提示卡位置由目标矩形决定：默认目标右下方；靠近右/下边界时自动翻到左/上。
4. 键盘 focus 复用同一个目标矩形定位函数。
5. 非激活时间块只降低 opacity；移除 `filter`。
6. 提示卡使用不透明/高透明纯色背景，移除 `backdrop-filter`。

## 影响范围

- `src/renderer/src/TodayDashboard.tsx`
- `src/renderer/src/styles.css`
- `tests/e2e.mjs`
- 版本、发布说明与测试报告

## 回滚

无数据变化。还原以上 renderer/CSS diff 即可恢复 v0.4.1 行为。
