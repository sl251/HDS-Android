好，这是一个只读盘点任务。我先并行读取两个核心文件，然后根据内容完成三张表。
继续并行读取 index.ts 的中后段，找到所有顶层 Schema.object 配置分区：
现在继续读取 index.ts 剩余部分，重点找所有顶层 Schema 配置分区和 presetSync：
我已经掌握了完整的配置分区信息和 dispatch 白名单。现在输出完整的盘点报告：

---

# HDS 移动端"还原度"缺口盘点（preview.8 任务书素材）

---

## 表 1 — 上游配置分区全量

> 来源：`upstream/hds-interlude/src/index.ts`，`Config` 导出对象（L526–593）

| # | 分区名 | 定义起始行 | `enabled` 默认值 | 电脑版作用（description 要点） |
|---|--------|-----------|-----------------|-------------------------------|
| 1 | `storyDefaults` | L374 | — | 故事档案：主角名/人设/世界/时区/叙事文风 |
| 2 | `model` | L153 | — | 模型中心：多连接、主叙事参数、Embedding、压缩、视觉/音频理解 |
| 3 | `onebot` | L466 | `false` | QQ / OneBot 账号过滤、私聊白名单、群聊规则 |
| 4 | `sharedStory` | L499 | — | 共享主剧本：多人参与、跨账号消息、管理员权限 |
| 5 | `runtime` | L214 | — | 运行时节奏：消息合并/打字延迟/自动推进/补写窗口/上下文窗口 |
| 6 | `urge` | L532（内联） | `false` | Urge 弹性推进：替代固定间隔，剧本驱动的自动调度 |
| 7 | `schedulePreplan` | L262 | `true` | 日程预排：近期稳定日程投影与变化颗粒度（14 天视野） |
| 8 | `timelineDirector` | L539（内联） | `true` | 时间导演：自动回合前生成时间账本，失败降级不冻结 |
| 9 | `agency` | L272 | `false` | Agency 行动窗口：日程/隐私/设备的主动联系条件审查 |
| 10 | `chatActions` | L474 | `false` | 聊天动作：引用回复、消息表情回应、QQ 原生小表情 |
| 11 | `stickers` | L489 | `false` | 本地表情包库：扫描素材、视觉模型建描述、语义过滤 |
| 12 | `memory` | L330 | `true` | 记忆与连续性：场景压缩、长期事实、剧情余波、设定演化 |
| 13 | `alterSystem` | L295 | `true` | Alter 情绪：低频氛围偏移追踪，侧端分析 |
| 14 | `browser` | L310 | `false` | 网页观察：Puppeteer 只读浏览与搜索（需 puppeteer 插件） |
| 15 | `worldSeeder` | L546（内联） | `false` | 世界播种器：后台低频生成外部事件注入剧本 |
| 16 | `longHorizon` | L556（内联） | `false` | 长线叙事催化器（实验）：累计证据后生成长期发展方向 |
| 17 | `qzone` | L564（内联） | `false` | QQ 空间：说说/评论/点赞通道（依赖 SnowLuma 连接） |
| 18 | `presetSync` | L572（内联） | `false` | 预设同步：从 typ0-site 拉取并自动应用分区配置 |
| 19 | `weather` | L580（内联） | `false` | 运行时天气：从 Open-Meteo 拉取真实天气注入 [世界事件] |
| 20 | `blindMode` | L257 | `false` | 盲区模式：静默命令/日志，仅保留低频健康心跳 |
| 21 | `logging` | L389 | — | 日志：级别/密度/布局/隐私预览开关 |
| 22 | `chatRhythm` | L592（内联） | `true` | **已弃用**（`hidden()`）：旧节奏反定型，不再统计或干预 |

---

## 表 2 — 移动端下发现状

> 来源：`runtime/host.ts:49–57`

