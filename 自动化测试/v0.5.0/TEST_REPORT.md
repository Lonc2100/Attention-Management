# TEST_REPORT（v0.5.0）

## 结论

通过。成果—项目显式关联、当日成果证据、7/14/30 天个人规律与脱敏 AI 载荷已经接通；真实 v0.4.2 安装数据完成 v4→v5 升级，没有减少记录或 Codex 上下文日期。

## 自动化结果

| 层级 | 结果 | 证据 |
|---|---:|---|
| Unit / contract | 43 passed / 3 skipped | `npm test`；3 个真实外部链路集成测试继续由环境变量显式开启 |
| TypeScript | passed | 主进程、preload、shared 与 renderer 分项目 `--noEmit` 检查 |
| Production build | passed | `npm run build` |
| Electron E2E round 1 | 14 passed | 计划关联、首页证据、复盘证据、个人规律、真实 Codex CLI、采集暂停恢复与重启保持 |
| Electron E2E round 2 | 14 passed | 冻结代码后再次全流程通过 |
| Packaged smoke | passed | `release/win-unpacked` 主窗、内置 ActivityWatch v0.13.2 与诊断可用 |
| Installed autostart | passed | 真实安装版设置可删除并恢复 Windows Run 值，恢复值包含 `--hidden` |

## 关键断言

- 成果证据只计算 `kind=project` 且键显式关联的注意力；应用、AFK 与待分类均排除。
- 多个成果可以共享项目，但产品不存在跨成果总投入，避免重复计时伪装成总量。
- 少于 3 个合格复盘日时返回“样本不足”；输出对象没有 `productivityScore`。
- AI 载荷包含项目显示名与 `attentionMinutes`，不含项目键、thread id、cwd 或窗口/对话标题。
- v4 记录迁移后旧成果补 `projectKeys: []`，规则、覆盖、别名与手工项目结构均保留。

## 真实安装与数据

- 安装前：应用 `0.4.2.0`，数据 v4，2 个日期记录、2 个 Codex 上下文日期，自启动开启。
- 静默升级退出码 `0`；安装后应用 `0.5.0.0`。
- 首次真实启动后：数据迁移为 v5，仍为 2 个日期记录和 2 个 Codex 上下文日期；自启动仍开启并包含 `--hidden`。
- 最终安装包：`TimeEfficiency-0.5.0-Setup-x64.exe`，`188,662,620` 字节；首次从 `0.4.2.0` 升级后，又以同版本最终包完成一次覆盖安装验证。
- SHA-256：`F723CCD5F54F1F57814C9E6E62237F28555592BA230AAB3F8C3776BCBB58972B`。

## 已知边界

- 候选时段是结果、主观评分和已确认项目注意力的相关性摘要，不是因果推断。
- 历史 ActivityWatch 断连日显示为无采集，不会当作零效率。
- 安装包没有商业代码签名证书；v0.6 必须把签名状态与安全更新路径对外说明，不能把 electron-builder 的签名步骤日志误报为已签名。
