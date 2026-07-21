# Electron Harness Lite 增量治理

## Goal

在不改变时间采集、项目归属、数据存储和 UI 行为的前提下，为现有 Electron 应用接入一个可执行、可增量采用的 Harness-lite，使 AI 和开发者能够快速理解真实架构，并在提交前自动阻止跨层依赖与上下文漂移。

## Requirements

- 以 `D:\codex work\desk work\scripts\init-harness-project.mjs` 为思想母版，但不得引入 Next.js、Next API Route、Canvas 或其他 Desk Work 业务代码。
- 面向现有非空仓库增量采用；初始化器必须支持 `--dry-run`，不得删除文件，不得静默覆盖已有文件。
- 明确并检查 Electron 的 `main -> preload/IPC -> renderer` 安全边界，以及 `shared` 的平台无关边界。
- 把 ActivityWatch、Codex、Windows/文件系统视为外部 Provider，业务规则保持在可测试的 shared/service 层。
- Trellis 继续作为任务、PRD、版本与执行记录的唯一来源；Harness Context Pack 只维护架构入口与当前工程状态，不复制 PRD 台账。
- 提供统一、快速的 `npm run verify`，覆盖 Context、架构、结构、类型、单元测试与构建。
- 本次不拆分现有大型文件，不更改 AFK 阈值，不修复 Codex 侧边栏识别，不改变发布版本号。

## Acceptance Criteria

- [x] `init:electron-harness-lite --dry-run` 可在当前非空仓库预览增量文件，不产生写入。
- [x] 初始化器在目标文件冲突时拒绝写入，并且不存在删除或强制覆盖入口。
- [x] `ARCHITECTURE.md` 描述当前 Electron、ActivityWatch、IPC、存储和 UI 的真实依赖方向。
- [x] `context:check`、`lint:arch`、`test:structure` 均通过，并能针对故意构造的越界样例失败。
- [x] `npm run verify` 通过：Harness 检查、TypeScript、84 个既有单元测试及生产构建均成功。
- [x] Git diff 不包含产品行为、真实数据或安装包变化。

## Notes

- 这是工程治理版本，不是产品功能版本。
- 验收记录见 `validation.md`。3 个需真实 Codex 环境的 integration tests 仍为 skipped，未被误报为已验证。
