# Codex 侧边栏归属与 AFK 默认校准

## Goal

让用户在 Codex Desktop 的项目侧边栏内提问或切换聊天时，时间能可靠归属到当前可见项目；并将新安装用户的“主要离开电脑”默认判定校准为 5 分钟，同时不改变已有用户的选择。

## Requirements

- 先记录真实 Windows UI Automation 与 Codex app-server 的当前基线；不猜测侧边栏失败原因。
- 把 Codex 可见聊天读取抽取为 Provider，把“前台活动 + 可见上下文 + app-server thread 映射 + 持久化样本”保留在独立 Service。
- Windows UI Automation 必须同时支持顶部项目条和侧边栏项目/对话结构；仅读取可访问性名称、边界框和当前前台窗口，不截图、不录屏、不读取输入正文、不点击 UI。
- 可见聊天无法唯一映射时，保持待分类，禁止用“最近活跃线程”猜测。
- 默认阈值从 15 调到 5 分钟；已有本地 settings 中的有效值必须原样保留。
- UI 文案与测试必须反映“默认 5 分钟适合当前用户阅读通常不超过 3 分钟”的理由，不承诺 AFK 等于真实离开。
- 此版本不修改历史活动数据；新阈值仅影响后续重新聚合/采集显示，用户仍可对 AFK 段人工计入。

## Acceptance Criteria

- [x] Windows 可见上下文 Provider 的纯解析和映射测试覆盖顶部条、侧边栏及歧义拒绝。
- [x] 归属 Service 的测试覆盖前台、AFK、可见聊天切换、provider 失败和待分类降级。
- [x] Harness 结构检查验证新 Provider/Service 的方向，并且旧入口保持兼容。
- [x] 空 settings / 新安装默认值为 5；旧 settings 里的有效 15 分钟值保持不变。
- [x] `npm run verify`、`npm run test:e2e` 均通过。
- [x] 在真实 Windows + 当前 Codex Desktop 环境执行可见聊天集成检查；UI Automation 无法读取侧边栏，已记录真实证据并在该验证闸门停止，不虚报修复成功。

## Notes

- 真实验证需要用户在 Codex Desktop 中打开一个已知项目聊天；不要求发送消息。
- 当前结论：代码与 AFK 校准可交付，但当前 Codex Desktop 自动侧边栏归属仍被外部可访问性信号阻塞。