| 分区名 | 移动端状态 | 上游默认值（缺失/关闭时标注） | 备注 |
|--------|-----------|------------------------------|------|
| `storyDefaults` | ✅ 已下发 | — | `personaDefaults(input.card, input.userProfile)` |
| `model` | ✅ 已下发 | — | `mobileModelConfig(input)` 封装 |
| `onebot` | ✅ 已下发 | `enabled: false`（上游默认） | 移动端强制 `enabled: true`，绑定本地适配器 |
| `sharedStory` | ❌ 缺失 | `autoEnrollParticipants: true, allowCrossConversationMessages: true, shareParticipantDetails: false` | 移动端单人单故事，上游默认值无副作用但未显式控制 |
| `runtime` | ✅ 已下发（部分裁剪） | — | 只传了 6 个字段，其余全走上游默认 |
| `urge` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端沿用固定 [10,20] 分钟补写 |
| `schedulePreplan` | ❌ 缺失 | `enabled: true` | **上游默认开启**，移动端未下发 → 实际生效中 |
| `timelineDirector` | ✅ 已下发 | `enabled: true` | `enabled: input.autoAdvance`，随 autoAdvance 绑定 |
| `agency` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `chatActions` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `stickers` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `memory` | ❌ 缺失 | `enabled: true` | **上游默认开启**，移动端未下发 → 实际生效中 |
| `alterSystem` | ❌ 缺失 | `enabled: true` | **上游默认开启**，移动端未下发 → 实际生效中 |
| `browser` | ✅ 显式关闭 | `enabled: false`（上游默认也是 false） | `browser: { enabled: false }`，双重关闭 |
| `worldSeeder` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `longHorizon` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `qzone` | ✅ 显式关闭 | `enabled: false`（上游默认也是 false） | `qzone: { enabled: false }`，双重关闭 |
| `presetSync` | ❌ 缺失 | `enabled: false` | 上游默认关闭，但 `runAutoSync` / `interlude.preset.sync` 命令已实现 |
| `weather` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无入口 |
| `blindMode` | ❌ 缺失 | `enabled: false` | 上游默认关闭，移动端无管理界面 |
| `logging` | ✅ 已下发 | `level: 'info', colors: true, kaomoji: true` | 移动端覆盖为 `warn / false / false`，隐私安全 |

**注意**：`schedulePreplan`（默认 `enabled: true`）、`memory`（默认 `enabled: true`）、`alterSystem`（默认 `enabled: true`）三个分区移动端未下发，**意味着它们当前实际在移动端静默运行**，并非"缺失功能"而是"无配置入口的后台能力"。

---

## 表 3 — 无入口模块的接入代价

> 针对移动端完全没有配置入口/下发的 9 个模块

| 模块 | 源文件（分区/Schema） | 入口 API / 导出名 | 依赖模型连接 | 依赖外部网络 | 需要新增 dispatch method |
|------|----------------------|-------------------|-------------|-------------|--------------------------|
| **urge** | L532 `urge` (内联 Schema) | `InterludeConfig.urge`；无独立服务 API，由 runtime 扫描循环驱动 | 是（自动推进触发主叙事） | 否 | **否**（纯配置传入，无需 RPC；需在 host.ts 下发分区） |
| **agency** | L272 `Agency` | `InterludeConfig.agency`；服务端 `resolveAgencyConfig`，由 sweep 驱动 | 是（Agency Window 生成调用压缩模型） | 否 | **否**（纯配置；但需 UI 展示 agency 状态，若要查看 window 需新增 `agency.status` dispatch） |
| **schedulePreplan** | L262 `SchedulePreplan` | `resolveSchedulePreplanConfig`, `schedulePreplanWindow`（已导入 index.ts）；由 sweep 驱动 | 是（空闲审查调用压缩模型） | 否 | **否**（纯配置；已静默运行；可考虑新增 `preplan.view` dispatch 暴露当前日程窗口） |
| **presetSync** (share-sync) | L572 `presetSync` (内联) | `runAutoSync`, `readSyncState`（已从 index.ts 导出）；命令 `interlude.preset.sync` | **否**（只拉配置，不调生成模型） | **是**（HTTP 拉取 typ0-site，`baseUrl` 默认 `https://typ0.space`） | **是**（需新增 `preset.sync` 和 `preset.syncStatus` dispatch，或暴露 `runAutoSync` 直接调用路径） |
| **chatActions** | L474 `ChatActions` | `InterludeConfig.chatActions`；由主叙事消息投递时注入 | 是（主叙事回合） | 否 | **否**（纯配置；但平台 `qq`/`wechat` 的 action 实际执行需本地 bot 支持，移动端 LocalBot 未实现 `addReaction` 等） |
| **stickers** | L489 `Stickers` | `InterludeConfig.stickers`；目录扫描 + 视觉模型描述建库 | 是（描述生成调用视觉模型） | 否（本地文件系统） | **是**（需新增 `stickers.scan` 触发扫描，以及图片投递路径；`deliveryBaseUrl` 需对接移动端媒体存储） |
| **worldSeeder** | L546 `worldSeeder` (内联) | `InterludeConfig.worldSeeder`；由 sweep 后台驱动 | 是（调用勾选"用于世界播种"的连接） | 否 | **否**（纯配置；如需查看挂起事件可新增 `worldSeeder.pending` dispatch） |
| **weather** | L580 `weather` (内联) | `InterludeConfig.weather`；后台 cadence 拉取 | 否（Open-Meteo 无 Key） | **是**（HTTP 请求 Open-Meteo API，免费无 Key） | **否**（纯配置；但沙盒/受限网络下需确认出站权限） |
| **longHorizon** (long-arc) | L556 `longHorizon` (内联) | `InterludeConfig.longHorizon`；由 sweep 积分驱动 | 是（异步生成长期发展方向，调用主模型） | 否 | **否**（纯配置；如需展示当前 attractor 状态可新增 `longHorizon.status` dispatch） |

