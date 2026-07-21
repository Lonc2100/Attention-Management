# Electron Harness-lite 技术设计

## 决策

采用“增量约束”而不是“目录大迁移”。现有 `src/main`、`src/preload`、`src/renderer`、`src/shared` 保持不动，先让真实边界可读、可检查、可验收。

## 固定依赖方向

```text
Shared Types / Pure Rules
          ↓
Main Providers + Repositories
          ↓
Main Application Services
          ↓
Electron Runtime / IPC / Bootstrap
          ↓ contextBridge
Renderer UI
```

- `shared` 不依赖 Electron、Node 或任何进程目录。
- `renderer` 不依赖 `main`、`preload`、Electron、Node 内建模块，不直接 `fetch` ActivityWatch。
- `preload` 只依赖 Electron 和 shared contracts，不依赖 main/renderer。
- `main` 可以依赖 shared，但不依赖 renderer/preload。
- 当前尚未完成 providers/services/ipc 物理拆分，因此本轮只建立目录边界与未来目录的细粒度约束，不对旧文件制造假失败。

## 生成器

`scripts/init-electron-harness-lite.mjs` 是可复用的增量采用器：

- 支持 `--target` 与 `--dry-run`。
- manifest 只包含 Harness-lite 治理文件，不生成业务占位模块。
- 非 dry-run 仅在文件全部不存在时写入；任何冲突都整体拒绝。
- 无 `--force`、无删除逻辑。

## 验证

- `context-check.mjs`：入口文档与固定路线存在且一致。
- `electron-harness-lint.mjs`：解析 import/export/require/dynamic import，检查进程与分层边界。
- `harness-structure.test.mjs`：检查必要目录、IPC contract、脚本和 package gates。
- `electron-harness-lint.test.mjs`：用隔离 fixture 证明规则能抓到违规，而非只在当前代码上绿灯。
- `npm run verify`：快速、确定性、无真实外部调用。

## 不采用

- 不引入 Next.js。
- 不为每个小功能强制生成七层空目录。
- 不复制 Trellis PRD/计划/版本台账。
- 不把 E2E、安装器或真实 ActivityWatch 检查塞进每次快速验证。
