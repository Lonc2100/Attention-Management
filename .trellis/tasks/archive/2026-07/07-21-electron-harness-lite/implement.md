# Electron Harness-lite 实施计划

1. 冻结基线：记录现有目录、测试、类型检查与 Git 状态。
2. 新增真实架构和最小 Context Pack，扩展根 `AGENTS.md` 的读取顺序与验证门。
3. 从绿色项目初始化器抽取安全 manifest/dry-run/refuse-overwrite 模式，实现 Electron 增量采用器。
4. 实现 Electron 架构 lint、结构测试及反例 fixture 测试。
5. 接入 package scripts 与统一 `npm run verify`。
6. 依次运行生成器 dry-run、Harness tests、完整 verify，并进行 diff/敏感信息/产品行为复审。
7. 更新 Trellis 任务记录并提交。

## 回滚点

所有新增治理文件可逐文件移除；package 与 AGENTS 修改是唯一既有文件改动。本次不迁移源代码，因此不会触碰用户数据或运行时格式。
