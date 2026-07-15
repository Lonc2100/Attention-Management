# TEST_REPORT（v0.4.2）

## 结论

通过。方案 A 已落地：悬浮提示固定在目标附近，同一目标内部移动不再驱动整页 React 状态更新；圆环、图例和时间轴的项目联动高亮保留。

## 自动化结果

| 层级 | 结果 | 证据 |
|---|---:|---|
| Unit | 37 passed / 3 skipped | `npm test`；3 个需显式环境变量的真实链路集成测试默认跳过 |
| TypeScript | passed | `npm run typecheck` |
| Production build | passed | `npm run build` |
| Electron E2E round 1 | 12 passed | 新增固定锚点、联动高亮、无高开销滤镜断言；全流程通过 |
| Electron E2E round 2 | 12 passed | 版本更新后再次执行，无波动 |
| Packaged smoke | passed | 内置 ActivityWatch v0.13.2、主窗与诊断可用 |
| Installed autostart | passed | Run 注册值可删除并恢复，包含 `--hidden` |

## 性能修正验证

- 圆环、图例和每个时间块只在 `mouseenter` 或键盘 `focus` 时更新提示，不再绑定 `mousemove`。
- 在同一时间块 30% 与 70% 位置移动鼠标，提示卡 x/y 坐标差均小于 1px。
- 联动目标不少于两个，项目检查语义没有因性能修正退化。
- 时间轴弱化项的计算样式 `filter: none`；提示卡的 `backdrop-filter: none`。
- 提示卡按目标矩形选择右、左、下、上位置，并以 12px 安全边距限制在窗口内。

## 安装与数据

- 已静默升级到 `0.4.2` 并重新以 `--hidden` 启动。
- 可执行文件版本为 `0.4.2`，数据版本仍为 v4，无迁移。
- 升级前后保留：2 天记录、1 条人工纠错；分类规则数量保持为 0。
- Windows Run 自启动值存在并包含 `--hidden`。
- 安装包：`TimeEfficiency-0.4.2-Setup-x64.exe`
- 大小：`188,658,343` 字节
- SHA-256：`57F5128C64237965FE917EA596ED113064DD567057E4A8F16856B8C0FAB7735E`

## 风险边界

本版通过消除连续状态更新和高开销绘制效果解决主要卡顿来源；没有引入浏览器级帧率遥测。若后续在超长时间轴上仍有卡顿，应先采集真实渲染性能记录，再决定是否虚拟化时间块。
