# TEST_REPORT（v0.4.1）

## 结论

通过。v0.4.1 的 P0 目标已满足：当前打开的 Codex 项目聊天覆盖最近交互顺序；当前界面不可确认时停止旧项目归属并进入待分类。

## 自动化结果

| 层级 | 结果 | 证据 |
|---|---:|---|
| Unit | 37 passed / 3 skipped | `npm test`；3 个真实链路测试默认按环境变量跳过 |
| Windows 当前聊天真实集成 | 1 passed | `RUN_CODEX_WINDOW_INTEGRATION=1`；读取当前 `codex work / ！！！libtv第三集` 并唯一映射 app-server 线程 |
| TypeScript | passed | `npm run typecheck` |
| Production build | passed | `npm run build` |
| Electron E2E round 1 | 12 passed | 采集、首页、活动明细、纠错/规则、悬浮窗、计划/复盘、CLI、暂停恢复、重启 |
| Electron E2E round 2 | 12 passed | 与第一轮相同，无波动 |
| Packaged smoke | passed | 内置 ActivityWatch v0.13.2、主窗与诊断可用 |
| Installed autostart | passed | Run 注册值可删除并恢复，包含 `--hidden` |

## P0 行为验证

- 最近交互为 A、当前可见聊天为 B：写入 B。
- 两个聊天同名：项目标签与 cwd 末级目录唯一匹配后才确认。
- 标题无候选、项目标签不匹配或仍有多个候选：返回未确认，不猜测。
- 上一采样为 A、下一采样界面不可读：不再写 A，`current` 清空。
- Chrome 前台、Codex AFK 或 ActivityWatch 数据过期：不启动 UIA、不写样本。
- 真实 Windows UIA 中文输出使用 UTF-8；空主窗口矩形不再阻断顶部栏识别。

## 安装与数据

- 已静默升级到 `0.4.1` 并重新以 `--hidden` 启动。
- 数据版本仍为 v4，无迁移。
- 升级前后保留：2 天记录、2 天 Codex 样本、1 条分类规则、1 条人工纠错。
- 安装包：`TimeEfficiency-0.4.1-Setup-x64.exe`
- 大小：`188,658,307` 字节
- SHA-256：`3E6BBD6885DDC1DC93541E1DCA87D164963C9F2C652083AD33C1398ED33E7403`

## 风险边界

Codex 官方 app-server 目前不提供桌面 selected-thread 字段，因此本版依赖 Windows 无障碍顶部栏名称。若未来 Codex 改动界面结构，系统会降级到待分类而不是沿用旧项目；官方接口出现后可替换 reader，不需修改存储。
