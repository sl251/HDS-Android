# preview.8 任务书 — 还原电脑版「生活感」（配置分区接入与移动端映射层）

版本：0.1（草案） · 编制日期：2026-10-15（Asia/Shanghai）
目标：**尽量还原电脑版 HDSI 的体验**（用户原话）
上游基线：`upstream/hds-interlude/` = ISEKAI-MomoiCore/HDS-Interlude `1.0.1-rc51`
移动端基线：`preview.7.1` / `8da8f82`
参照文档：00—06（step5 规划基线）、07-BACKGROUND-KEEPALIVE.md
交叉核对：agy（claude-sonnet-4-6，plan 只读）+ 本文编制者逐条回读源码

---

## 0. 一句话诊断

电脑版是**她按 Urge/Agency 自己决定什么时候开口**；移动端是个**节拍器**——只有一个 `autoAdvance` 布尔加写死的 10/20 分钟补写。根源不在 UI 没人做，而在 `runtime/host.ts:49-57` 这个**下发给上游的配置对象只有 6 个分区**，其余全部靠上游默认值兜底。

## 0.1 三条对既有认知的修正（已核实）

| 原认知 | 核实结果 | 依据 |
|---|---|---|
| "缺失分区 = 关着" | **不成立**。`host.ts:49` 走 `HDS.Config({...})`，上游 `Config` 是 `Schema.object`（`src/index.ts:526`），未提供的分区**落默认值** | `src/index.ts:526`、`host.ts:49/68` |
| "schedulePreplan 默认 —" | **默认是开的**（`enabled: Schema.boolean().default(true)`）。日程预排移动端其实已生效，缺的是 UI 入口与联动 | `src/index.ts:263`、`:538` |
| "chatRhythm 是个待接的分区" | rc51 已**弃用并隐藏**（`【已弃用】…不再统计、干预写作或重试`）。不要列入还原范围 | `src/index.ts:592` |

补充：`memory`（`:331`）、`alterSystem`（`:296`）、`timelineDirector`（`:539`）、`schedulePreplan`、`failover`、`compaction` 默认都是**开**，所以移动端并非"什么都没接上"，而是**主动性调度（urge/agency）与表达层（chatActions/stickers）没接**。

## 0.2 关于 autoAdvance 的精确表述（避免口径混淆）

`host.ts:52` 的 runtime 覆盖了 6 个字段，其中：

```
autoAdvanceEnabled / allowProactiveMessages = input.autoAdvance
conversationFollowUpMinutes = input.autoAdvance ? [10, 20] : []   ← 写死
```

而 `autoAdvanceIntervalMinutes`（默认 40）与 `autoAdvanceJitterMinutes`（默认 5）**未下发**（`src/index.ts:248-249`）。

所以准确说法不是"全是写死"，也不是"全走上游默认"，而是：
**自动推进的间隔沿用上游默认（40 分钟 ± 5），但"对话后补写窗口"被写死成 10/20 分钟**。
这也是 Urge 的接入点——`urge` 的 description 原文就说它"替代固定间隔及对话后 10/20 分钟补写"（`src/index.ts:533`）。

---

## 1. 现状核实：上游 22 个配置分区 × 移动端下发现状

上游 `Config`（`src/index.ts:526-592`）共 21 个编号分区 + `mainPrompt` + 已弃用的 `chatRhythm`。
移动端下发（`host.ts:49-57`）：`storyDefaults` / `model` / `runtime` / `logging` / `timelineDirector` / `onebot`，并显式 `qzone{enabled:false}`、`browser{enabled:false}`。

