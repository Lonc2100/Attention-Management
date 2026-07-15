# TEST_REPORT（v0.4.0）

## 1. 结果摘要

- 日期：2026-07-15
- PRD：`.trellis/tasks/07-15-v0-4-0-activity-details/prd.md`
- 结论：PASS

## 2. 已执行命令与结果

- `npm test`：30 passed，2 skipped（真实环境集成项默认跳过）。
- `npm run typecheck`：PASS。
- `npm run build`：PASS。
- `npm run test:e2e`：修正测试命中方式后连续两轮 12/12 PASS，含纠错与规则学习完整可逆链路。
- `npm run dist`：PASS，生成 Windows x64 NSIS 安装包。
- `node tests/packaged-smoke.mjs`：PASS，内置 ActivityWatch v0.13.2 和诊断可用。
- `node tests/installed-autostart.mjs`：PASS，自启动注册项可删除并恢复。
- 真实用户数据升级：v3 → v4，2 天记录和 2 天 Codex 样本保留。

## 3. 分层覆盖结果

- Unit：30 passed / 30 enabled。
- Integration：类型检查、生产构建、真实 ActivityWatch、打包态和安装态全部通过。
- E2E：12 passed / 12。

## 4. 失败与修复

- 初始红测：v4 存储 API 不存在；实现迁移和 CRUD 后通过。
- 初始红测：分类引擎模块不存在；实现优先级、边界切分和 AFK 扣除后通过。
- 现有迁移断言仍期望版本 3；更新为版本 4 并验证旧数据保留后通过。
- 圆环 E2E 曾用物理坐标命中极窄扇段，随真实数据比例偶发失败；改为键盘聚焦扇段验证同一联动状态，时间轴继续保留真实指针悬浮验证，随后连续两轮通过。该问题属于测试选择器，不是产品功能故障。

## 5. 剩余风险（人工补测）

- 长期规则准确率需在真实日常使用中观察，自动化只能验证确定性匹配语义。
- 大量数秒级 ActivityWatch 事件的阅读密度可继续结合真实使用优化。
- 多显示器拔插、睡眠唤醒和数日连续运行仍需设备观察。

## 6. 发布门禁

- 功能/回归门禁：PASS。
- 打包/安装门禁：PASS。
- 安装包：`artifacts/v0.4.0/TimeEfficiency-0.4.0-Setup-x64.exe`
- 大小：188,656,779 bytes。
- SHA-256：`CA89272D925287A7092732287AA4B5934296491DD8AD352946806CBA5B690441`
- 最终决策：允许发布 v0.4.0。
