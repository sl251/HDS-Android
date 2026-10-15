# Preview 8.1 TaskSpec — HDS Android

> 本规格由主代理（Hermes）基于 Preview 8 的排查与用户反馈整理。所有缺陷均经源码核对；行号以当前 main 分支为准，若源码变动导致行号漂移，以实际源码为准并记录修正。

## 背景

HDS-Android（`/root/hermes-workspace/hds-android`，main 分支，version `0.1.0-preview.8`）是 HDS-Interlude 的 Android 原生移植：Capacitor + React WebView UI（`apps/mobile-ui/`）+ PRoot/Node runtime（`runtime/`）+ 原生插件（`android/app/src/main/java/io/hdsinterlude/android/`），上游核心在 `upstream/hds-interlude/src/`，移动端通过 `scripts/patch-mobile-hds.mjs` 补丁对齐上游。测试：`tests/*.test.ts`，`npm test` = `npm run build:host` + `node --import tsx --test tests/*.test.ts`。

Preview 8 已交付：生活节奏（urge/agency/时间线导演/Alter）、分享码、后台滚动预算（默认 120 次/24h）、本地聊天与图片入叙事。TASK-BOARD 现状：T06（HDS 宿主与本地聊天）DONE、T09（极简手机界面）IN_PROGRESS、T12（HDS 功能保真）IN_PROGRESS、T13（后台与恢复）IN_PROGRESS（START_STICKY/自动重启/Doze 保活未做）。

## 已确证缺陷（D1–D13）

### 图片链路（P1）

**D1 · `+` 按钮静默失效** — `apps/mobile-ui/main.tsx` 聊天输入区的图片按钮 `disabled={!native || !healthy || busy || sending || attachments.length >= 3}`。四个分支均无任何用户提示（同排 textarea 有 placeholder 提示，图片按钮没有）；核心未唤醒或已满 3 张时点击零反馈。

**D2 · 图片重启判定不可靠** — `main.tsx` 中 `restartNeeded` 仅在 `persistSettings` 保存成功后置位；而保存有 500ms 防抖，且焦点位于 textarea / 非 checkbox input 时会整段跳过保存。实际流程：用户勾选「开启图片理解」→ 立即回聊天点 `+` → `settingsRef.current.modelOptions.visionEnabled` 已为 true（通过 `main.tsx` 的 `if (!settingsRef.current.modelOptions.visionEnabled) { setPage('settings'); ... }` 关卡）但 `restartNeeded` 仍为 false → 不提示重启 → 选图/上传成功 → 发送时才被 `runtime/host.ts`（`method === 'messages.sendLocal'` 附近的识图校验，约 189 行）拦下报「重启后生效」。
正确接口已存在未使用：`runtime/host.ts` 的 `preset.syncStatus` 分支（约 173 行）直接比对「当前设置」与「核心实际加载配置」返回 `restartRequired`；目前仅 `apps/mobile-ui/LifeSettings.tsx` 的「检查重载状态」在调用。

**D3 · 多选图片被整单吞掉** — `HdsRuntimePlugin.kt` 的 `pickImage` 使用 `Intent.ACTION_OPEN_DOCUMENT`，未加 `EXTRA_ALLOW_MULTIPLE`；`imagePicked` 回调中 `result.data?.data == null` 即返回 `{"cancelled": true}`，不处理 `clipData`。部分图库多选时返回 clipData 而 `data` 为 null → 一张都不加。UI 文案写「最多 3 张图片」。

**D4 · 「沿用主叙事」+ 纯文本主模型必然失败** — `ModelCenter.tsx` 识图模型下拉默认「沿用主叙事 · 直接看图」（`visionProviderId` 为空串），图片直接并入主模型请求体；`runtime/host.ts` 只校验 `visionEnabled` 开关、不校验主模型是否支持图片 → 主模型为纯文本 API（如 DeepSeek-chat 系）时最终 400 无回复，UI 无任何提示。

### 主动消息（P2）

**D5 · 「N 分钟后给我发消息」无对应语义** —
- `upstream/hds-interlude/src/narrator.ts`（约 1695 行）`followUpCommitment` 指令语义为「欠用户一个答案」（thinking/checking/decision/emotional-settle），不含「定时主动发送一条消息」。
- `upstream/hds-interlude/src/service.ts`（约 12156 行）`interactionPromisesFollowUp` 正则：`/我(?:先)?想想|我去(?:想想|看看|查查|确认)|晚点(?:回|说|告诉)|之后(?:回|说|告诉)|等我.{0,12}(?:回|说|告诉)|整理.{0,12}(?:回|说|告诉)/` —— 角色回复「我七分钟后给你发消息」不匹配。
- 唯一正解 `reply.mode='delayed'` + `sendAt`（合法区间 [10s, 1440min]，上游 index.ts 默认值），但需模型主动输出并预写消息内容，实际几乎不触发。
- 结果：decision 中不含任何 intent，「约定与待办」面板（`MemoryTools.tsx` 的 intents 列表）为空，用户观感「主动回复坏了」。

