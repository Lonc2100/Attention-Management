# TASK — 时间效率助手 v0.4

## Objective

在 Windows 上交付可检查、可纠正、会学习的本地注意力账本；活动明细、首页汇总与悬浮窗必须共享同一套可信归类结果。

## Definition of Done

- [x] 可安装/启动的 Windows 应用
- [x] ActivityWatch 真实窗口与 AFK 数据链路
- [x] 早间计划与晚间复盘持久化
- [x] Codex CLI 真实分析链路
- [x] 默认登录自启、托盘和开机补提醒
- [x] 自动测试与真实链路验收报告
- [x] Codex 前台注意力自动按根任务/对话分类，无需手动切换
- [x] 分类覆盖率、待分类、项目别名和 AI 隐私边界
- [x] 旧版最终文件保留在本地忽略目录 `artifacts/v0.2.0/`
- [x] 首页数据与计划、复盘严格分离
- [x] 统一分母圆环满足叶子时间总量守恒
- [x] 项目化时间轴聚焦实际活动范围
- [x] 独立悬浮窗支持折叠、置顶/桌面模式、隐藏恢复和位置持久化
- [x] 最终安装包位于 `artifacts/v0.3.0/`
- [x] 独立活动明细页与日期时间流
- [x] 原始应用/标题/来源证据抽屉
- [x] 可撤销的人工区间纠错与自定义项目
- [x] 未来生效、可排序/启停/删除的归类规则
- [x] v3 → v4 数据无损迁移与统一分类引擎
- [x] 最终安装包位于 `artifacts/v0.4.0/`
- [ ] v0.3.0 GitHub Release

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

### Batch 4 — v0.2 项目注意力

- [x] 官方 Codex app-server 上下文读取与运行时校验
- [x] 仅前台、非 AFK 的稀疏上下文采样
- [x] 项目聚合、保守待分类、v1 → v2 数据迁移
- [x] 当前上下文、项目报告、覆盖率、应用内名称/AFK 编辑
- [x] AI 项目聚合与原始任务信息隔离测试

### Batch 5 — v0.3 注意力驾驶舱

- [x] 时间轴叶子契约、项目拆分和总量守恒
- [x] 统一分母圆环、紧凑指标与项目/应用明细
- [x] 实际记录区间时间轴与真实归属状态
- [x] 独立悬浮专注窗与窗口生命周期
- [x] v2 → v3 设置迁移和多显示器失效回退
- [x] 主流程、悬浮窗与 Codex CLI 端到端回归

### Batch 6 — v0.4 活动明细与纠错

- [x] 三栏调查工作台与全状态设计
- [x] 完整日期活动读取、筛选、联动时间线与证据抽屉
- [x] 人工纠错、撤销和自定义项目
- [x] 保守的未来规则学习、冲突优先级和规则管理
- [x] 首页、悬浮窗和活动明细共用分类结果
- [x] 纠错与规则创建/删除 Electron 端到端回归

## Final verification

- Unit tests: 30 passed，2 个真实 Codex 集成场景默认跳过。
- Electron E2E: 修正测试命中方式后连续两轮 12 项通过；含活动明细、纠错、规则创建/删除、撤销、1440×900 与 1600×1000 无横向溢出检查。
- Packaged smoke: passed with bundled ActivityWatch v0.13.2.
- NSIS installer: 188,656,779 bytes；SHA-256 `CA89272D925287A7092732287AA4B5934296491DD8AD352946806CBA5B690441`。
- Installed upgrade and Windows autostart toggle: passed；真实用户数据 v3 → v4，原 2 天记录与 2 天 Codex 样本保留。
- Manual follow-up: 在真实第二块显示器上补一次拔插回退观察。

## Decisions

- 采用 Electron，避免当前机器缺少 Rust 对 Tauri 的阻塞，并匹配 Trellis 官方 Electron 模板。
- ActivityWatch 作为原始活动事实源；应用只保存业务数据与聚合/补记。
- 第一条 AI 通道使用机器上已登录的 Codex CLI，不强迫用户提供 API Key。
- ActivityWatch 决定“是否属于用户注意力”，官方 Codex app-server 决定“当前属于哪个根任务/对话”。
- 没有可信样本的时间必须进入“待分类”，不能用最新任务倒推历史。
- 首页图表只使用互斥叶子切片；Codex 父级只作说明，不重复进入圆环分母。
- “最近确认”只提供上下文提示，离开 Codex 后不继续累加为已确认项目时间。
