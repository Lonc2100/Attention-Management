# v0.6.0 测试报告

## 自动化

- Unit：47 passed，3 skipped（显式外部集成测试）。
- TypeScript：node + web `typecheck` passed。
- E2E：两轮通过；最终新 profile 轮次 16 checks passed，覆盖首次引导、隐私规则增删/启停、悬浮窗、计划/成果证据、复盘、个人规律、Codex CLI、暂停/恢复、诊断与重启持久化。
- 打包：`npm run dist` passed。
- Packaged smoke：passed（内置 ActivityWatch 与诊断可用）。
- 已安装应用自启动：passed；禁用后 Run 值消失，恢复后含 `--hidden`。

## 数据与升级

- 升级前：schema v5，records 1，context days 1，登录自启 true。
- 真实静默升级后：schema v6，records 1，context days 1，登录自启 true，隐私规则默认空。
- 新 schema 增加 `settings.onboardingCompletedAt` 与 `privacyRules`；原计划、复盘、上下文、归类规则和人工纠错均按迁移保留。
- 恢复单测验证：格式无效拒绝，替换前生成恢复点，恢复后的 v6 设置与数据可读。

## 已知边界

- 安装包真实性检测为 `NotSigned`；没有证书、没有自动更新、没有公开发布声明。
- 无法以本机自动化替代真实外部 Windows 用户的理解性测试；此项留给 v1.0.0 发布门禁。
- E2E 截图仅作非阻塞工件，某次字体等待超时不影响 16 项功能断言。
