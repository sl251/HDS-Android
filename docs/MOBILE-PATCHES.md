# 移动宿主与上游边界

HDS 原始版本为 1.0.1-rc56，固定提交 b683bafcac42c99a45929e0516195f033f969665。原始 AGPL LICENSE 和文档保留；宿主不重写叙事协议、事实提交或记忆层。

- endpoints.ts、types.ts、service.ts：增加 local 通道类型，mobile-local 端点不冒用 QQ 身份。
- narrator.ts：增加可选角色卡上下文钩子。原始引擎系统指令保持第一条，角色/示例/世界书与引擎契约分开，creator_notes 不注入。
- service.ts：开场白以幂等 character-message 进入真实剧情；关停前暂停调度并等待进行中的流式叙事、串行任务与端点/数据库写队列，避免数据库卸载后仍写快照。
- runtime/host.ts：创建真实 Koishi、SQLite WASM 与 HDS 插件，提供限于本机的令牌鉴权 RPC、本地消息投递回执、持久入站 requestId。API 密钥通过 stdin 传入，不放进命令行参数。

`scripts/vendor-hds.mjs` 重新导入会覆盖补丁，请先保留 Git 差异。JSON/PNG 卡的原始文件与未知字段保留；世界书当前支持常量/关键词/次级关键词、顺序与预算，不执行正则或扩展脚本，完整递归规则、CHARX、压缩 PNG 元数据尚未实现。

自动测试使用固定模型响应验证真实引擎，不等同于付费模型服务实测或 Android 真机验收。原始 HDS 基线的已知失败见 docs/evidence/T01/baseline.md；没有为获得通过而改写原始断言。

preview.4 的模型分工直接使用原 HDS provider flags / failover / SSE 路由。typ0 人设使用原生 storyDefaults 和 updateSetting，Tavern 继续使用上下文钩子；当时保留 rc51；Preview 9.1 M0 现已整体升级 rc56。

Preview7：复用原版 sidecar/native 识图路由，原生桥接新增图片压缩、外观文件与故事存档事务。见闻管理复用原版事实、待办、overlay 和 compact API；`mobileManageFact` 在修改前失效旧叙事工作并刷新连续性缓存。详见 `docs/PREVIEW7.md`。


## preview.8 model request budget

`src/narrator.ts` adds an optional mobileBeforeRequest hook before embedding, plain/proxy JSON and streaming model transports. The Android host installs a persistent rolling 24-hour limiter; ordinary upstream use leaves the hook unset. Direct user-message narrative requests pass foreground=true. Manual compaction uses a scoped asynchronous exemption that expires on completion. Budget errors abort provider retries without changing model credentials or the HDS output contract. Evidence: `tests/preview8.test.ts`, upstream suite baseline comparison in `docs/PREVIEW8.md`.

Preview 9 M4：`src/service.ts` 的 `stickerCatalogForSession` 在原 OneBot 门禁之外增加 `mobile-local`，仍受 `stickers.enabled` 控制；QQ/桌面动作与扫描、描述、决策、阈值、发送逻辑不变。`src/narrator.ts` 导出既有 `stickerInstruction` 以锁定空清单返回空字符串的契约，并新增默认未设置的 `mobileSystemPrompt` 钩子。宿主在当前请求无 catalog 时用它移除通用 prompt 中的三句 sticker 举例及一处平台动作示例；QQ 保持原始 prompt。App 启动前同步用户当前包清单，原生将原件复制到当前 profile 的 `stickers/<包名>/`，宿主仅在导出非空时启用上游贴纸功能，沿用视觉描述及无视觉模型告警。LocalBot 将已登记资产 URL/库内文件注册为持久 media ID，角色纯图片无气泡展示；不再依赖用户已发送贴纸映射。用户历史原件及已注册 media 不随包删除。角色专属包过滤留待后续：当前 App 库为全局库，上游 group 保留包名，未新增分组授权或改变 QQ 策略。回归见 `tests/m4.test.ts`、`tests/story-ui.mjs`、`StickerStoreTest.kt`。


