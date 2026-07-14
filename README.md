# Attention Management（时间效率助手）

面向 Windows 的本地优先时间效率助手。它把 ActivityWatch 的真实电脑活动、每日早间计划、晚间复盘和 Codex CLI 分析连接成一个可运行的个人工作闭环。

当前版本为 `v0.1.0` MVP，已完成 Windows 安装包与真实链路验收，不是纯界面原型。

## 已实现

- 记录前台应用、窗口标题和 AFK（离开电脑）状态
- 每日填写 1–3 个重要成果，并指定唯一绝对优先项
- 晚间确认成果、主观效率和线下活动补记
- 使用本机 Codex CLI 生成复盘建议，不强制提供 API Key
- 默认随 Windows 登录启动，可在设置中关闭
- 关闭主窗口后留在系统托盘继续工作
- 电脑关机期间不执行提醒，下次启动时补提醒

## 隐私边界

- 本地优先，不录屏，不采集键盘输入正文
- ActivityWatch 原始事件保存在本机，可能包含前台窗口标题
- AI 只接收聚合分钟数、成果文字、成果状态、主观评分和主动补记，不发送完整窗口标题流水
- AFK 只说明用户离开电脑，不会自动判定为低效率

## 本地开发

环境：Windows x64、Node.js、npm。

```powershell
npm install
npm run setup:activitywatch
npm run dev
```

常用验证与构建命令：

```powershell
npm test
npm run typecheck
npm run test:e2e
npm run dist
```

`setup:activitywatch` 会准备 ActivityWatch v0.13.2 本地运行时。运行时、依赖、构建目录和安装包均被 `.gitignore` 排除，不提交到仓库。

## 项目管理与文档

- Trellis 配置与任务：`.trellis/`
- 当前交付目标与验收状态：`TASK.md`
- 第三方声明：`THIRD_PARTY_NOTICES.md`
- ActivityWatch 许可证副本：`licenses/activitywatch-LICENSE.txt`

本项目代码采用 MIT License。内置的 ActivityWatch 仍遵循其自己的 Mozilla Public License 2.0。

