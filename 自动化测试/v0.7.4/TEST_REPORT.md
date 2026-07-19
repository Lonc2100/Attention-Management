# v0.7.4 测试报告

日期：2026-07-19

## 自动化门禁

- `npm test`：84 项通过；3 项需要显式外部 Codex 环境的集成测试按设计跳过。
- `npm run typecheck`：Node 与 Web 类型检查通过。
- `npm run build`：主进程、preload 和 renderer 生产构建通过。
- 冻结应用代码后连续两轮 `npm run test:e2e`：每轮 17 项通过。
- 增补主要离开人工计入/撤销流程后再次运行 E2E：17 项通过。

## 关键行为验证

- 14 分钟 AFK 进入低交互推定工作；15 分钟 AFK 进入主要离开。
- 低交互时间继续保留前台应用、Codex 项目和时间线归属。
- 主要离开仍从投入中排除，可逐段人工计入并撤销；原始事件对象保持不变。
- 阈值只接受 5/10/15/20/30 分钟，旧设置默认迁移为 15 分钟。
- schema v7 → v8 保存 idle policy 与人工覆盖；派生缓存 policy key 变化后安全重建。
- 首页、活动明细和每日工作事实使用同一 Query API 数据流，总量守恒。

## 真实数据对账

- 工作日范围：2026-07-19 09:42–15:59。
- 原始前台窗口覆盖：22,460 秒。
- 旧 3 分钟 AFK 口径：16,028 秒。
- 新 15 分钟口径：20,166 秒，恢复 4,138 秒（约 1 小时 9 分）低交互时间。
- 仍排除两段主要离开，合计 2,293 秒（约 38 分）；用户确认中间确实有吃饭离开。

## 打包与真实升级

- `npm run dist` 全门禁通过。
- 安装包：`release/TimeEfficiency-0.7.4-Setup-x64.exe`。
- win-unpacked 独立启动 smoke：版本 0.7.4、主窗口与悬浮窗均创建，采集状态可读取。
- NSIS 静默覆盖安装退出码 0；安装后 FileVersion 为 0.7.4。
- 应用数据由 schema 7 迁移到 schema 8；6 个记录日、4 个 Codex 上下文日、tracking=true 保留。
- `idleThresholdMinutes=15`；Windows Run 值保留并继续以 `--hidden` 启动。
- ActivityWatch server/window/AFK 三个进程恢复；升级后事件持续写入。
- SHA-256：`39381129CDA27B23B4BBFA47D88B62A0568CD251C3619C7A400380D88D3D4916`。
- Authenticode：`NotSigned`，因此仍是未签名 Windows 本地 beta，不宣传为可信正式发布。

## 结论

v0.7.4 达到自用发布门槛。它显著修正短暂无输入造成的低估，同时保留真正吃饭离开的时间；所有推定均可解释、配置和人工纠正。