Preview 9 M5：`src/types.ts` 仅增加可选的 `voice` 能力、决策与出站提示。`src/narrator.ts` 的 `voiceInstruction` 在能力缺失/关闭时严格返回空串，普通与 lite 提示均沿用克制意愿协议。`src/service.ts` 通过默认未设置的 `model.mobileVoiceCapabilities` 钩子，仅为 mobile-local 读取当前角色能力；包括无人发消息时的本地故事推进。最终归一化消息携带合法的 willingness，仅通过 mobile-local 原有发送方法的可选参数透传该提示，保留发送钩子与失败回执语义；QQ 原调用保持原样。开启语音的本地用户回合等待最终决策，避免实验流式首条先投递后重复合成。

音频 IO 全在 App 层：`runtime/voice.ts` 向 Android 的随机端口、令牌鉴权回环桥发送最终可见正文及角色风格；上游不接触音频或 TTS。Android `MimoTtsClient` 使用任务书指定的 api-key 头、user 风格 / assistant 正文及 audio 参数；三个模型按内置、描述、参考音频选择。密钥沿用 Android Keystore AES-GCM 保存，宿主只读取非秘密能力配置，Mimo 密钥不传入 PRoot。`VoiceStore` 在 noBackupFilesDir/hds/voice 原子保存音色、WAV 和日账本，试听/聊天共用锁、持久化日 token 限额与每角色回复冷却。超时或回执无 token 时保留预记账，下一次已达上限即不再请求；实际成功回执按 usage 校正，单次返回可能使累计量越过上限。自然日按设备时区重置，日限提示只消费一次。0 可关闭日限/冷却。

`mobile_message.audio` 是新增 JSON 列，旧消息缺失或 {} 归一化为空，原有 images 不变；历史接口统一输出 ISO 时间，与 JSON RPC 的既有时间格式一致。角色关闭语音时聊天只展示文字；开启后有 audioId 的消息呈现播放/时长和可展开的原文字稿；离开聊天时取消尚未返回的播放请求。录音采用 MediaRecorder AAC，SAF 接收 wav/mp3，压缩音频经 Android MediaExtractor/MediaCodec 转 16-bit PCM WAV 后用于克隆。音色删除清除绑定并回退默认，历史 WAV 不删除。浏览器真实 HDS 场景、旧库迁移与原生 mock 端点覆盖分别见 `tests/m5-ui.mjs`、`tests/m5.test.ts`、`VoiceStoreTest.kt`；真机麦克风、编解码器与付费 Mimo 实测不由这些测试替代。

## Preview 9.1 M0 — rc56 基线与完整重放

固定上游为 `1.0.1-rc56` / `b683bafcac42c99a45929e0516195f033f969665`。导入读取 Git 对象而非工作树：

```sh
node scripts/vendor-hds.mjs /tmp/hdsi-rc56
node scripts/patch-mobile-hds.mjs
npm run build:host
```

无路径参数时 vendor 脚本使用 `.references/HDS-Interlude`，缺失时浅克隆 rc56；导入前核验 tag 解引用后的完整提交。导入替换整个 vendor 树（含上游文档、测试、LICENSE 和原包），须先保留本地改动。`scripts/mobile-hds-rc56.patch` 是针对纯 rc56 的完整移动端源码差异，重放时逐块唯一匹配，未知上下文报错，所有文件验证成功后才写入，重复执行保持幂等。它也补齐了旧脚本未覆盖的预算、关停追踪、贴纸与语音补丁。没有改动 npm 依赖版本；rc51/rc56 的依赖声明相同。

兼容修正：投递后承诺确认读取可选的 `config?.runtime?.minimumFollowUpCommitmentSeconds`，裸测试桩缺配置时沿用既有 300 秒默认，避免把已投递承诺留在 pending；真实宿主配置语义不变。`scripts/mobile-hds-rc56-tests.patch` 只为 `test/split-follow-up-scheduling.test.ts` 的三项 outbox ownership 测试固定 Date 到其 `now`：既有移动端未来唤醒补丁使用真实时钟筛选，原桩的 2026-10-10 + 5 秒在运行日已过期。原始 rc56 无此未来筛选，原桩可通过；这是重放后的测试时钟适配，全部原断言保留。重放脚本在存在 vendored 测试时一并应用。浏览器测试另等待当前模型配置实际完成自动保存，避免沿用上一项保存提示，断言不变。

