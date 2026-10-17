# Preview 9.1 方案（QQ 完全体 + rc56 基线 + 信箱返回）

上游基线：ISEKAI-MomoiCore/HDS-Interlude `1.0.1-rc56`（tag `01d13f5`，提交 b683baf）。
决策记录：升级 rc56；QQ 设置**还原电脑端配置面**（用户拍板）；上下文预算按群公告收紧为安全默认。

## M0 — 基线升级 rc51 → rc56

> agy 只读核查（/tmp/agy-result-91.txt）确认的额外硬缺口已并入：G-6 表情包回源路由未注册（host.ts:38-41 Koishi 实例未挂 Server/Router，`ctx.router` 为空，默认 5140 无监听，NapCat 拉图必败 → M2 必须挂载回源路由）；G-8 白名单好友未初始化为参与者（host.ts:156 仅登记角色自身 endpoint，好友首聊前收不到 Urge/Agency 主动私聊 → M1 顺带修）；G-9 好友无初始关系/昵称元数据（OneBotUserAccount 的 label/initialRelationship → M1 白名单行支持备注与初始关系）。

- `scripts/vendor-hds.mjs` 重导入 rc56 源码，按 `docs/MOBILE-PATCHES.md` 补丁纪律重放移动端补丁，重新生成 `runtime/generated/host.cjs / qq.cjs`。
- rc56 src/ 变更集中在 service.ts(+693)、narrator.ts、urge.ts、group-willingness.ts、weather.ts；群聊 schema（GroupChatRule）字段与 rc51 兼容，`willingnessAuto` 描述更新（五档生活节奏降维并入三态）。预设同步分区新增 `weather`。
- 同步更新三处版本引用：MOBILE-PATCHES.md、THIRD_PARTY.md、feature-parity.md（9a77fadb → b683baf / 1.0.1-rc56），重跑上游 837 项测试对齐。
- **安全默认修正**：`mapMobileConfig` 显式写入 `contextEntryLimit: 20, contextTimeWindowMinutes: 10`（rc56 默认仍为 35/45，host.cjs 内部 fallback 甚至 ?? 60）；`supportedFields` 白名单对这两个字段保持关闭，预设同步不可注入。

## M1 — QQ 设置还原电脑端

移动端设置面按 rc56 `GroupChatRule` 全字段还原，每群一页（桌面 console 的群规则表逐项对应）：

| 字段 | 形式 | 移动端默认 |
| :--- | :--- | :--- |
| enabled + 群号 | 白名单行 | 沿用现有 |
| label 群备注 | 文本 | 空 |
| purpose 群用途 | 多行文本 | 空 |
| characterRole 她在群里的身份 | 多行文本 | 空 |
| responseMode | 仅@ / 全部消息 | mention-only |
| willingnessPreset | off / quiet / reserved / normal / active / eager / auto / custom | off |
| keywords | 标签列表 | 空 |
| contextLimit | 数字 4–100 | 20 |
| debounceSeconds | 数字 0–10 | 1 |
| cooldownSeconds | 数字 | 60 |
| historicalImageLimit | 数字 0–6 | 3 |

- custom 数值门（threshold/amplifier/decay/replyCost/baseGain/quoteGain/keywordGain）折叠在「自定义」下，选 custom 才展开；不选不见。
- `willingnessAuto` 三态映射不进 UI（rc56 降维逻辑自动处理，无需人工配置）。
- runtime.contextEntryLimit / contextTimeWindowMinutes：按桌面端同样暴露，但默认 20/10、max 钳制 25/1440→按公告建议 25/10 上限，附「超过会显著增加消耗」警示文案。
- `applyPolicy()` 改为读取每群配置而非写死 mention-only/20/1/60。

## M2 — chatActions 全量 + 群表情包 + 向量/搬运补齐

- 删除 `mobile-config.ts` 中 `messageReactions: false, nativeFaces: false` 两处硬编码；schema 增补 messageReactions / nativeFaces / allowedReactions / allowedNativeFaces。
- 验证 NapCat `setMsgEmojiLike` 与 face 编号在移动 PRoot 实际可用（LifeSettings「尚未验证」遗留）。
- 群聊回复挂 stickerCatalog → `sendSticker` 经 HTTP 回源 URL 投递 QQ 群；顺带完成 9.0 计划遗留的「贴纸包可见范围」设置。
- **G-6 修复**：Koishi 实例挂载 Server/Router 插件注册表情包回源路由（host.ts:38-41 现状 `ctx.router` 为空、NapCat 拉图必败）。
- **Embedding 向量检索入口（搬运补齐）**：ModelCenter 模型分工加「向量」角色（useForEmbedding）；设置暴露 embedding.enabled 开关 + liveQuery（默认关，省每轮请求）；endpoint/model/dimensions 走留空自动推导，不进 UI；schema 增补 embedding 分区（对照上游 index.ts:127-136）。
- **weather 分区（rc56 新增搬运）**：mobile-config schema 增补 weather 分区，预设同步已支持，引擎零改动。
- **AudioUnderstanding 核实**：确认移动端语音理解链路与上游 AudioConfig 的关系，有缺口如实报告再定是否搬运。

## M3 — 语音出站到 QQ

- TTS→SILK 转码后以 `record` 段经 OneBot 发送；mobileVoice 生效范围从 `platform === 'mobile-local'` 扩到 onebot。
- PRoot 无 ffmpeg：先做 arm64 可行性验证（静默降级路径已有），失败则仅发文字稿。
- 语音三重克制（阈值/冷却/日 token 上限）复用现有设置，不新增配置。

