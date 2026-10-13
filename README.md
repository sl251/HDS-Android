# HDS Android

将 HDS-Interlude Koishi 插件移植到 Android，在手机本地运行核心与 QQ 通道，通过用户配置的模型 API 推进叙事。

## 当前状态

仓库已导入 2026-10-13 编制的实施计划，并开始 T01 源码基线验证。当前尚无 Android 应用源码、APK 或真机验证结果。任务状态以 [任务表](HDS-Mobile-Plan/TASK-BOARD.csv) 和 `docs/evidence/` 中的证据为准。

首版目标包括 QQ 私聊、群聊、QQ 空间动态，以及实际进入 HDS 叙事的角色卡导入。优先保留原版 HDS 核心，采用 Kotlin、Capacitor/React、PRoot/Ubuntu ARM64 与 Node/Koishi 的方案。

## 开始实施

先阅读 [任务总览](HDS-Mobile-Plan/00-START-HERE.md) 与 [交接提示词](HDS-Mobile-Plan/06-HANDOFF-PROMPTS.md)，按 T01—T03 推进源码基线、工具链、手机运行和 QQ/空间验证。

- [源码调查](HDS-Mobile-Plan/01-RESEARCH.md)
- [架构与接口边界](HDS-Mobile-Plan/02-ARCHITECTURE.md)
- [角色卡导入](HDS-Mobile-Plan/03-CARD-IMPORT.md)
- [实施任务](HDS-Mobile-Plan/04-TASKS.md)
- [验收标准](HDS-Mobile-Plan/05-ACCEPTANCE.md)
- [固定来源](HDS-Mobile-Plan/sources.lock.json)

上游源代码、运行时与 QQ 后端分别遵守其各自许可证和分发条件。当前交付为实施计划和基线验证工具，未打包第三方运行时，也不声明未验证的 Android 或 QQ 空间支持。

## 复现 HDS 基线

需要 Git、Node.js 24.11.1 和 npm 11.6.2；在仓库根目录执行：

```powershell
node scripts/prepare-hds-baseline.mjs
npm ci --ignore-scripts --prefix tools/hds-baseline
node scripts/inventory-hds.mjs
node scripts/verify-hds-baseline.mjs
node scripts/build-hds-baseline.mjs
```

原始检查存在已记录的失败，因此 `verify-hds-baseline.mjs` 当前返回非零；原因与测试数量见 [基线报告](docs/evidence/T01/baseline.md)。`build-hds-baseline.mjs` 直接从源码打包并检查插件导出，尚不包含声明文件或 Android 宿主。

[功能盘点](docs/feature-parity.csv) 覆盖全部顶层配置分区与命令；其中移动实现状态仍为待实现。参考源码与本地工作副本放在忽略目录，不随本仓库推送。HDS 来源和许可证见 [第三方说明](docs/THIRD_PARTY.md)。
