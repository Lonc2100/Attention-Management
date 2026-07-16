# v0.7.1 验证记录

- `npm test`：61 passed，3 skipped（显式集成环境测试）。
- `npm run typecheck`：通过。
- 冻结代码后连续两轮 `npm run test:e2e`：每轮 17 checks passed。
- 视觉尺寸：1440×900、1600×1000、1920×1080。
- 自动断言：状态栏高度 ≤64px；无页面横向溢出；宽屏热力图与圆环同排；首页不存在旧周期指标卡。
- 人工截图检查：顶部层级明显缩短，年度热力格完整显示，宽屏右侧由注意力圆环利用。
- 安装包 smoke：bundled ActivityWatch v0.13.2 与诊断页通过。
- 覆盖安装：`TimeEfficiency-0.7.1-Setup-x64.exe` 退出码 0；已安装 FileVersion 为 0.7.1。
- 数据保留：2026-07-14、2026-07-15、2026-07-16 三天记录保留；自启动仍开启；悬浮模式仍为 `always-on-top`。
- 安装包 SHA-256：`D150EA6AD9A9C31AE161371633E872B587F6FBED4068AC11532D5E3B91104E8D`。
- Authenticode：`NotSigned`，仍按未签名 Windows beta 表达。