## M4 — 信箱返回按键 + 折叠式设置全面铺开 + 全量搬运补齐

> 用户拍板：电脑端可自定义剧本 + 全量搬运。新增 M4 子项：storyDefaults 运行时编辑、schedulePreplan、timelineDirector、memory、worldSeeder、longHorizon 六个搬运项，均走折叠式呈现（M4 折叠框架内）。不进的：sharedStory（多账号）、browser（PRoot 无 Puppeteer）、qzone（需 SnowLuma）、blindMode/logging（运维向）。

### 返回按键（用户侧交互）

- 信箱页头新增「← 返回空间」按钮，复用 cards 页 `text-button` 样式（main.tsx:492 既有模式）。
- 交互层级（用户预期顺序）：策略弹窗/登录面板打开 → 返回=先关弹窗；会话详情展开 → 返回=收起详情；无浮层 → 返回=回空间页。
- Android 实体返回键接入 `MainActivity` WebView `onBackPressed`：按上述层级拦截，最外层不退出应用（先回空间页，再按才退出）。当前 MainActivity.java 无任何返回键处理，属缺失。
- 导航栏现状保留：信箱时「空间」高亮已有（main.tsx:533），与顶部返回按钮形成双出口。

### 折叠式开关（渐进披露，样式零新增成本）

现有基础：`<details>/<summary>` 原生折叠已在 LifeSettings（5 组）、Voice、Inbox（群聊分组）、NotificationSettings、AppearanceSettings（7 处）落地；style.css 有 `summary` 通配样式与 `.model-center` 的 ＋/− 展开指示器可直接复用。9.1 把它升级为整个设置面的组织原则：

**分层规则（用户只看到当步需要的）**：

1. **首屏 = 开关层**：每个功能组一行 `<details>`，summary 即标题+一句话副标题+组级开关。收起时就是一张清单，用户扫一眼知道有什么、开没开。LifeSettings.tsx:46 已是这个形态，作为标准模板推广。
2. **点开 = 参数层**：常用参数直接展示（语音三重克制、活跃度档位、冷却分钟）。
3. **「高级」再折叠一层**：真正低频的进内层 `<details>`——QQ 的 custom 数值门、表情回应的 allowedReactions 白名单、模型生成参数（temperature/topP/maxTokens）、预设同步。默认收起，永远不占首屏。
4. **开关状态外显**：summary 右侧显示当前状态徽标（开/关/「活跃 · 标准」这类档位值），收起也能读出配置结果，不用点开核对。

**各页面落点**：
- 每群规则页（M1 新增）：基础=开关+备注+活跃度；「高级」折叠=custom 数值门/关键词/上下文条数/冷却/历史图片。
- 模型中心：provider 编辑器套 `model-center` 既有折叠样式；生成参数整体进「高级」。
- 贴纸/语音：组级开关+频率档位在外，阈值/白名单/音色参数进次级折叠。
- 一致性约束：整个 App 折叠不超过两层（组→高级），任何设置三步内可达；summary 触控区 ≥44px（style.css 已有 min-height:40px 底线，提到 44）；「高级」徽标灰显，与主开关的 accent 色区分，暗示"非必要不动"。

**与「还原电脑端设置」的关系**：还原的是字段完整度（M1 十一字段全在），折叠管的是呈现节奏——首屏开关、点开常用、深挖高级。桌面 console 一屏平铺所有字段，手机等价物就是这套三层折叠。

### 全量搬运补齐（折叠框架内）

- **storyDefaults 运行时编辑**：StoryView 故事页新增「修改故事设定」入口，复用 `story.applySetting` RPC（host.ts:247 已就绪）；编辑 storyDefaults 的 characterName/characterProfile/world/relationship/perspective/timezones/supplementaryFacts；「高级」折叠内。这是"电脑端自定义剧本"的移动端等价物（角色卡导入已能编辑，缺运行中修改）。
- **schedulePreplan 日程预排**：搬运分区到 mobile-config schema；默认开启（对齐上游），折叠展示每日计划模板/时段。
- **timelineDirector 时间账本**：搬运分区；默认开启，折叠展示开关+熔断说明。
- **memory 记忆配置**：搬运分区；默认 20 条记忆/相关性重排，折叠展示上限与检索开关（含 embedding 联动说明）。
- **worldSeeder 外部事件注入**：搬运分区；折叠展示事件源开关。
- **longHorizon 长线叙事催化**：搬运分区；折叠展示周期与强度。

每个搬运项：schema 增补分区 + mapMobileConfig 显式默认 + 折叠 UI（组级开关在外、参数内层）。

## 验收

- rc56 基线：上游测试全绿 + feature-parity.md 重新机械盘点。
- 群聊：同一测试群内 @ 触发、always+normal 档自发插话、引用回复、表情回应、原生表情、表情包图片、冷却不刷屏。
- 私聊：主动消息经 OneBot 到达；语音消息可播。
- 设置：每群规则保存/生效往返一致；contextEntryLimit=25 时输入 tokens 记录对比（防 35000+ 回归）。
- 信箱：返回按钮 + 实体键三层级行为手测。
- 折叠设置：每个设置项三步内可达；收起状态可读出开关/档位状态；深色模式下展开指示器可见。

## 顺手修

- gh workflow 产物命名两行 preview.8 → 9.1（需 OAuth token 补 workflow scope 后）。
- README 下载区更新。
