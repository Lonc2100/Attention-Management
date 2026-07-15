# v0.6.0 Foundations

## Mature foundations used

- ActivityWatch 官方支持按 bucket 或全部 bucket 导出 JSON；本应用不复制其原始事件导出职责，改为备份自身业务数据，并清楚链接/说明边界。
- Super Productivity 的恢复路径采用显式 Import/Export，而不是隐式覆盖；本版采用格式校验 + 本地恢复点作为更保守版本。
- electron-builder 官方明确：无证书时构建会继续但产物可能未签名；`forceCodeSigning` 只能在有凭据的 CI 中启用。本版检测并展示 `NotSigned`，不配置证书、不启用自动更新。

## Sources

- https://docs.activitywatch.net/en/latest/features/exporting-data.html
- https://github.com/johannesjo/super-productivity/discussions/1227
- https://www.electron.build/docs/features/code-signing/
- https://www.electron.build/docs/features/code-signing/code-signing-win/

## Decisions

- 默认备份只覆盖助手自身 JSON，不打包可能含敏感标题的 ActivityWatch 原始 bucket。
- 聚合 CSV 和诊断包默认脱敏；完整原始活动应由用户在 ActivityWatch 本地界面自行导出。
- 代码签名与真实外部用户验证均为显式门禁，不用本机测试替代。
