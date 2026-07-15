# v0.6.0 Technical Design

## Data model

- Settings 增加 `onboardingCompletedAt` 与可逆 `privacyRules`（id、kind、pattern、enabled、createdAt）。
- 存储升级为 JSON v6，v5 数据通过附加默认字段迁移。
- 备份格式是显式 envelope：`format`、`createdAt`、`appVersion`、`data`；恢复只接受允许字段并验证版本范围。

## Privacy pipeline

`ActivityWatch raw events -> existing classification -> privacy filter -> UI / evidence / insights / AI / exports`。

过滤不能写回 ActivityWatch，也不影响本机原始 bucket。过滤后的 summary 必须保持互斥叶子和总量守恒；被过滤时间在产品中标为“隐私排除”，不自动归入 AFK 或项目。

## Backup and recovery

- 主进程拥有 backup service；渲染进程只调用 typed IPC。
- 导出和诊断采用 native save dialog；恢复采用 native open dialog。
- 写入恢复前先将当前 app JSON 原子复制到 `userData/recovery/`，只保留少量最近恢复点；v0.6 不做自动清理以免误删用户文件。
- 恢复完成后重新加载 store，页面提示应用重启；回退由选择恢复点执行。

## Verification boundary

- 单元测试使用临时目录验证 envelope、脱敏 CSV/diagnostics、restore checkpoint 和 v5→v6。
- Electron E2E 覆盖 onboarding、排除规则状态、设置安全文案与恢复 UI 可达性。
- packaged smoke + real upgrade 验证 v5 数据保留、自启动与诊断。
- 无证书时只生成 hash-verified installer，不启用自动更新，也不作公开可信发布主张。
