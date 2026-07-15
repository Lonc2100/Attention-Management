# 技术设计

## 现状与根因

`CodexContextTracker` 在 Codex 前台且非 AFK 时直接取 `thread/list` 按 `recency_at` 排序后的第一项。该字段只在用户发起新交互时更新，静默点开另一个聊天不会更新，所以旧项目会持续被误计。

## 数据流

```text
ActivityWatch（Codex 前台 + 非 AFK）
        |
        v
Windows UI Automation（顶部项目标签 + 当前聊天标题）
        |
        v
Codex app-server thread/list（稳定线程 ID + cwd + recencyAt）
        |
        v
唯一匹配 -> 写入项目样本
无/多匹配 -> 当前上下文未确认，不写旧项目样本
```

## 接口边界

- 新增 `CodexWindowContextReader.readCurrentContext(): Promise<{ threadName: string; projectLabel: string | null } | null>`。
- `ThreadReader` 仍返回桌面根线程列表，但不承诺第一项就是当前项。
- 新增纯函数 `matchVisibleCodexThread(visible, threads)`，负责规范化名称、项目标签与 cwd 末级目录，只有唯一候选才返回。
- `CodexContextTracker` 注入界面读取器，先读当前界面，再列表映射；任何不确定状态都把 `current` 清空。

## Windows 检测

调用 Windows 自带 PowerShell 和 UI Automation API，只读寻找包含 `RootWebArea` 且文档名称为 `Codex` 的主窗口。在顶部项目按钮附近读取当前聊天标题：

- 项目按钮无障碍名称形如 `项目：codex work`；
- 当前聊天标题是同一顶部栏、项目按钮右侧最近的非空文本；
- 输出一行 JSON，不输出聊天正文或完整无障碍树；
- 子进程隐藏窗口并设置短超时，避免拖住 5 秒采样循环。

## 匹配与降级

1. 标题必须精确匹配（Unicode 规范化、去除首尾空白）。
2. 若标题只有一个候选，直接确认。
3. 若标题有多个候选且有项目标签，只保留 cwd 末级目录与标签匹配的候选。
4. 仍非唯一则返回 `null`，不以 `recencyAt` 猜测。
5. UIA 不可用、Codex 界面结构改变或主窗口不存在时，返回“当前聊天未确认”，不会沿用旧状态。

## 兼容性与风险

- Windows UI Automation 是系统稳定接口，但 Codex 顶部栏的无障碍名称属于产品界面，未来可能变化；纯函数和脚本解析均需独立测试。
- 每 5 秒创建一次 PowerShell 进程有固定开销；检测只在 Codex 活跃前台执行，并设置 2 秒超时。后续如 Codex 官方提供 selected-thread API，可替换 reader 而无需改 tracker/存储。
- 数据 schema 保持 v4，回滚到 v0.4.0 不需要数据降级。
