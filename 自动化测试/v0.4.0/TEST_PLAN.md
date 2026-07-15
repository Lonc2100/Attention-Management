# TEST_PLAN（v0.4.0）

## 1. 测试范围

- PRD：`.trellis/tasks/07-15-v0-4-0-activity-details/prd.md`
- 范围内：v4 存储迁移、统一分类优先级、AFK 扣除、未来规则、活动明细、证据抽屉、人工纠错/撤销、规则创建/排序/启停/删除、首页/悬浮窗回归、打包和安装升级。
- 非范围：AI 自动分类、正则编辑、批量历史重算、项目合并、macOS、视觉偏好的长期真人使用评价。

## 2. 完成门槛

1. 计划内自动化用例全部通过。
2. P0 用例通过率 100%。
3. 核心 Electron E2E 连续两轮稳定通过。
4. 无阻断或严重缺陷遗留。
5. 打包态、安装态和 Windows 自启动验证通过。

## 3. 用例清单

### Unit（A）

- UT-01：v1/v2/v3 数据迁移为 v4，原设置、记录、Codex 样本和别名不丢失。
- UT-02：规则、覆盖和自定义项目持久化；规则排序、启停、删除与纠错撤销正确。
- UT-03：人工纠错 > 第一条启用规则 > Codex 上下文 > 应用/待分类。
- UT-04：规则只从 `appliesFrom` 生效，禁用规则不匹配，第一条规则优先。
- UT-05：AFK 从活跃时间扣除并以不可纠错证据保留。
- UT-06：现有 Codex 拆分、总量守恒、隐私、日期、悬浮窗几何等主回归不退化。

### Integration（A）

- IT-01：共享合同、preload、IPC 和主进程通过 TypeScript 类型检查。
- IT-02：生产 renderer/main/preload 构建成功。
- IT-03：ActivityWatch 真实数据能生成日期活动明细和首页同源汇总。
- IT-04：打包应用能启动并读取内置 ActivityWatch v0.13.2。

### E2E（A）

- E2E-01：活动明细导航、实际区间时间线、活动列表和证据抽屉渲染。
- E2E-02：新建项目 → 保存纠错 → 创建规则 → 删除规则 → 撤销纠错完整可逆。
- E2E-03：筛选和规则管理视图可访问，常用窗口无横向溢出。
- E2E-04：首页圆环/时间轴联动和当前专注状态回归。
- E2E-05：悬浮窗展开、隐藏、恢复、桌面/置顶模式回归。
- E2E-06：早间计划、晚间复盘、Codex CLI、暂停/恢复采集和重启持久化回归。
- E2E-07：安装后 Windows 自启动开关能删除并恢复 Run 注册项。

### 人工联合验证（A+H / H）

- UX-01（A+H）：自动截图确认没有结构破损；长期阅读密度与纠错顺滑度由真实使用反馈判断。
- UX-02（H）：规则条件是否符合个人真实工作习惯，需要连续使用观察。
- UX-03（H）：多显示器、睡眠唤醒和长时间运行继续沿用真实设备观察。

## 4. 执行顺序

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test:e2e`（连续两轮）
5. `npm run dist`
6. `node tests/packaged-smoke.mjs`
7. 安装升级后运行 `node tests/installed-autostart.mjs`

## 5. 输出产物

- `自动化测试/v0.4.0/TEST_REPORT.md`
- `tests/.artifacts/e2e-results.json`
- `tests/.artifacts/e2e-activity-details.png`
- `tests/.artifacts/packaged-smoke.json`
- `tests/.artifacts/installed-autostart.json`