| # | 分区 | Config 块行 | enabled 默认 | 移动端 | 真实生效 |
|---|---|---|---|---|---|
| 1 | storyDefaults【必填1】 | 527 | —（必填） | ✅ 下发 | 生效 |
| 2 | model【必填2】 | 528 | —（必填） | ✅ 下发 | 生效（含 mobileCardPrompt 注入 `host.ts:60`） |
| 3 | onebot【必填3】 | 529 | —（必填） | ✅ 下发 | 生效 |
| 4 | sharedStory【结构4】 | 530 | — | ❌ 缺失 | 默认兜底 |
| 5 | runtime【节奏5】 | 531 | — | ✅ 下发 | 生效，但 `conversationFollowUpMinutes` 被写死 `[10,20]`（`host.ts:52`） |
| 6 | **urge【节奏6】弹性推进** | 532 | **false** | ❌ 缺失 | **关** ← 体感差距主因 |
| 7 | schedulePreplan【节奏7】 | 538 | **true** | ❌ 缺失 | **开**（无 UI 入口、无联动） |
| 8 | timelineDirector【节奏8】 | 539 | true | ⚠️ 下发 | 被 `enabled: input.autoAdvance` 绑定（`host.ts:54`） |
| 9 | **agency【节奏9】行动窗口** | 540 | **false** | ❌ 缺失 | **关** ← 体感差距主因 |
| 10 | **chatActions【表达10】** | 541 | **false** | ❌ 缺失 | 关 ← 最便宜的"活人感" |
| 11 | **stickers【表达11】** | 542 | **false** | ❌ 缺失 | 关 |
| 12 | memory【内在12】 | 543 | true | ❌ 缺失 | 开（默认兜底） |
| 13 | alterSystem【内在13】 | 544 | true | ❌ 缺失 | 开，但参数无 UI（仅 `model-tasks.ts` 暴露 `useForAlter`） |
| 14 | browser【扩展14】 | 545 | false | ✅ 显式关闭 | 关（符合预期） |
| 15 | worldSeeder | 546 | false | ❌ 缺失 | 关 |
| 16 | longHorizon 长线催化 | 556 | false | ❌ 缺失 | 关（上游标实验） |
| 17 | qzone | 564 | false | ✅ 显式关闭 | 关（SnowLuma 许可 4(b)/5 未核清，**先别动**） |
| 18 | **presetSync** | 572 | **false** | ❌ 缺失 | 关 ← 成本极低收益极大 |
| 19 | weather 真实天气 | 580 | false | ❌ 缺失 | 关（Open-Meteo，免费） |
| 20 | blindMode【维护20】 | 589 | false | ❌ 缺失 | 关 |
| 21 | logging【维护21】 | 590 | — | ✅ 下发 | 生效 |
| — | mainPrompt | 591 | 空=内置默认 | ❌ 缺失 | 用内置默认（**不要动**） |
| — | chatRhythm | 592 | 已弃用 | — | 不适用 |

> 行号均为 `upstream/hds-interlude/src/index.ts`，2026-10-15 实读。

---

## 2. 还原度缺口清单（按性价比排序）

### P0 — 还原"她主动找你"这件事

**P0-1 · urge + agency + schedulePreplan 三件套**（同一套调度系统，一起做）
- `urge`（532 / `src/urge.ts`）：剧本驱动的弹性推进，**替代固定间隔与对话后 10/20 分钟补写**——description 原文明确写了这一点，等于移动端现在的做法是它要取代的东西
- `agency`（540 / `src/agency.ts`）：主体行动窗口，按日程压力/隐私/设备/生活来源判断"有没有理由联系你"；`contactMode` 默认 `strict`，另有 `natural`/`balanced`
- `schedulePreplan`（538 / `src/schedule-preplan.ts`）：默认已开，需要的是 UI 入口 + `anchorAutoAdvance` 与推进的关系理顺
- 移动端要做的：配置 UI（空间页）+ 三者的开关/频率/阈值持久化 + **与 `autoAdvance` 的主从关系定义**（建议：`autoAdvance` 保留为"总开关"，Urge 开启时接管补写节奏，`conversationFollowUpMinutes` 不再写死 `[10,20]`）
- 判据：开着 Urge，聊天间隔不再机械；关掉后行为回落到现状
- 验证：真机跑 30 分钟以上观察主动消息时机分布；对照 `timelineDirector` 联动

**P0-2 · presetSync（typ0.space 分享码同步）**
- 上游已实现 `runAutoSync` / `interlude.preset.sync`（`src/index.ts:606-611` 启动自动检查；导出见 `src/index.ts:12-13`）
- `presetSync.sections` 可选 18 个分区（`src/index.ts:577`），列表**不含 `model`** → API Key 不会被预设带走（省钱也安全）
- 移动端要做的：分享码输入 + 手动同步 + 重载检查三件 UI
- 判据：输入分享码能拉到预设并落到本地配置

### P1 — 表达与社交补全

**P1-3 · chatActions**：先做 QQ **引用回复**，表情回应次之。上游默认值已给出 `quoteReply:true / messageReactions:true / nativeFaces:true / expressionThreshold:0.7`（`src/index.ts:541`），投递链在 `src/service.ts:2836-2858` 与 `src/narrator.ts:1705-1714`。
**可行性前置（必须先验证）**：移动端 QQ 走 koishi-plugin-adapter-onebot 的标准 send 路径（`runtime/qq.ts:87-89` 挂 `app.on('send')` 记录出站消息），因此**引用回复有落点**；但**消息表情回应（reaction）与 QQ 原生表情**需要确认 NapCat/适配器是否暴露 `set_msg_emoji_like` 等接口——**未验证前不得承诺**，本轮只做引用回复。
**P1-4 · QQ 信箱缺口**：媒体上传/下载、好友管理、多账号、登出/清登录态、旧聊天同步（对齐 `QQ-ROADMAP.md`）
**P1-5 · alterSystem 参数 UI**：情绪阈值/权重/侧端分析开关（现在只有 `useForAlter` 勾选）
**P1-6 · works 创作线**：上游 `src/works.ts` 有模块（`CommonWorksConfig{enabled,generationMode,modelId}`），需确认移动端是否零入口