| 重放意图 | rc56 落点 |
| --- | --- |
| 独立 local 身份与端点，不冒用 QQ | `src/endpoints.ts` 的通道联合类型、角色/参与者端点推导与归一化；`src/types.ts` 通道元数据；`src/service.ts` 的 `addStoryEndpoint`；`src/index.ts` 的 ChatActions 平台枚举 |
| 角色卡与世界书上下文、引擎指令保持首条 | `src/narrator.ts` 的 `ModelConfig.mobileCardPrompt` 与 `requestBody.messages` 注入 |
| 幂等开场白 | `src/service.ts::mobileRecordLocalOpening`，仅 local 的真实 character-message |
| 见闻人工管理及旧任务失效 | `src/service.ts::mobileManageFact`，调用原有 add/forget API、失效旧叙事及连续性快照 |
| 关停排空 | `src/service.ts::flushBufferedNarrative` 的任务追踪与 `mobileDrainBeforeStop`，暂停调度、等待叙事/串行/端点/数据库队列后卸载。追踪直接包装原函数体，兼容上游原型测试桩；未改失败重试或事实提交语义 |
| Preview 8.1 显式定时联系（沿用既有补丁） | `src/index.ts` 的 minimumFollowUpCommitmentSeconds；`src/types.ts` 的 scheduled-contact/policy；`src/narrator.ts` 的 A/B 联系计划及策略透传；`src/service.ts` 的时间识别、计划校验、登记状态、到期协调与真实投递后确认。仍走上游 intent、authoring 和投递账本 |
| 持久后台模型请求预算 | `src/narrator.ts` 的 `mobileBeforeRequest`，覆盖 embedding、普通/代理 JSON 与 SSE；预算错误终止提供方重试，直接用户叙事按 foreground 豁免 |
| 移动端贴纸与空库提示 | `src/service.ts::stickerCatalogForSession` 增加 mobile-local；`src/narrator.ts` 导出 `stickerInstruction`、保留默认未设置的 `mobileSystemPrompt`。rc56 新增的 lite 动作/引用/贴纸提示完整保留 |
| 本地语音决策与提示透传 | `src/types.ts` 的可选 voice 能力/决策/出站提示；`src/narrator.ts::voiceInstruction` 普通与 lite 提示；`src/service.ts` 的 local 能力、自动回合、最终决策归一化、禁用语音回合早发及发送 options。音频 IO 仍全在 App 层 |

冲突按意图解决：配置项搬迁只补回移动端新增字段；天气/生活节奏新导入及逻辑保留；QQ 私聊保留 rc56 的 `withTransportTimeout`，local 发送沿用等待 App 语音降级与持久回执的原有完成语义。`urge.ts`、`group-willingness.ts`、`weather.ts` 及事实/记忆实现均直接取 rc56，未叠加新改写。

安全默认在宿主 `runtime/mobile-config.ts::mapMobileConfig` 显式写入 `contextEntryLimit: 20, contextTimeWindowMinutes: 10`，不依赖上游 35/45 或内部 `?? 60`。`supportedFields` 的既有字段列表保持原样，这两项不进入设置 schema，直接输入拒绝、预设同步剔除。回归见 `tests/preview8.test.ts`。

构建继续生成 `runtime/generated/host.cjs`、`qq.cjs`（沿用 .gitignore，不强制加入 Git）及两份移动设置 schema。rc56 的 tsconfig 引用未随源码提供的 Koishi monorepo 基础配置，宿主 esbuild 显式采用本仓库 tsconfig；没有修改上游构建配置。

