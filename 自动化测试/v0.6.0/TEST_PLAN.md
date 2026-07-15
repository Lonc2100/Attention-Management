# TEST_PLAN（v0.6.0）

## 范围

- v5→v6 设置迁移、首次引导、隐私排除规则。
- 应用数据备份/格式校验/恢复点/恢复、聚合 CSV、脱敏诊断。
- 未签名和无自动更新的明确产品表达。
- 新 profile 安装流程、既有 v5 数据升级与自启动回归。

## Unit / Integration（A）

- UT-601：v5 数据补 onboarding 与隐私规则默认值，不丢失成果项目关联。
- UT-602：应用/标题隐私排除规则只从派生分类中排除，不修改输入原始事件。
- UT-603：备份 envelope 校验、无效格式拒绝、恢复点创建、恢复后数据完整。
- UT-604：CSV 与诊断导出不含 title、cwd、thread id、project key、AI 文本。
- IT-601：所有 summary/details/AI/insights 走同一隐私规则输入。

## E2E（A/A+H）

- E2E-601：新 profile 显示并完成首次引导；断连状态不能假装完成。
- E2E-602：设置页可新增、停用、删除隐私规则。
- E2E-603：数据管理页显示备份/恢复/CSV/诊断边界与未签名更新政策。
- E2E-604：重启后 onboarding 和隐私规则持久化。
- H-601：全新 profile 的 packaged 安装完成一次引导、真实采集、计划与复盘；不替代真实外部用户可理解性验证。

## 门禁

Unit → typecheck → E2E 修复 → 连续两轮 E2E → package smoke → 新 profile → 真实 v5 升级 → 数据/自启动 → 文档/tag/push。
