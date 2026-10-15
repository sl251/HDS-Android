你是 HDS-Android 项目的架构规划负责人。项目根目录：/root/hermes-workspace/hds-android（main 分支，0.1.0-preview.8）。本次只做规划，不做任何代码修改。

## 任务

为 Preview 8.1 制定完整、可执行、分阶段的实施方案。

### 步骤

1. 通读 `HDS-Mobile-Plan/PREVIEW8.1-SPEC.md`（缺陷 D1–D13，含源码证据与行号）。
2. 逐条到源码现场核实：D 中引用的文件与行号若与实际不符，以实际源码为准，并记录修正（写入 evidence/ 下以 `astra-` 前缀命名的新文件，例如 `HDS-Mobile-Plan/evidence/astra-8.1-notes.md`）。核实过程中重点重读以下位置：
   - `apps/mobile-ui/main.tsx`：图片按钮 disabled 分支、pickImage 前置校验、restartNeeded 置位/清除、persistSettings 防抖与焦点跳过、scrollIntoView effect、`page === 'story'` 轮询 effect、三个见闻 Tab 的渲染与卸载、textarea rows。
   - `runtime/host.ts`：`preset.syncStatus` 分支（restartRequired 怎么算的）、`messages.sendLocal` 的识图校验、`story.snapshot` 返回结构、日志级别设置、消息历史查询。
   - `android/app/src/main/java/io/hdsinterlude/android/HdsRuntimePlugin.kt`：pickImage/imagePicked 回调；`AppearanceStore.kt`：image() 解码路径。
   - `upstream/hds-interlude/src/narrator.ts`：followUpCommitment 指令的完整条件与原文；`service.ts`：normalizeFollowUpCommitment（5 分钟下限）、interactionPromisesFollowUp 正则及调用点、sweep 与 intent-due 投递的 permitMessages 链、adminPendingIntents。
   - `runtime/mobile-config.ts`：白名单结构；`scripts/patch-mobile-hds.mjs`：补丁机制（上游改动如何落地移动端）。
3. 重点设计两个难点，给出具体方案（含 prompt 片段草案）：
   - **a. D5 主动消息语义**：在 narrator 的 user-message 指令与 interactionPromisesFollowUp 兜底正则两侧，如何补上「用户要求角色在未来某时刻主动发送消息」的语义，使模型稳定输出 `reply.mode="delayed"` + `sendAt`（10s–1440min 区间）或可靠的 commitment；给出指令原文草案与正则扩展草案，并说明到期投递由哪条链完成（sweep / scheduleDueIntentWake / 用户下一消息触发）。
   - **b. D6 可配置化**：5 分钟下限与 sweepIntervalMinutes 的最小改动方案（上游提为 Schema 字段？还是移动端 patch 覆盖？）、mobile-config.ts 白名单加字段、默认值策略与兼容性说明。
4. 产出 `HDS-Mobile-Plan/PREVIEW8.1-PLAN.md`：
   - 分阶段（Phase 1..N，按依赖排序；图片链路=Phase 1，聊天/见闻体验=Phase 2，主动消息与配置=Phase 3，诊断/资源=Phase 4 或合并）；
   - 每阶段包含：改动文件（绝对路径）、关键流程、实现要点、可执行验收命令、新增/修改测试清单；
   - 每条缺陷→需求→阶段映射表；
   - 每阶段明确：Linux 可验项 / Android 真机必验项（分开列出），涉及 `upstream/` 的标注 patch-mobile-hds.mjs 同步要求；
   - 不实现阶段 D7 保活时给出理由与后续归属（如 preview8.2 / T13）。
5. 不确定的代码行为先回读源码，不要凭印象写方案。

## 约束

- 只读源码与规划：允许写 `HDS-Mobile-Plan/PREVIEW8.1-PLAN.md` 和 `HDS-Mobile-Plan/evidence/astra-*` 两个产物，不得改其他任何文件、不提交 git。
- 方案要可执行：验收命令必须是仓库里真实存在的脚本（见 package.json scripts 与 tests/ 实际文件名）。
- 不输出任何密钥、token 或凭据。
- 最终回复用中文总结：核实到的行号修正、阶段划分、两个难点方案要点、真机必验项清单。