rc56 行为关注点：Urge 采用五档节奏与对话密度的乘法调度、群聊 auto 将五档映射为三态；天气增加幻想世界门禁；预设同步允许 `weather`，移动白名单仍拦截；Alter 默认最大输出 token 400→2000（上限 2000→16000），可能增加分析请求开销；QQ 传输超时按上游结果未知语义处理。M0 不扩展 QQ 设置、主动好友初始化、表情包 HTTP 回源或 QQ 语音能力，仍需后续里程碑与 Android/真实模型验收。

## Preview 9.1 M3 — QQ 语音出站（宿主构建覆盖层）

本里程碑不写入 `upstream/`，也不重放或改动 M0 的完整补丁。`scripts/mobile-onebot-voice.mjs` 在 `build-mobile-host.mjs` 的 esbuild onLoad 中对已重放 rc56 的 `service.ts` 施加内存补丁；锚点未知或不唯一时构建失败，重复应用幂等。源码直读的上游测试仍测试原有移动补丁版本，M3 集成测试加载带覆盖层的实际 `runtime/generated/host.cjs`。

覆盖层在 `tryDecide` 判断实验流式早发之前，为 OneBot 私聊、群聊和自动回合合并当前角色的既有 voice 能力，保留原有引用、表情等能力的门禁。最终 willingness 传入私聊 session/bot 两条投递路径，以及即时/账本群聊路径。QQ 文本仍通过原有 send 方法、授权门禁、transport timeout 和回执检查；成功后立即返回回执并由宿主跟踪可选音频任务，避免慢 TTS 把文字账本留在 pending 而被补偿扫描重发。关停时等待已登记的音频任务结束；已停用的 QQ 通道仍通过原发送门禁拒绝迟到的语音。未安装宿主回调时沿用原发送表达式。

`runtime/voice.ts::oneBotVoiceDelivery` 调用与本地完全相同的 `localVoiceDelivery`：Android `VoiceStore` 继续统一执行角色阈值、跨通道每角色回复冷却、全局自然日日 token 账本，不增加配置或重复计费重试。通过 `/hds-voice/<audioId>.wav` 读取已校验 ID 的普通文件（最多 10 MiB），交由受 10 秒期限约束的 Worker 使用 `silk-wasm@3.7.1` 编码为腾讯 SILK；不调用 ffmpeg、shell 或 native addon。Koishi 将音频 data URI 编码为独立的 OneBot `record` / `base64://` 段，私聊与群聊共用实现。语音发送另有 15 秒等待上限，合成/读取/编码/record 失败均保留文字回执，不重发正文、不向用户输出错误。编码失败时已发生的原生 TTS 用量与冷却保持记账。

重新构建 host 后还需使用更新的 `runtime/profile/package-lock.json` 重建 guest 才能在 Android 获得新依赖；仅替换旧 guest 的 host 文件时依赖缺失会降级文字。验收与设备验证边界见 `artifacts/preview9.1-m3/ACCEPTANCE.md`。

## 表情包与语音互斥投递修正

本次继续在 `scripts/mobile-onebot-voice.mjs` 的宿主构建覆盖层实现，不修改 `upstream/`。有可用表情库时关闭文字早发；命中有效表情后将决策归一为独立表情，移除附带文字回复与语音意愿。宿主提示同步说明文字、语音、表情三选一。OneBot 表情通过 internal JSON 接口发送 `image`、`sub_type: 1` 与 `summary: '[表情包]'`，避免 Koishi 元素属性转换成 `subType`。

此修正取代上一节的“先确认文字，再补发语音”行为：QQ 先完成合成与编码，语音成功时以其回执完成投递；合成、读取或编码失败，以及 OneBot 明确非零 retcode 拒绝时回退文字。语音超时、网络错误或空回执按结果未知处理，不追加文字。宿主等待所选媒介投递结束，沿用上游执行键防止并发补偿发送，关停继续排空已登记任务。原生额度、冷却及角色意愿门禁保持生效。

回归入口为 `tests/media-controls.test.ts`、`tests/preview91-m3.test.ts`、`tests/m4.test.ts` 与 `tests/media-controls-ui.mjs`；Android 表情导入门禁、AtomicFile 清单及共享存储锁由 `StickerImportPolicyTest`、`StickerStoreTest` 验证。真实手机 QQ 收发仍待验收。
