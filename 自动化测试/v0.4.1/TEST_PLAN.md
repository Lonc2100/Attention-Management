# TEST_PLAN（v0.4.1）

## 范围

- P0：Codex 当前打开聊天驱动项目归属。
- 防误归属：界面信号缺失、无候选或多候选时清空旧项目。
- 回归：ActivityWatch 前台/AFK 门控、存储 v4、首页、活动明细、悬浮窗、安装与自启动。

## P0 用例

- UT-01：解析 Windows reader 的合法 JSON、空结果和异常输出。
- UT-02：当前标题唯一匹配线程。
- UT-03：同名聊天通过项目标签与 cwd 末级目录消歧。
- UT-04：零候选或多候选返回未确认，不按 `recencyAt` 猜测。
- UT-05：最近交互为 A、可见聊天为 B 时写入 B。
- UT-06：上一次为 A，本次界面不可读时清空 `current` 且不写 A。
- UT-07：非 Codex 前台、AFK、ActivityWatch 数据过期时不启动界面检测。

## 完成门槛

1. P0 自动化用例 100% 通过。
2. `npm test`、`npm run typecheck`、`npm run build` 通过。
3. `npm run test:e2e` 连续两轮通过。
4. 打包 smoke、升级安装、数据保留和自启动验证通过。
5. 无 P0/P1 遗留；检测不确定时必须待分类，不能误算旧项目。

## 输出

- `自动化测试/v0.4.1/TEST_REPORT.md`
- 既有 `tests/.artifacts` 构建、E2E、打包和安装证据。
