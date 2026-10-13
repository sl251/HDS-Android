# HDS Android

将 HDS-Interlude Koishi 插件移植到 Android，在手机本地运行核心与 QQ 通道，通过用户配置的模型 API 推进叙事。

## 当前状态

仓库已导入 2026-10-13 编制的实施计划。当前尚无 Android 应用源码、APK 或真机验证结果。任务状态以 [任务表](HDS-Mobile-Plan/TASK-BOARD.csv) 和后续 `docs/evidence/` 中的证据为准。

首版目标包括 QQ 私聊、群聊、QQ 空间动态，以及实际进入 HDS 叙事的角色卡导入。优先保留原版 HDS 核心，采用 Kotlin、Capacitor/React、PRoot/Ubuntu ARM64 与 Node/Koishi 的方案。

## 开始实施

先阅读 [任务总览](HDS-Mobile-Plan/00-START-HERE.md) 与 [交接提示词](HDS-Mobile-Plan/06-HANDOFF-PROMPTS.md)，按 T01—T03 推进源码基线、工具链、手机运行和 QQ/空间验证。

- [源码调查](HDS-Mobile-Plan/01-RESEARCH.md)
- [架构与接口边界](HDS-Mobile-Plan/02-ARCHITECTURE.md)
- [角色卡导入](HDS-Mobile-Plan/03-CARD-IMPORT.md)
- [实施任务](HDS-Mobile-Plan/04-TASKS.md)
- [验收标准](HDS-Mobile-Plan/05-ACCEPTANCE.md)
- [固定来源](HDS-Mobile-Plan/sources.lock.json)

上游源代码、运行时与 QQ 后端分别遵守其各自许可证和分发条件。本仓库当前只包含实施计划；未将第三方组件打包，也不声明未验证的 Android 或 QQ 空间支持。
