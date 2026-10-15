# Preview 8.1 源码核实记录

核实日期：2026-10-16。工作目录 `/root/hermes-workspace/hds-android`，分支 `main`，HEAD `3d69c29`；根 package.json 为 `0.1.0-preview.8`，内嵌上游为 `1.0.1-rc51`。以下行号是本次现场读取结果，实施时仍应按符号定位。未执行构建、测试、补丁或任何代码修改；这些命令可能写生成物，留到实施阶段。

开始时已有未跟踪 SPEC、`astra-8.1-events.jsonl`、`astra-8.1-stderr.log`、`astra-brief-8.1.md`；过程中另有外部产生的 `agy-audit-8.1*` 文件。均未编辑、删除或作为源码证据。此次仅新增本记录与 PREVIEW8.1-PLAN.md。

## D1–D13 核实与修正

下表路径均相对上述项目根目录。

| 缺陷 | 实际位置 | 核实结果 / 对规格的修正 |
|---|---|---|
| D1 | `apps/mobile-ui/main.tsx:215–223,241` | disabled 实为五个条件：非原生、非 healthy、busy、sending、满 3 张。disabled 按钮不会进入 pickImage，因此其内部提示无法解释这些条件。 |
| D2 | `main.tsx:116–149,150–179,215–222`；`runtime/host.ts:56–62,173,189` | 500ms 和焦点跳过在自动保存 effect，不在 persistSettings 函数本身；显式 await persistSettings 可立即排队保存。置位在 134；78 清 false；152 按 launchedSettings 重新计算 true/false；wake/restart/switchCard 在 160–179 先保存再启动。**syncStatus 当前只比较 normalizeMobileConfig(payload.current ?? mobile) 与启动时 mobile，不含 modelOptions/providers，也不是完整运行配置比较**。不能仅把 pickImage 的布尔判断替换成现接口调用。 |
| D3 | `android/app/src/main/java/io/hdsinterlude/android/HdsRuntimePlugin.kt:39–45`；`packages/contracts/index.ts:34` | ACTION_OPEN_DOCUMENT 未设置多选；RESULT_OK 但 data URI 为空就当取消；无 clipData。桥协议只返回单个 dataUri，UI 也只上传一次。需要 Kotlin、契约、UI 一起改。 |
| D4 | `apps/mobile-ui/ModelCenter.tsx:71–72`；`runtime/model-config.ts:18–22`；`runtime/host.ts:187–189` | 空 visionProviderId 映射 native，非空映射 sidecar。已校验独立连接存在且启用，未校验模型视觉能力。不能仅凭模型名对任意代理断言必然 400；真实缺陷是缺少能力声明/提示和错误可见性。 |
| D5 | `upstream/hds-interlude/src/narrator.ts:1693–1700`；`service.ts:5607–5611,12149–12158` | SPEC 引用 1695、12156 基本准确。原正则不识别“我七分钟后给你发消息”；命中原规则后 inferredFollowUpCommitment 固定 now+20min。只扩正则会登记错误时间。另有 narrator:1825 的通用 scheduled intent 指令，所以 delayed 不是唯一合法表达。 |
| D6 | `service.ts:12130–12146`；`index.ts:236,244–246`；`runtime/mobile-config.ts:5` | 函数入口 12130，实际 5 分钟字面量是 **12137**；还同时限制最大 12h。过短承诺被拒绝，不是向上钳制。delayed 默认 10s–1440min，是另一套独立边界。sweep Schema 已存在，范围整数 1–1440min、默认 5；移动白名单缺这项及承诺下限。 |
| D7 | `service.ts:1083–1091,4649–4651`；`android/.../HdsService.kt:25–59` | paused 判断是 **4650**。**已有 startForeground（45）、PARTIAL_WAKE_LOCK（41，37 续约）、健康通知刷新（25–36）**；57 为 START_NOT_STICKY，59 意外销毁会 stopAsync。缺的是受控恢复而非完全无保活。进程停止时当然不能执行内存计时器；不能由此断言前台聊天始终正常。 |
| D8 | `main.tsx:80,103–115,250–255`；`host.ts:177`；`service.ts:2004–2011,2055–2059` | 轮询有 effect 内 loading 防重入和 cancelled/profileRevision 保护；**缺的是跨入口单飞**。至少四个直接请求位置：refreshStory、轮询、手动刷新、暂停/恢复后刷新。后两处还未使用 revision 防护。三个 Tab 是条件渲染，MemoryTools 离开 Tab 会卸载；整个见闻页也条件卸载。entries 最新 80 条再 reverse 为正序；intents 只返回 pending、按 notBefore 升序、上限100。 |
| D9 | `main.tsx:84–102,211,236–241`；`host.ts:176` | 每秒历史轮询已有 polling 防重入，取最近200条 desc→reverse。**scroll effect 依赖 length，不是每次新数组都会滚动**；相同数量不会触发，达到200条后有新消息也可能不滚。setMessages 每次新数组确实引发组件渲染，但 React 有 key，不等于所有 DOM 被重建。应按末条身份、内容/状态变化、阅读位置区分。 |
| D10 | `main.tsx:205–213,239`；`host.ts:37–50,183–205`；`service.ts:2642–2654` | 用户 accepted 是入站已被核心接收/入队；receive 返回后异步叙事尚未完成，不是“模型没有回复才标 accepted”。host 的 visible 查询按用户 requestId 查 mobile_message，**不是查有无角色回复**。角色 delivered 表示已写本地消息库，不代表用户已读。UI 只特殊显示 card-opening，缺少状态解释。 |
| D11 | `main.tsx:53,241`；`apps/mobile-ui/style.css:1` | textarea rows=1，仅 CSS min-height42/max-height150，无 scrollHeight 自适应。 |
| D12 | `host.ts:62`；`service.ts:6929–6930,7350,10868–10891,10967`；`android/.../HdsRuntime.kt:114–119` | 固定 warn 属实。日志另有 verbosity 门控（缺省 standard），只改 level 不意味着出现 diagnostic/debug。原生已有已知凭据替换、每行1500字符/200行环形限制，方案应保留。 |
| D13 | `android/.../AppearanceStore.kt:43,54–87` | **已有** bounds 解码、inSampleSize 循环、缩放、EXIF、recycle；并非48MP全尺寸直接解码。聊天 edge=1024，采样中间最长边约≤2048；背景 edge=2048，约≤4096。主要可优化点是 bounded 的 ByteArrayOutputStream→toByteArray 完整压缩源复制，以及缩放/旋转/压缩并存；不能把规格的“24–50MB位图”当实测。48MP若全解 ARGB 理论约192MB，但当前代码已避免该路径。 |

