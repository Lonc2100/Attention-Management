# 实施计划

1. 先扩展 E2E：同一目标多次鼠标移动后 tooltip 的位置保持不变；联动高亮仍成立。
2. 把 pointer 入口改为基于目标矩形定位，移除所有 `onMouseMove`。
3. 移除 timeline dimmed filter 和 tooltip backdrop blur，保留轻量 opacity/transform。
4. 更新版本、文档和测试报告。
5. 运行 unit/typecheck/build/E2E 两轮、打包 smoke、升级安装、自启动与数据保留验证。
