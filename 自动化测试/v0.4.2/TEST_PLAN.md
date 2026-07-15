# TEST_PLAN（v0.4.2）

## P0/P1 行为

- 鼠标进入圆环、图例、时间轴后显示正确提示。
- 同一目标内部移动鼠标不改变提示卡位置，不触发 React 跟随更新。
- 切换目标时提示内容和位置更新。
- 联动高亮、窄时间块命中、键盘 focus 和 reduced-motion 保持。
- CSS 不再对大量 dimmed 时间块应用 filter，tooltip 不再使用 backdrop-filter。

## 回归门槛

1. `npm test`、`npm run typecheck`、`npm run build` 通过。
2. Electron E2E 连续两轮通过。
3. 打包 smoke、升级安装、真实数据和自启动验证通过。