### P2 — 边界项

**P2-7** 世界书补正则/递归规则/CHARX/压缩 PNG 元数据（`MOBILE-PATCHES.md` 已记）
**P2-8** Qzone **先别动**（SnowLuma 许可 4(b)/5 在 T01 baseline 标"未核清"）
**P2-9** `feature-parity.*` 从盘点基线改成**真实状态表**，下次复盘直接看差列
**P2-10** P0/P1 每个新 dispatch method 补**真实 Koishi 测试**（现在只有 `preview7`/`qq` 两个文件碰 `host.ts`）

---

## 3. 架构建议：移动端配置映射层（这次别再加"三处硬编码"）

现状：每加一个模块要改**三处**——`host.ts` 硬编码对象 + Android UI + `contracts`。上游 `Config` 是全量 Schema，等于同一份结构写了两遍。

建议做一层 `mobile-config-map`：

1. 由上游 Schema 生成**移动端支持面**清单（分区名 + 字段 + 类型 + 默认 + 中文 description）
2. 构建期产出一份 `mobile-config.schema.json`（随包发布）
3. `host.ts` 改为：默认全量映射 → 只对**移动端明确要覆盖**的分区做覆盖（现在是反过来：只给 6 个分区，其余全靠兜底，导致"缺了也不知道缺")
4. Android UI 按分区渲染表单（`HdsStore.kt` 持久化 + `assets/` 随包 schema）

收益：加模块只改一处；"还原度"变成**可度量**的数字（已覆盖分区数 / 支持字段数），能进 `feature-parity` 表。

---

## 4. 验收映射

| 用例 | 覆盖点 |
|---|---|
| A06 | 切后台/返回不误杀持续运行（07 文档 L1） |
| R04 | 息屏/Doze/厂商限制下如实报告存活与中断 |
| R10 | 后台调用预算达上限即停并说明（Urge 接开后调用量上升，必须配套） |
| U03 | 拒绝通知/麦克风/文件等权限时只影响相关能力，解释准确 |

（P0-1 接开后**模型调用量会明显上升**，R10 的预算与静默降级必须同时到位，否则会烧额度。）

---

## 5. 红线

1. 不改 `00—06` 已有结论，只新增本文件；07 是保活专文，两者边界清楚
2. **不接 qzone**，直到 SnowLuma 许可 4(b)/5 核清
3. 不动 `mainPrompt`（`:591` 原文"⚠️ 除非有把握，否则不要修改"）
4. 不碰 `chatRhythm`（已弃用）
5. 不为了"功能看起来齐了"伪造真机证据；未测标 `NOT RUN`
6. 不静默换模型/后端；预设同步**不得**把 `model` 分区带进来

---

## 6. 实施顺序（preview.8 里程碑）

- **M1** 配置映射层（§3）——先有骨架，后面的模块才不用三处改
- **M2** P0-2 presetSync（独立、便宜，先拿一个可见成果）
- **M3** P0-1 urge + agency + schedulePreplan + autoAdvance 主从关系
- **M4** P1-3 chatActions（引用/表情）
- **M5** P1-4/5/6 按剩余预算排
- **M6** P2-9/10 收尾（状态表 + 测试）
- 每步一个提交、独立可验证；M3 之前先定 R10 预算默认值

---

## 附：核对过程

- 本文所有 `file:line` 由编制者逐条 `grep`/`sed` 实读，非引用二手结论
- agy（claude-sonnet-4-6，plan 只读）独立盘点报告：`HDS-Mobile-Plan/evidence/agy-preview8-parity-inventory.md`
- **交叉核对结论**：agy 独立得出与本文 §0.1 相同的修正（`schedulePreplan`/`memory`/`alterSystem` 默认开、移动端静默运行）；双方一致确认 `presetSync.sections` 不含 `model`。
  - agy 认为 `autoAdvance` 间隔"沿用上游默认"——本文 §0.2 进一步精确：间隔走默认，**补写窗口是写死的 [10,20]**。
  - agy 提示 chatActions 的实际执行依赖本地 bot 能力——本文据此把 P1-3 降为"先做引用回复"，并列为前置验证项。
- 已知与用户口述清单的差异：schedulePreplan 默认值、chatRhythm 已弃用（见 §0.1）
- **未核实项**：各分区在真机上的实际生效情况（无设备测试）、Urge 接开后调用量增幅（需实测）、NapCat 表情/原生表情接口可用性
- dispatch 白名单现状：`runtime/host.ts:115-215`（`qq.*`、`images.*`、`memory.*`、`maintenance.*`、`health`、`messages.*`、`story.*`）；`presetSync` 需新增 `preset.sync` / `preset.syncStatus`，其余纯配置模块只需改下发，不必新增 dispatch