## followUpCommitment 指令完整原文及条件

`narrator.ts:1693–1700`：只有 user-message 和 intent-due 返回非空指令，其他 phase 返回空串；在 systemPrompt 的 1807 行附近插入。

user-message 原文：

```text
If a visible reply promises a later answer, check or decision after thinking (for example “I will think about it and tell you later”), include followUpCommitment: {"kind":"thinking|checking|decision|emotional-settle","summary":"what answer is owed","notBefore":"future ISO-8601","expiresAt":"future ISO-8601 optional","sourceEntryIds":[1]} - never an unbound future-answer promise. When a listed commitment is answered or withdrawn now, include followUpResolutions: [{"id":1,"outcome":"fulfilled|rescheduled|cancelled","notBefore":"future ISO-8601 only for rescheduled"}].
```

intent-due 原文：

```text
For each dueIntents item of type follow-up-commitment, do not silently finish it. Return followUpResolutions for its id: fulfilled or cancelled requires a visible immediate outcome; rescheduled requires a visible honest status update and a future notBefore. If no visible outcome can be given, leave it unresolved rather than pretending it completed.
```

原兜底正则，`service.ts:12158`：

```js
/我(?:先)?想想|我去(?:想想|看看|查查|确认)|晚点(?:回|说|告诉)|之后(?:回|说|告诉)|等我.{0,12}(?:回|说|告诉)|整理.{0,12}(?:回|说|告诉)/
```

## 到期投递链（实施不得省略的前提）

