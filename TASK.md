# TASK — 真实时间效率助手 MVP

## Objective

在 Windows 上交付真实可安装的时间效率助手，打通 ActivityWatch 采集、早间计划、晚间复盘、Codex CLI 分析、自启动和补提醒。

## Definition of Done

- [x] 可安装/启动的 Windows 应用
- [x] ActivityWatch 真实窗口与 AFK 数据链路
- [x] 早间计划与晚间复盘持久化
- [x] Codex CLI 真实分析链路
- [x] 默认登录自启、托盘和开机补提醒
- [x] 自动测试与真实链路验收报告
- [x] 最终文件位于本地忽略目录 `artifacts/v0.1.0/`

## Constraints

- V1 仅 Windows；本地优先；不录屏、不记录键盘正文。
- 不以 AFK 直接推断低效率。
- 禁止伪造采集或 AI 结果。
- 禁止脚本批量删除文件或目录。
- 开发文件由 Trellis 管理。

## Progress

### Batch 1 — 基线与工程化

- [x] 技术环境审计
- [x] Trellis `electron-fullstack` + `tdd` 初始化
- [x] PRD、设计与实施计划落盘
- [x] Electron 工程与 ActivityWatch runtime

### Batch 2 — 核心闭环

- [x] 采集与聚合
- [x] 计划/复盘/AFK 补记
- [x] Codex CLI provider
- [x] 提醒、自启动、托盘

### Batch 3 — 验证与交付

- [x] 自动化测试
- [x] 真实 ActivityWatch/Codex 冒烟
- [x] Windows 打包
- [x] 使用说明与验收报告

## Final verification

- Unit tests: 5 passed; Codex integration: 1 passed when explicitly enabled.
- Background Electron E2E: 7 passed.
- Packaged smoke: passed with bundled ActivityWatch v0.13.2.
- Installer and portable artifacts generated separately; SHA-256 recorded in the output report.
- Manual follow-up: observe one natural AFK interval and one actual Windows reboot without manufacturing those events.

## Decisions

- 采用 Electron，避免当前机器缺少 Rust 对 Tauri 的阻塞，并匹配 Trellis 官方 Electron 模板。
- ActivityWatch 作为原始活动事实源；应用只保存业务数据与聚合/补记。
- 第一条 AI 通道使用机器上已登录的 Codex CLI，不强迫用户提供 API Key。
