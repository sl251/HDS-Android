# Preview 8.1 方案审阅记录（Hermes 主代理）

- 时间：2026-10-16（Astra 规划完成后）
- 方案：`HDS-Mobile-Plan/PREVIEW8.1-PLAN.md`（434 行）
- 审阅结论：**通过，可交 Sol 执行**

## 抽查确认（与源码现场比对）
- `service.ts:12137` 5 分钟字面量（`< 5 * Time.minute`）✓ 与笔记一致
- `HdsService.kt:37-58` 已有 startForeground(42)/PARTIAL_WAKE_LOCK/健康通知/START_NOT_STICKY ✓
- `main.tsx` disabled 五条件、scroll effect 依赖 `messages.length`、1s 轮询 ✓
- `AppearanceStore.kt` 已有 bounds+inSampleSize ✓

## 与 SPEC 的偏差处理（Astra 修正，采纳）
- D7/SERVICE：**不**实施 START_STICKY/受控恢复 → Preview 8.2/T13；本版只改文案+观测基线
- D13/MEMORY-PEAK：已有降采样，只去压缩源整读 + 29 实际指令（phase 语句变量化） → 实施方案
- git commit 授权：**不提交**，循环验收直到全绿（和 AGENTS.md 一致）

## Sol 执行注意事项
- 全部 D 都写 reports/validation.md（真实命令、退出码、输出摘要），逐阶段验收命令来自 PLAN 第 2 节
- 未验证项（真机、gradle assemble）/阻塞要明确写"未验/阻塞"，不得写"通过"
- P3 补丁需覆盖 index.ts；`npm test` 不含 story-ui，UI 不验要标注
- 不重复创建临时文件；发现偏差以源码为准并记录

## 原 SPEC 需 Sol 留意（我人工审阅加的）
- D2 判据避免"识图已匹配清掉其他待重启变更"
- D5 兜底固定 20 分钟默认档
- P3 D12 只改 info 不进 diagnostic