1. `persistDecision:5601–5611`：需要 commit、participant、user-message、permitMessages 或已早流式投递，找到匹配的 **immediate outgoing-message event**，才把 commitment 绑到 event.metadata。不是 JSON 带 followUpCommitment 就立即入库。
2. `updateScriptDeliveryOutcome:7684–7697`：账本确认整个对应 action delivered 后重新 normalize（**第二调用点7690**），才 `appendFollowUpCommitment`。`normalizeDecision:12267` 是第一调用点；D6 两处都必须传阈值。
3. `appendFollowUpCommitment:6894–6930`：按来源事件/summary去重，同参与者最多2个 pending；payload 包含 userInitiated:true、requiresVisibleOutcome、expiresAt；随后 scheduleDueIntentWake。
4. `persistDecision:5856–5877`：delayed + content + sendAt + permitMessages 创建 delayed-reply，user-message 来源携带 userInitiated:true，并安排到期唤醒。
5. `scheduleDueIntentWake:6691–6708` → scheduler.scheduleWake → wakeDueIntents → sweep；busy 短候重排。只有 split-message 是已提交片段直接投递；delayed-reply/commitment 仍进入 intent-due 再生成/核对，不是计时器直接原样发送 payload.content。
6. `sweep:4649–4675` → advanceStory/advanceUnlocked → dueBatch → tryDecide(intent-due) → persistDecision → sendScheduledMessages/本地 Bot。`4879` 放行条件是 allowProactiveMessages **或** dueBatch 有 userInitiated:true；自动生活回合4838条件不同。后台预算、故事/参与者暂停、端点可用性、模型耗时等仍可阻止/推迟投递。
7. `4885–4886` 普通 due intent 按回合成功完成；commitment 排除在外，经可见投递回执+resolution才结算；`5838–5839,6970` 附近处理未解决承诺的后延。不能仅看 intent status 判定可见消息已送达。
8. 用户下一消息会在 `4333–4335` 带入已到期 liveNarrativeIntents；`script/intent-lifecycle.ts` 保留 commitment/delayed 等语义任务，但它只是机会性路径。`2613–2617,7060–7079` 新消息默认先取消普通 delayed-reply/cross-conversation-message；commitment 不被这条规则取消。取消时还清整故事 wake 并只重排 split，剩余承诺可能退回周期扫描，需在本次针对显式定时联系补回最早 pending wake。

## 构建/测试证据

- 根 package.json：`typecheck`、`build`、`build:host`、`test`、`android:sync`、`test:ui` 都存在；`npm test` **不包含** story-ui.mjs，必须另跑 `npm run test:ui`。
- `tests/story-ui.mjs:4,57`：需已启动 Vite；缺省 msedge，Linux 可设 HDS_BROWSER 为实际浏览器路径，HDS_UI_URL 缺省 localhost:5173。它模拟原生桥，不证明 Android 行为。
- 现有 tests 文件已核实：image-chat、preview7、preview8、host、model-config、message-contract、media；上游 test 下有 follow-up-commitment、scheduler、delivery-ledger、logging、time-context、sidecar-vision。
- 根 typecheck 的 tsconfig 只 include UI/packages 等，不覆盖完整 runtime/upstream；涉及核心须另用上游已有 typecheck script 和行为测试。
- `scripts/patch-mobile-hds.mjs` 是读写源码的字符串/锚点补丁：处理 endpoints/types/service，并单独处理 narrator；已有 includes guard，仅部分锚点 fail-fast。**尚不处理 index.ts**。新增 Schema 也必须加入同步逻辑，并对旧/已补丁/未知版本三态验证。
- `scripts/build-mobile-host.mjs` 只 bundle host/qq，并生成 contracts 和 Android assets 两份 schema；**不自动运行 patch-mobile-hds.mjs**。
- `scripts/build-runtime.py:192–193` 打包已有 generated/host.cjs；必须先 build:host 再打 runtime。根 README 230–249 有 android:sync、build-runtime.py、Gradle lintRelease/testReleaseUnitTest/assembleRelease 实际流程。

本记录只陈述读取到的代码与修正，不将源码推理或规划中的测试视为已完成运行验收。
