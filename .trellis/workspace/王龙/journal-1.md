# Journal - 王龙 (Part 1)

> AI development session journal
> Started: 2026-07-14

---



## Session 1: Ship Codex project attention v0.2

**Date**: 2026-07-14
**Task**: Ship Codex project attention v0.2
**Branch**: `main`

### Summary

Implemented foreground and AFK gated Codex root-task attribution, conservative pending time, v1-to-v2 migration, project report UI, privacy-safe AI payload, Windows installer upgrade, and full verification.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `04cc754` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Release v0.3.1 compact linked dashboard

**Date**: 2026-07-15
**Task**: Release v0.3.1 compact linked dashboard
**Branch**: `main`

### Summary

Compressed the Today first viewport, added linked donut/legend/timeline tooltips, refined the floating widget, validated and installed v0.3.1.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b460a22` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Theme token foundation

**Date**: 2026-07-15
**Task**: Theme token foundation
**Branch**: `main`

### Summary

Established the renderer CSS token layer, semantic theme adoption, contract tests, full build and E2E verification.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8a5a6f8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Component governed page modules

**Date**: 2026-07-16
**Task**: Component governed page modules
**Branch**: `main`

### Summary

Established a finite renderer page-module API, migrated Personal Insights as the pilot, added token-only component styling and contract tests, stabilized E2E chart selection and isolated opt-in Codex CLI integration.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `881d51a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Editorial component guideline adoption

**Date**: 2026-07-16
**Task**: Editorial component guideline adoption
**Branch**: `main`

### Summary

Translated the GSAP-inspired editorial core into finite desktop UI tokens and components: five disciplines, Mori-first typography, curly annotations, outlined pill actions, hairline dividers, and a visually verified Personal Insights pilot.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `20c3853` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: v0.7.0 首页工作活动与安静悬浮胶囊

**Date**: 2026-07-16
**Task**: v0.7.0 首页工作活动与安静悬浮胶囊
**Branch**: `main`

### Summary

完成近一年每日/每周/每月工作活动、周期成果指标、小尺寸悬浮窗、双轮 E2E、NSIS 打包与 v0.6.2 到 v0.7.0 真实升级验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `261d9e2` | (see git log) |
| `a79fd36` | (see git log) |
| `b0a4d2f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: v0.7.2 collector reliability hotfix

**Date**: 2026-07-17
**Task**: v0.7.2 collector reliability hotfix
**Branch**: `main`

### Summary

修复 ActivityWatch stdout 背压和全年查询压力，增加派生缓存、事件新鲜度、磁盘保护、受控恢复与故障注入验证；完成 73 项测试、两轮 E2E、打包 smoke、真实升级安装、自启动验证及 15 分钟 soak。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ee7691f` | (see git log) |
| `88c3f4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: v0.7.3 跨午夜工作日边界

**Date**: 2026-07-19
**Task**: v0.7.3 workday boundary
**Branch**: `main`

### Summary

跨午夜连续活动改归开始工作日，主要休息后的首次返回开启新工作日；白天后续长离开不重复切日。增加最晚离开电脑、人工边界纠正、断连回退和实时 AFK 分离。

### Git Commits

| Hash | Message |
|------|---------|
| `39b1f12` | feat: add cross-midnight workday boundaries |

### Testing

- 80 项自动化测试通过；3 项外部 Codex 集成测试按设计跳过。
- 连续两轮 Electron E2E 各 17 项通过；安装包 smoke 通过。
- 真实 v0.7.2/schema 6 → v0.7.3/schema 7 覆盖升级完成，数据与自启动保留。

### Status

[OK] **Completed**

### Next Steps

- 在日常使用中观察 6 小时默认主要休息阈值；误判可在活动明细中人工调整并反馈。


## Session 9: v0.7.4 低交互时间与统一统计口径

**Date**: 2026-07-19
**Task**: v0.7.4 idle confidence
**Branch**: `main`

### Summary

把短暂无键鼠输入从“确定离开”改为可解释的低交互推定工作，默认以 15 分钟区分主要离开；所有统计入口统一口径，并支持逐段人工计入和撤销。

### Main Changes

- 增加统一 idle policy、schema v8、缓存 policy key、阈值设置和可逆 idle override。
- 首页、活动明细、全年工作活动、个人规律和 Codex 项目使用同一 Query API 数据流。
- 保留用户确认的午饭主要离开，恢复约 1 小时 9 分的短时低交互投入。
- 增加 ActivityWatch AFK 桶缺失时保留窗口数据的降级路径，避免错误归零。

### Git Commits

| Hash | Message |
|------|---------|
| `8af2cab` | fix: correct low-interaction work time |

### Testing

- 84 项自动化测试通过；3 项外部 Codex 集成测试按设计跳过。
- 冻结代码后连续两轮 Electron E2E 各 17 项通过；安装包 smoke 通过。
- 真实 v0.7.3/schema 7 → v0.7.4/schema 8 覆盖升级完成，6 个记录日、4 个上下文日和登录自启动均保留。

### Status

[OK] **Completed**

### Next Steps

- 在日常使用中观察默认 15 分钟阈值；主要离开误判可在活动明细中逐段纠正。