**D6 · 5 分钟承诺下限硬编码** — `service.ts`（约 12130 行）字面量 `5 * Time.minute`；上游 `index.ts`（约 236 行）`sweepIntervalMinutes` 默认 5；`runtime/mobile-config.ts` 白名单未暴露这两项。App 内无法调整「5 分钟以下不登记」与「登记后最多等一个 5 分钟扫描周期」。

**D7 · 主动消息依赖进程存活，无保活** — `service.ts`（约 1085 行）sweep 由 `ctx.setInterval(sweepInterval * Time.minute)` 驱动；`service.ts`（约 4651 行）sweep 首行 `desktopRuntimePhase === 'paused'` 直接 return。Preview 8 无前台服务 / START_STICKY，PRoot 被系统回收或强制停止后主动消息静默失效、前台聊天却正常。参考 `HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md`。

### 聊天与见闻体验

**D8 · 见闻页切换丢滚动位置 + 重复拉取（P1）** —
- 全仓库无 `scrollTop` 保存/恢复逻辑；`main.tsx` 中 `scroll.current?.scrollIntoView({ behavior: 'smooth' })` 仅依赖 `messages.length`，只服务聊天页。
- 见闻页有两个 `story.snapshot` 请求源：`main.tsx` 的 `refreshStory` 与 `page === 'story'` 时每 5s 一次的轮询 effect，无 in-flight 去重；旧请求结果可能覆盖新结果 → 用户看到「旧的见闻」。
- 见闻三个 Tab（故事时间线 / 长期记忆 / 此刻心绪）切换不保留各自滚动位置，切页/切 Tab 后回到顶部，正序时间线第一屏永远是旧内容。

**D9 · 聊天页强制滚到底** — `main.tsx` 的 scrollIntoView effect 依赖 `messages.length`，而 `messages.history` 每 1s 轮询全量返回（`runtime/host.ts`，limit 200 desc → reverse）；用户上滑读历史时被强制拉回底部，且每次 `setMessages` 均为新数组 → 长列表全量重渲染。

**D10 · 消息状态不可见** — `main.tsx` 仅对 `status === 'card-opening'` 加小字标注；`messages.sendLocal` 在角色未产出可见回复时把用户消息记为 `accepted`，UI 与真正送达完全一致，消息被静默吞掉。

**D11 · 输入框不自动增高（P3）** — 聊天输入 textarea `rows={1}`，无 auto-grow 逻辑，CSS 有 max-height 但无 JS 配合，长文本挤在单行内滚动。

### 诊断与资源（P3）

**D12 · 日志级别缺 info 级** — `runtime/host.ts` 固定 `logging.level = 'warn'`；intent 登记/投递等均为 `standard/info` 级（上游 `reportOperation`）→ 用户侧设置里的「查看运行日志」恰好缺最需要的诊断行。

**D13 · 大图解码内存峰值** — `AppearanceStore.kt` 先整读最大 32MB 再 `decodeByteArray`；48MP 照片解码后位图约 24–50MB，叠加 PRoot + 模型进程易 OOM（选完图卡死/闪退）。

## 需求（R1–R5，方案细化后阶段化）

- **R1** 修复 D1–D4 图片链路四条（+ 提示、restart 判定改用 `preset.syncStatus`、多选 clipData、主模型能力提示）。
- **R2** 修复 D5（narrator 指令 + 兜底正则两侧补齐「定时主动发送」语义）与 D6（阈值与 sweep 粒度可配置化并暴露进 mobile-config 白名单）。
- **R3** 修复 D8（滚动位置保留 + story.snapshot 单飞去重）、D9（智能滚动：仅底部附近才自动滚 + 「有新消息」提示）、D10（消息状态可见 + 失败重试）。
- **R4** D11/D12/D13 按性价比纳入，或给出排除理由与后续归属。
- **R5** 明确每个阶段的 Linux 可验项与 Android 真机必验项；涉及 `upstream/` 改动的必须标注 `scripts/patch-mobile-hds.mjs` 同步要求。

## 明确不做

- 不重构上游 hds-interlude 非相关模块。
- 不做消息撤回 / 引用回复 / 语音 / TTS / QQ 信箱与 App 故事流统一。
- 不新增付费服务依赖；不新增密钥或凭据；不提交 git（实现先不 commit，由主代理审 diff 后按用户指示决定）。

## 交付物

1. `HDS-Mobile-Plan/PREVIEW8.1-PLAN.md`：分阶段实施方案（每阶段：改动文件绝对路径、关键流程、实现要点、可执行验收命令、Linux 可验 / 真机必验分离；每条缺陷的修复理由 + 源码证据；是否涉及上游与补丁同步）。
2. 证据修正记录：源码核对中发现的行号/引用偏差，写入 `HDS-Mobile-Plan/evidence/`（astra 前缀）。

## 验收（实现阶段执行）

- `npm run typecheck` 与 `npm test` 全绿（含 `tests/image-chat.test.ts`、`tests/preview8.test.ts`、`tests/host.test.ts`、`tests/story-ui.mjs`）。
- 每条 R 有对应新增测试或明确真机验证步骤。