---

## 冲突核查 — 与已知清单的对比

以下逐条核对给出的"已知清单"，**标红处为不准确或需修订的地方**：

### ① "上列九个模块默认关闭"
**部分不准确。** 九个模块中：

- `urge`：默认 `enabled: false` ✅ 正确
- `agency`：默认 `enabled: false` ✅ 正确  
- `schedulePreplan`：默认 **`enabled: true`** ⚠️ **与清单冲突** — 上游 L263 明确 `.default(true)`；移动端未下发 → 它现在是**静默运行**状态，而非关闭
- `presetSync`：默认 `enabled: false` ✅ 正确
- `chatActions`：默认 `enabled: false` ✅ 正确
- `stickers`：默认 `enabled: false` ✅ 正确  
- `worldSeeder`：默认 `enabled: false` ✅ 正确
- `weather`：默认 `enabled: false` ✅ 正确
- `longHorizon`：默认 `enabled: false` ✅ 正确

**结论**：`schedulePreplan` 的描述"默认关闭"是**错误的**，它实际默认开启且在移动端静默运行。

---

### ② "移动端'主动'只有 autoAdvance 一个布尔 + 写死的 [10,20] 分钟补写"
**基本正确，但有一处值得标注。**

- `host.ts:52` 确认：`conversationFollowUpMinutes: input.autoAdvance ? [10, 20] : []` ✅
- `autoAdvanceEnabled: input.autoAdvance` ✅
- `allowProactiveMessages: input.autoAdvance` ✅
- `timelineDirector.enabled: input.autoAdvance` ✅（L54）

额外注意：`autoAdvanceIntervalMinutes` 和 `autoAdvanceJitterMinutes` 均未下发，走**上游默认值**（`40` 分钟间隔 + `5` 分钟抖动），不是"写死"，而是"沿用上游默认"。这与"写死"语义略有差异，但不算严重错误。

---

### ③ "上游 `runAutoSync` / `interlude.preset.sync` 已实现"
**正确。** 从 index.ts L11–12 可确认：

```ts
import { ..., runAutoSync, readSyncState, ... } from './share-sync'
export { ..., runAutoSync, readSyncState, writeSyncState } from './share-sync'
```

L608–612 还确认了启动时 autoUpdate 钩子已接入。`interlude.preset.sync` 命令由 `registerCommands` 注册（L650+ 未详读，但 `runAutoSync` 的导出和 autoUpdate 逻辑已确认功能存在）。✅

---

### ④ "预设同步分区不含 model（API Key 不会被预设带走）"
**正确。** L577 `sections` 可选值完整列出：

```
storyDefaults, runtime, urge, agency, memory, alterSystem, schedulePreplan,
timelineDirector, chatActions, stickers, sharedStory, browser, worldSeeder,
longHorizon, qzone, blindMode, logging
```

共 17 项，**确实不含 `model`**（也不含 `presetSync` 自身、`onebot`、`weather`）。API Key 无法被预设带走。✅

---

## 附：dispatch 白名单现有方法汇总

`runtime/host.ts` L115–196 目前允许的 dispatch method：

| 方法 | 功能 |
|------|------|
| `qq.*` | QQ Runtime 转发 |
| `images.upload` / `images.get` | 媒体存储 |
| `memory.facts` / `memory.factSources` | 长期事实查询 |
| `maintenance.status` / `maintenance.start` | 维护任务（compact / fact-add / fact-forget / overlay-clear / intent-cancel） |
| `health` | 健康检查 |
| `messages.history` | 消息历史 |
| `story.snapshot` | 完整故事快照（含 entries / facts / memories / intents / overlay / promptTrace） |
| `story.pause` / `story.resume` | 故事暂停/恢复 |
| `messages.sendLocal` | 发送用户消息 |

`presetSync` 需要至少新增 `preset.sync` 和 `preset.syncStatus` 两个方法；其余纯配置模块（urge/agency/schedulePreplan/worldSeeder/weather/longHorizon）若仅需开启则只需修改 host.ts 配置下发，不需要新增 dispatch（若需 UI 状态查询另议）。
