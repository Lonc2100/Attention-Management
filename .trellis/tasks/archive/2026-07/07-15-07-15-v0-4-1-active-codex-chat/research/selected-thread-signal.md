# 当前选中 Codex 聊天信号调研（2026-07-15）

## 官方协议

- 本机 Codex CLI：`codex-cli 0.144.1`。
- 使用 `codex app-server generate-json-schema --experimental` 生成并检索完整协议。
- `thread/list` 暴露线程、状态和 `recencyAt`，但没有桌面端当前 selected/open thread 字段。
- `ThreadActiveFlag` 表示 agent 线程运行/活跃状态，不是用户在桌面 UI 中选中了哪个聊天。

结论：不能继续把 `recencyAt` 或 agent active status 当作用户当前注意力。

## Windows 可用信号

Windows UI Automation 对 Codex 桌面窗口暴露：

- 文档：`RootWebArea`，名称 `Codex`；
- 顶部项目按钮：无障碍名称 `项目：<项目名>`；
- 顶部当前聊天标题：与项目按钮同一行的文本元素。

该信号在只打开聊天、尚未发送消息时就发生变化，符合产品边界。它不需要录屏、OCR、鼠标控制或读取聊天正文。

## 决策

v0.4.1 使用 UI Automation 读取“当前可见界面”，使用 app-server 列表映射稳定线程身份。映射不唯一时不使用最近交互猜测，转为待分类。
