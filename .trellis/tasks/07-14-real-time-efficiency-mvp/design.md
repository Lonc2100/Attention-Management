# 技术设计

## 架构

- Electron + React + TypeScript：Windows 桌面壳、托盘、通知、自启动与设置。
- ActivityWatch 0.13.2 portable：本地 `aw-server`、`aw-watcher-window`、`aw-watcher-afk`，REST API 作为唯一活动事实源。
- 本地 JSON 仓库：仅保存计划、复盘、AFK 补记、设置和阶段完成状态；原始活动事件留在 ActivityWatch。
- Codex CLI provider：主进程启动 `codex exec --ephemeral --sandbox read-only --json`，解析 JSONL 中的最终 agent message。

## 进程与边界

渲染进程不接触 Node。所有系统能力经 `preload` 暴露的窄 IPC API 调用。主进程负责 ActivityWatch 生命周期、HTTP 查询、文件写入、Codex 子进程、自启动、托盘与通知。

ActivityWatch 数据路径放在 Electron `userData/activitywatch`，避免依赖源码目录写权限。打包后从 `resources/activitywatch` 启动；开发态从项目 `runtime/activitywatch` 启动。

## 数据模型

- `DailyRecord`: date, outcomes[1..3], priorityOutcomeId, planCompletedAt, review, afkNotes。
- `Review`: outcomeStatuses, subjectiveScore, summary, tomorrowIntent, completedAt。
- `Settings`: launchAtLogin=true, morningReminder, eveningReminder, trackingEnabled=true, aiProvider=codex-cli。

写入采用临时文件 + rename 的原子替换；加载时执行运行时校验和默认值合并。

## 活动聚合

按本机日期范围读取窗口桶与 AFK 桶。窗口事件按 app 聚合，裁剪到查询边界；AFK 事件转换为离开区间。专注块以非 AFK 且相邻窗口活动间隔不超过阈值进行组合。隐私处理在发送 AI 前执行：窗口标题只保留按应用聚合结果和用户显式选择的成果文字。

## 提醒语义

应用运行时按设置时间检查。启动时同样检查本地日期与阶段完成状态：已过早间时间且未做计划则补提醒；已过晚间时间且未复盘则补提醒。关机时不承诺定时执行。

## 失败策略

- ActivityWatch 未就绪：显示“未连接”，自动重试并提供诊断，不展示虚假时间线。
- Codex CLI 未安装/未登录/超时：保存复盘不受影响，AI 区域显示明确错误与重试入口。
- 数据损坏：保留损坏文件并启用安全默认值，不覆盖原文件。
