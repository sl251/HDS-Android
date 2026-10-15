# Preview 8.1 实施方案

状态：规划完成，尚未实现或执行验收。基线：`main / 3d69c29 / 0.1.0-preview.8`，项目根目录 `/root/hermes-workspace/hds-android`。本次仅写本文件与 [源码核实记录](evidence/astra-8.1-notes.md)，不改源码、不提交 git。下列“改动文件”“命令”均指后续实施工作。

## 1. 结论、边界与依赖

按 Phase 1 图片链路 → Phase 2 聊天/见闻体验 → Phase 3 主动消息/配置 → Phase 4 诊断/资源执行。每阶段先完成其行为测试和 Linux 检查，再进入下一阶段；最终 APK 必须完成独立真机验收。D11、D12、D13 全部纳入；D7 的受控重启、Doze/厂商策略与恢复交给 Preview 8.2 / T13，本版只修正文案与建立观测基线。

关键事实修正：

- `preset.syncStatus` 目前只比较 mobileConfig，必须扩充识图运行配置比较，不能直接拿现接口代替 restartNeeded。
- 见闻轮询和聊天轮询各自已有防重入；要解决跨入口竞争。聊天滚动只依赖 messages.length，非每次新数组都会滚动。
- accepted 表示核心已接收并异步入队，不能当失败，也不能说已得到角色回复。
- 承诺现有到期定时器会主动唤起 sweep；不是固定等5分钟，更不是必须用户再次发消息。默认 delayed 范围10s–1440min，commitment另有5min–12h限制。
- Android 已有前台服务、唤醒锁及健康通知刷新，缺少受控重启；图片也已有降采样，应优化压缩源整读和中间对象峰值。

约束：保留单故事串行、requestId幂等、后台预算、用户主动停止与恢复存档的暂停语义；不扩展语音/撤回/引用等业务，不引入付费依赖。不能用关闭预算或全局开启主动联系来掩盖定时消息问题。

### 缺陷 → 需求 → 阶段映射

| D | 核实证据（相对项目根）与修复理由 | R | 阶段及完成判据 |
|---|---|---|---|
| D1 | main.tsx:241 五个禁用条件无原因反馈 | R1/R5 | P1；各条件均有可读原因，无无效原生调用 |
| D2 | main.tsx:116–179,215；host.ts:173 只比生活设置 | R1/R5 | P1；保存屏障+真实识图配置比较，快速切页也不会绕过 |
| D3 | HdsRuntimePlugin.kt:39–45 不处理 clipData | R1/R5 | P1；单选/多选/部分失败可见，始终≤3张 |
| D4 | ModelCenter.tsx:72；model-config.ts:18–22；host.ts:189 | R1/R5 | P1；能力未知须明确确认，声明不支持时阻止发图，sidecar可配 |
| D5 | narrator.ts:1693–1700；service.ts:5607–5611,12149–12158 | R2/R5 | P3；定时语义、时间解析、落库及无新消息到期链通过 |
| D6 | service.ts:12137；index.ts:236；mobile-config.ts:5 | R2/R5 | P3；阈值Schema化、扫描周期白名单化、旧配置兼容 |
| D7 | service.ts:4650；HdsService.kt:37–59 已有FGS/wake lock | R5/后续T13 | P3说明边界、P4真机记录；P8.2实现受控恢复，不算8.1保活修复 |
| D8 | main.tsx:80,103–115,250–255；host.ts:177 | R3/R5 | P2；所有刷新统一协调，按角色/Tab恢复位置 |
| D9 | main.tsx:84–102；host.ts:176 最近200条 | R3/R5 | P2；上滑不跳，底部跟随，200条窗口滚动也能识别新消息 |
| D10 | host.ts:183–205；service.ts:2642–2654；main.tsx:239 | R3/R5 | P2；已接收与回复分开表示，失败/未知可安全重试 |
| D11 | main.tsx:241；style.css:1 | R4/R5 | P2；输入自动增高到150px，清空收缩，中文输入法可用 |
| D12 | host.ts:62；service.ts:10868–10891 | R4/R5 | P4；info/standard可见且保持脱敏和日志上限 |
| D13 | AppearanceStore.kt:54–87 已有inSampleSize | R4/R5 | P4；去掉完整压缩源堆内复制，真机大图无崩溃并测峰值 |

完整行号修正、prompt原文和投递链见 evidence；这里缩写的 main.tsx/host.ts/narrator.ts/service.ts 分别在 apps/mobile-ui、runtime、upstream/hds-interlude/src。

## 2. 公共验收与补丁规则

以下命令均使用现有脚本/测试入口。规划阶段不运行。根目录执行命令前需要已安装仓库锁定依赖；UI测试需本机可用 Chromium/Edge，Android构建需JDK21、SDK35及依赖。缺环境应记录“未验/阻塞”，不得写“通过”。

```sh
cd /root/hermes-workspace/hds-android
npm run typecheck
npm test
```

UI检查开两个终端：

```sh
# 终端A，保持运行
cd /root/hermes-workspace/hds-android
npm run dev -- --port 5173 --strictPort
```

```sh
# 终端B；若实际浏览器安装路径不同，替换为查到的真实路径
cd /root/hermes-workspace/hds-android
HDS_BROWSER=/usr/bin/chromium HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

`npm test` 会生成 host bundle 和两份 schema，但不跑 story-ui.mjs；UI fixture 不可冒充真机证据。根 typecheck 不完整覆盖核心，P3必须补跑上游typecheck。

所有涉及 `upstream/` 的修改都必须同步 `/root/hermes-workspace/hds-android/scripts/patch-mobile-hds.mjs`。本版的核心改动集中在P3；如果P1/P2/P4实施时确需触及上游，也执行相同规则：

1. 用窄锚点替换/插入，逐项识别“原版待补丁”“已补丁”“未知源码”。已补丁跳过；未知锚点抛错，禁止悄悄漏应用或重复插入。
2. 将 index.ts 纳入补丁处理，覆盖Schema、RuntimeConfig、types、narrator指令、service两次normalize调用、推断与到期行为。测试用例也要随更新保留，核心逻辑不能只手改 vendored 源码。
3. 修改现有 tests/preview8.test.ts，在临时目录中放置本基线相关原文fixture，验证首次应用、第二次零差异、缺失锚点明确失败；同时与实际源码的补丁后片段比较。临时测试不要修改真实上游目录。
4. 在后续实现工作区应用补丁后再构建。`build:host` 本身不会调用补丁；runtime打包也不负责重新编译host。

```sh
cd /root/hermes-workspace/hds-android
node scripts/patch-mobile-hds.mjs
npm run build:host
```

最终APK按已有流水线构建；先生成新host/schema，再同步Web，再打包guest，避免把旧host塞入新APK：

```sh
cd /root/hermes-workspace/hds-android
npm test
npm run android:sync
python3 scripts/build-runtime.py
cd /root/hermes-workspace/hds-android/android
./gradlew lintRelease testReleaseUnitTest assembleDebug
```

使用debug包做真机验收，无需为规划索取签名凭据。发布签名包沿仓库已有受控流水线处理。版本更新列为P4收尾：package.json/package-lock.json、Android versionName/versionCode一致，不能在本规划回合修改。

## 3. Phase 1 — 图片选择、配置生效与模型能力

### 改动文件（绝对路径）

- `/root/hermes-workspace/hds-android/apps/mobile-ui/main.tsx`
- `/root/hermes-workspace/hds-android/apps/mobile-ui/ModelCenter.tsx`
- `/root/hermes-workspace/hds-android/apps/mobile-ui/style.css`
- `/root/hermes-workspace/hds-android/packages/contracts/index.ts`
- `/root/hermes-workspace/hds-android/runtime/host.ts`
- `/root/hermes-workspace/hds-android/runtime/model-config.ts`
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/HdsRuntimePlugin.kt`
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/ModelSettingsCodec.kt`
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/HdsStore.kt`（透传能力字段、核实启动配置）
- `/root/hermes-workspace/hds-android/tests/image-chat.test.ts`
- `/root/hermes-workspace/hds-android/tests/model-config.test.ts`
- `/root/hermes-workspace/hds-android/tests/preview7.test.ts`
- `/root/hermes-workspace/hds-android/tests/preview8.test.ts`
- `/root/hermes-workspace/hds-android/tests/story-ui.mjs`
- 原生测试：`/root/hermes-workspace/hds-android/android/app/src/test/java/io/hdsinterlude/android/ModelSettingsCodecTest.kt`。

本阶段不需上游修改；不以模型名称黑名单推测所有服务商的能力。

### 关键流程与实现要点

1. **解释入口状态。** 用一个有顺序的原因函数处理非原生→未healthy→正在操作/发送→满3张→识图未开启。对可交互的“＋”使用 aria-disabled + handler返回提示；真正disabled的忙碌状态在旁边持续显示原因并通过 aria-describedby关联，不能指望disabled收到click。提示沿用顶部notice/输入区短文案。
2. **保存屏障。** 点“＋”先锁定本次操作，await persistSettings；这会绕过自动保存effect的500ms/焦点跳过。保存失败不打开图库。捕获 profileRevision、当前设置版本；保存/检查/图库返回/每次上传后复核，切角色或停止核心即废弃结果。锁用ref或共享单飞，避免React下一次render前双击重入。
3. **扩充 syncStatus，不冒用旧语义。** 保留 `{current: MobileConfig}` 旧请求；新增可选 `currentVision`，包含 enabled、native/sidecar、所选provider ID，以及影响此路线的非敏感 endpoint/protocol/model/启用状态/主模型候选顺序/能力声明。共享规范化投影比较desired与启动时实际config；端点规范化、默认值补齐、对象键顺序不应制造假差异。响应新增 `visionRestartRequired`、`activeVision`、安全的reason codes，`restartRequired` 为请求中已提供各域的OR；不返回或比较明文凭据。
4. **区分通用重启提示和识图拦截。** pickImage以visionRestartRequired及activeVision为准；LifeSettings旧调用继续只检查生活配置。通用restartNeeded保留其他设置/凭据改动的dirty提示，不能以“识图已匹配”清掉其他待重启变更。healthy后重新核对，启动期间继续编辑时仍提示；查询失败不视为已同步。已选附件在send前再核对识图路线，host继续做最终校验。
5. **多选契约。** `pickImage({limit?: number})`，limit钳制1–3，UI传剩余空位。新响应 `{cancelled, images:[{dataUri}], errors?:[{index,message}], truncated?:boolean}`；过渡期UI仍接受单dataUri。Kotlin启用EXTRA_ALLOW_MULTIPLE，合并clipData和data URI并去重，先截断再在现有单线程io执行器逐张解码。无成功项且有失败必须报错，不能伪装取消。逐张上传保持顺序，失败保留已成功附件并列出失败项；同内容hash去重，总量≤3，取消不改原附件。
6. **能力提示。** ModelProvider新增可选 `imageInput: 'unknown'|'supported'|'unsupported'`，旧配置默认unknown，原生normalize/publicRows及host启动透传一致；换endpoint/protocol/model时重置为unknown。UI明确“沿用主叙事会直接发送图片给当前主模型；文本模型请选择独立识图”。unknown时要求用户在模型设置确认支持或选择sidecar；unsupported在UI/host阻止图片请求。native模式对可能参与故障切换的主模型候选逐项检查，不能首选支持却回退到文本模型；sidecar仅要求实际识图候选支持，主叙事允许文本。声明只是用户确认，服务端仍可能拒绝；400/异步模型失败由P2状态说明与P4日志呈现，不能凭声明显示“验证成功”。

### 新增/修改测试与Linux可验项

- image-chat/preview7：native与sidecar真实host；识图未开启、未重启、能力unsupported/unknown、故障切换候选不兼容；正确sidecar只把观察交主模型。配置比较测试含“仅生活配置变化”“仅vision开关”“独立模型切换”“同配置不同对象键顺序”。
- model-config/ModelSettingsCodecTest：能力字段往返、旧值默认、修改连接后重新确认、非法枚举拒绝。
- story-ui：小于500ms切页点＋、输入框仍聚焦、保存失败、快速双击、健康切换、重启期间再次编辑；五种不可用原因；data-only/clipData等效桥fixture、取消、超过剩余容量、部分上传失败、切角色旧回调、附件删除再选。
- 真正clipData提取与ContentResolver不靠Node测试证明。新增原生instrumentation测试建议放 `/root/hermes-workspace/hds-android/android/app/src/androidTest/java/io/hdsinterlude/android/ImagePickerTest.kt`（拟新增），覆盖单data、多clip、混合去重和RESULT_CANCELED；现有instrumentation依赖已在app/build.gradle。

```sh
cd /root/hermes-workspace/hds-android
npm run typecheck
npm run build:host
node --import tsx --test tests/image-chat.test.ts tests/model-config.test.ts tests/preview7.test.ts tests/preview8.test.ts
# 按第2节启动Vite/配置浏览器后
npm run test:ui
cd /root/hermes-workspace/hds-android/android
./gradlew testReleaseUnitTest
```

### Android真机必验与阶段出口

- 系统文件选择器、至少一种厂商图库：单选、2/3张、超过剩余名额、取消、损坏文件、临时URI失效；错误可读且已成功附件不丢。
- 开识图后立即回聊天，必须先提示重启，重启健康后再可选择；保存失败/进程停止时不启动图库。
- 已声明支持的图片模型、文本主模型+独立视觉模型各完成纯图/图文发送；不支持路线被阻止；最多3张，重复选择不重复发送。
- `./gradlew connectedDebugAndroidTest`（在android目录、已连接设备且新增测试后运行）验证原生桥；这条是设备验收，不能记入纯Linux通过项。

出口：D1–D4的UI/host/桥契约一致；无真实设备证据时可交付Linux候选，但不得宣称图片链路整体验收完成。

## 4. Phase 2 — 聊天与见闻阅读体验

### 改动文件（绝对路径）

- `/root/hermes-workspace/hds-android/apps/mobile-ui/main.tsx`
- `/root/hermes-workspace/hds-android/apps/mobile-ui/style.css`
- `/root/hermes-workspace/hds-android/apps/mobile-ui/MemoryTools.tsx`
- `/root/hermes-workspace/hds-android/packages/contracts/index.ts`
- `/root/hermes-workspace/hds-android/runtime/host.ts`
- `/root/hermes-workspace/hds-android/tests/story-ui.mjs`
- `/root/hermes-workspace/hds-android/tests/host.test.ts`
- `/root/hermes-workspace/hds-android/tests/message-contract.test.ts`

不改上游叙事状态机；accepted仅呈现已有事实，不新增未经因果关联的“角色已回复”推断。

### 关键流程与实现要点

1. **story.snapshot统一协调。** refreshStory、5秒轮询、刷新按钮、暂停/恢复后刷新、MemoryTools维护完成都走一个按profileRevision隔离的共享Promise。普通并发复用；变更后刷新若遇变更前在途请求，置dirty并在其结束后再拉一次，不能只复用旧快照。用generation/序号忽略失效响应；切页清轮询，切角色/恢复存档使缓存、dirty、结果写入全部失效。错误显式反馈，finally清锁。仍保留现有story/entries/facts/memories/intents/overlay/promptTrace形状。
2. **滚动状态以页面身份保存。** 当前主要是document滚动，不先引入嵌套滚动容器。以角色ID+story生命周期版本+page+detail为key，保存scrollY及可见首条ID/相对偏移。切页/切Tab前记位置，挂载且数据就绪后layout effect/requestAnimationFrame恢复；异步图片/字体改变高度时以锚点补偿，用户已主动滚动则停止补偿。Tab可继续条件卸载；MemoryTools展开状态上提或按同key保留，避免details收起使恢复位置无效。首次见闻时间线正序不变，初始定位最新末端；记忆/心绪首次顶部；回访恢复而非强制最新。提供“回到最新”。切角色不沿用另一个角色位置，重置/恢复存档清对应记录。
3. **聊天智能滚动。** 更新前记录是否接近可视底部（建议96px，扣除输入区和固定导航遮挡）。首次进入无位置、用户主动成功发送、点击“有新消息/回到最新”时滚底；在底部时新消息/图片布局变化跟随；上滑阅读时保持锚点，显示新增数，不能被每秒轮询拖走。离开聊天不运行聊天滚动effect；尊重reduced-motion。按末条ID与新增ID集合判断，覆盖200条窗口数量不变场景。
4. **历史合并而非盲目set。** 保留每秒全量200条接口作为本版最小方案；poll和send后刷新共用协调器。按id/content/status/occurredAt/images归一化比对，无变化返回同一数组，有变化复用未改对象；message行memo化。host在时间戳相同时增加稳定id次排序，避免轮询抖动。不引入未经测试的增量游标/历史分页，也不承诺能查看200条以前的消息。
5. **状态文案与安全重试。** 用户accepted显示“核心已接收，角色尚未必回复”；角色delivered显示“已显示”，card-opening沿用原标识。本地请求状态分sending/failed/unknown/accepted：明确拒绝为failed；传输中断但不能确认核心是否接收为unknown，保留草稿、附件、原requestId。可重试按钮调用现有messages.sendLocal，签名不变重用requestId；更改内容/附件才生成新ID。已accepted不能显示“重发以催出回复”，也不能按时间自动改失败；叙事静默是合法结果。若需要引导，显示“可查看约定与待办/运行日志”。核心已有模型重试机制不在UI重复实现。
6. **输入自动增高。** textarea变化后先height:auto再按scrollHeight钳到42–150px，超过上限overflow:auto；清空、发送、角色切换恢复高度，字号/视口变化重测。保留rows=1作为初值，支持中文composition、粘贴长文和软键盘；高度变化遵循聊天底部跟随规则。

### 新增/修改测试与Linux可验项

- story-ui：四路并发snapshot只发一个；维护完成期间在途旧请求必须随后再拉；延迟响应、失败恢复、切角色旧响应丢弃；三Tab和跨页滚动往返；初次最新/回访恢复；新增快照不跳读。
- story-ui：上滑后新增/图片加载不抢位置，底部正常跟随；200→200替换识别新消息；相同history不重复渲染行（测行渲染计数或稳定节点，不断言整个App完全不render）。
- host/message-contract：同requestId重复不重复入站，签名冲突明确拒绝；accepted出现时叙事尚在处理不判失败；本地delivered与accepted区别；同时间戳排序稳定。
- story-ui：失败/unknown原ID重试、草稿修改新ID、附件保留、accepted不显示失败；多行输入增高/清空收缩、320/390/740px。

```sh
cd /root/hermes-workspace/hds-android
npm run typecheck
npm run build:host
node --import tsx --test tests/host.test.ts tests/message-contract.test.ts tests/image-chat.test.ts
# 第2节UI环境下
npm run test:ui
```

### Android真机必验与阶段出口

- 触摸上滑读历史时角色新消息、图片迟加载、键盘弹出均不抢位置；点击新消息提示后抵达末尾。
- 三个见闻Tab及“故事↔见闻↔空间”反复切换，长列表/大字体位置恢复；切角色、恢复存档无串页。
- 中文输入法组合输入、连续换行、12000字符粘贴、软键盘收起、横竖屏切换；按钮与导航不遮挡输入末行。
- 飞行模式/核心停止/桥调用结果丢失后重试，同一条文本/图片不得重复入库；accepted文案不让用户误以为已获得回复。

出口：D8–D11全部行为测试通过；不得把新增history数组直接视为滚动触发器。

## 5. Phase 3 — 主动消息语义、承诺阈值与扫描配置

### 改动文件（绝对路径）

- `/root/hermes-workspace/hds-android/upstream/hds-interlude/src/narrator.ts`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/src/service.ts`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/src/index.ts`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/src/types.ts`
- `/root/hermes-workspace/hds-android/scripts/patch-mobile-hds.mjs`（以上全部同步，必须）
- `/root/hermes-workspace/hds-android/runtime/mobile-config.ts`
- `/root/hermes-workspace/hds-android/runtime/host.ts`（快照增加安全的登记结果摘要）
- `/root/hermes-workspace/hds-android/packages/contracts/index.ts`（登记结果契约）
- `/root/hermes-workspace/hds-android/apps/mobile-ui/main.tsx`（快照类型与结果传递）
- `/root/hermes-workspace/hds-android/apps/mobile-ui/LifeSettings.tsx`
- `/root/hermes-workspace/hds-android/apps/mobile-ui/MemoryTools.tsx`
- `/root/hermes-workspace/hds-android/packages/contracts/mobile-config.schema.json`（build:host生成）
- `/root/hermes-workspace/hds-android/android/app/src/main/assets/mobile-config.schema.json`（build:host生成）
- `/root/hermes-workspace/hds-android/tests/preview8.test.ts`
- `/root/hermes-workspace/hds-android/tests/host.test.ts`
- `/root/hermes-workspace/hds-android/tests/story-ui.mjs`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/test/follow-up-commitment.test.ts`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/test/scheduler.test.ts`
- `/root/hermes-workspace/hds-android/upstream/hds-interlude/test/delivery-ledger.test.ts`
- `/root/hermes-workspace/hds-android/android/app/src/test/java/io/hdsinterlude/android/MobileSettingsCodecTest.kt`

### 5.1 D5：定义行为，而不是只加一句提示

本版把“以后再想想给答案”和“用户要求未来主动发消息”分开。新增 `FollowUpCommitmentKind='scheduled-contact'`，复用同一follow-up-commitment账本、投递回执和resolution流程；不增加数据库表。为最小变更，commitment仍为配置下限到12h；12–24h以及低于承诺下限但≥10s的请求使用delayed分支。超出默认24h/过去时间/无明确时刻需要澄清，不悄悄改成20分钟。

两种有效输出：

- **仅未来发送，已有确定文案：** `interaction.reply.mode='delayed'`，content是到时真正发送的内容，sendAt是含时区ISO；不是把“好的我到时候发”当未来正文。JSON本轮只有一个reply槽，不能同时immediate+delayed。新增可选 `reply.purpose='scheduled-contact'`，只在明确接受用户定时联系的user-message回合保留，并写入intent.payload；普通延迟回复不标记。
- **现在确认、未来再组织内容：** immediate确认+`followUpCommitment.kind='scheduled-contact'`，summary写具体联系事项，notBefore在有效范围。script只描写现在确认；commit/event绑定成功、确认消息确实delivered后才登记。到期再生成immediate消息并给fulfilled；不能无可见结果就完成。

不要把kind伪装成thinking。不要同时为同一事项输出delayed与commitment/普通intent，避免重复投递。保留旧四种承诺语义、同参与者最多2个pending等边界；满额/去重导致无法新增时必须能在待办和诊断中解释，不能声称第三个约定已登记。

### 5.2 narrator user-message 指令草案

把以下内容并入 followUpCommitmentInstruction 的user-message分支；保留现有resolutions规定。范围数字由实际运行配置注入请求的`scheduledContactPolicy`（在types的NarrativeRequest、service构建请求、narrator.toPromptPayload中明确传递），避免prompt写死后与D6不一致。intent-due保留原“do not silently finish”并补scheduled-contact要求。核对普通/standard/streaming transport指令（narrator:1659–1667）与此不冲突：delayed是计划，不能把未来已发送写成现在事实。

```text
USER-REQUESTED FUTURE CONTACT:
When the current user asks the protagonist to send them a message at a future time
(for example “七分钟后给我发消息”, “十秒后提醒我喝水”, or “今晚八点联系我”),
and she accepts, this is a scheduled contact, not merely a promise to think.
Use interval.now / nowLocal and the story timezone to resolve the requested time.
Use a complete ISO-8601 timestamp with Z or an explicit offset; do not replace an
explicit requested time with “later” or a default twenty-minute delay.

Choose exactly ONE representation for the same contact:
A. If only the future message is to be sent and its content can be prepared now,
return interaction.reply={"mode":"delayed","purpose":"scheduled-contact",
"content":"the actual message to send at that time","sendAt":"resolved ISO-8601"}.
The delay must be within scheduledContactPolicy.delayedMinSeconds and
scheduledContactPolicy.delayedMaxMinutes (mobile defaults: 10 seconds to 1440 minutes).
Do not write the future sending as already completed in the current script.
B. If she sends a confirmation now and will formulate the contact at the due time,
return an immediate confirmation whose exact words occur in the current script,
plus followUpCommitment={"kind":"scheduled-contact","summary":"specific contact owed",
"notBefore":"resolved ISO-8601"}. This time must be between
scheduledContactPolicy.commitmentMinSeconds and commitmentMaxHours (12 hours).
The host registers the commitment only after that confirmation is visibly delivered.

For times below the commitment minimum or above its maximum, use A if valid.
If the time/content is ambiguous, ask one concise clarification now; do not claim
that a schedule was registered. Never emit two plans for one request. Do not create
a new plan for a quotation, a hypothetical, a refusal, or the user's own future action.
An accepted future-contact request should not end with an unbound “I'll message you later”.
```

intent-due追加：

```text
For a due scheduled-contact commitment, send the contact owed now as a visible
immediate reply and resolve its listed id as fulfilled. Do not merely say again
that you will contact the user later. Cancellation/rescheduling needs an honest
visible explanation; retain the existing visible-outcome and deadline rules.
For a delayed-reply, use its stored content and purpose as the pending message plan,
reconcile with the current situation, and do not create a duplicate schedule.
```

固定时钟示例：now=`2026-10-16T10:00:00+08:00`，“七分钟后给我发消息”可选B：immediate“好，七分钟后我联系你。” + scheduled-contact notBefore=`2026-10-16T10:07:00+08:00`；“十秒后提醒喝水”在默认承诺下限300s时选A，content“该喝水啦。”、sendAt=`2026-10-16T10:00:10+08:00`。两个示例的script都停在10:00。

### 5.3 兜底正则与时间解析草案

保留原thinking规则，另加受限scheduled规则。示意正则先按句切分，检查非引述、第一人称肯定承诺及否定/疑问；不要对任意长段落直接宽匹配。下面表达式是实现草案，不声称覆盖所有自然语言。

```js
const duration = String.raw`(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千]+|半)(?:秒钟?|分钟|小时)`
const relative = String.raw`(?:${duration}(?:之?后)|过${duration}|再过${duration})`
const clock = String.raw`(?:(?:今天|今晚|明天)?(?:\d{1,2}[:：]\d{2}|[零〇一二两三四五六七八九十]+点(?:半|[零〇一二两三四五六七八九十]+分)?))`
const send = String.raw`(?:(?:主动)?(?:给你|向你)(?:发(?:一条)?消息|发信息|发送消息)|(?:主动)?联系你|提醒你)`
const scheduledPromise = new RegExp(String.raw`^(?:好[的啊]?[,，、 ]*)?我(?:会|到时会|答应)?\s*(?:在)?(?<when>${relative}|${clock})\s*(?:再|准时|主动|会)?\s*${send}`, 'u')
```

实施时同时支持“我会在七分钟后给你发消息”“我过7分钟提醒你”“我明天20:00联系你”。拒绝“我不会…”“你七分钟后给我…”“如果…我…”“他说‘我七分钟后…’”“我七分钟前…”及疑问句；英文新增独立第一人称“I’ll/I will … message/text/contact/remind you in N seconds/minutes/hours”规则和对应测试，不混成一个不可维护的大正则。

把 `interactionPromisesFollowUp` 和 `inferredFollowUpCommitment` 的组合调整为返回分类+解析结果的helper；同时传入now、story时区及本回合userMessage上下文。数字转毫秒为确定性逻辑：阿拉伯数、常见中文数、半分钟/半小时；绝对时间按故事时区与日期词解析，时间已过且没有“明天”时不擅自滚到翌日。多个冲突时间、无单位、解析失败不能固定推断20min。

对于明确的scheduled表达，时间解析成功且落在承诺区间，生成scheduled-contact draft并走原event→delivered→append链；若有结构化draft优先校验且要求时间与明确请求一致。原thinking模糊承诺仍可用20min默认（当配置下限更大时默认取max(20min,配置下限)，上限仍12h）。**只有识别到旧thinking语义时才使用该默认**。

关键失败路径：scheduled表达解析失败/不合法，或本轮没有可绑定的immediate event，不得声称“已登记”。在可见确认尚未发送前，对“明确接受且没有有效计划”的结果允许一次受限结构化修正，要求改用合法A/B或给出澄清；不能循环重试或增加第二条确认。修正走现有模型请求入口、沿用预算/超时/取消规则，最大一次；在tryDecide结果进入persistDecision和非流式可见发送之前校验，旧的失败候选不得落任何intent。实验流式已早发确认时不能回滚，把未登记原因作为诊断状态反馈到待办空态并引导用户重新指定，不能伪造一个20分钟约定。默认关闭的实验流式需单独回归，不能仅凭prompt声称百分百可靠。

登记结果的具体落点：复用script entry的admin-note类型写一条仅含安全摘要的`metadata.scheduledContactRegistration={requestId,outcome,reasonCode,intentId?,dueAt?}`，outcome分registered/rejected，按requestId和事项去重；不写完整请求/prompt/连接信息。service增加只读取当前故事最近此类记录的`adminSchedulingStatus`方法，host在story.snapshot增加可选`schedulingStatus`，MemoryTools展示“未登记：时间不明确/超出范围/待办已满”等原因。旧快照缺此字段仍兼容。registered只能在intent成功落库后写；若诊断记录失败，不影响已经成功的投递，使用warn兜底。此改动同样纳入patch同步和host回归。

### 5.4 到期链、取消与可靠性边界

执行链保持原结构：

```text
user-message → persistDecision
  delayed/content/sendAt → delayed-reply intent + scheduleDueIntentWake
  immediate + commitment → outgoing event → delivered回执
                         → appendFollowUpCommitment + scheduleDueIntentWake
到期timer → wakeDueIntents → sweep → advanceUnlocked → tryDecide(intent-due)
        → persistDecision → sendScheduledMessages → LocalBot → mobile_message
周期setInterval → sweep（漏唤醒/重启后补扫描）
用户下一消息 → liveNarrativeIntents（机会性处理，不作为正常到期依赖）
```

- 保留 `permitMessages = allowProactiveMessages || dueBatch.some(userInitiated)`；显式约定即使autoAdvance=false仍可到期发送，泛化自动生活继续受总开关控制。用户请求不豁免后台预算；quota已满时不能假称按时送达。
- ordinary delayed默认被用户下一消息取消；**显式scheduled-contact应继续存在**。在normalizeInteraction保留purpose，在persistDecision只对user-message来源落payload；cancelPendingOutgoingMessages过滤时仅豁免这一标记，普通delayed与split的原取消语义不变。commitment本来不在该取消集合。
- 取消任何普通计划后，将现有“只重排split wake”改为重新安排剩余可执行pending intent的最早notBefore，避免顺带抹掉用户约定的短时wake。到期回合结束也检查下一最早pending，覆盖一故事单timer与多约定；排除暂停/已完成/已取消记录并避免past-due空转，沿用busy退避和数据库真相源。
- 取消显式约定使用已有待办取消入口；用户明确更改/撤销通过followUpResolutions/intentUpdates处理，必须测试不重复登记。不能关闭全局cancelDelayedRepliesOnUserMessage来修一个特例。
- delayed的due回合成功不等于可见送达；Linux验收必须断言LocalBot消息与账本，而非仅status=completed。commitment只在可见resolution确认后完成；暂停、端点不可用、预算耗尽、模型失败不能制造成功。
- `adminPendingIntents`只显示pending，最多100条；MemoryTools显示kind、到期本地时间、暂停/预算/核心状态说明。失败未登记时不要显示“没有任何约定”的误导性成功空态。错误原因只传安全码/摘要，不泄露prompt或配置。

### 5.5 D6：最小配置方案与默认值

选择“上游Schema字段 + 移动白名单 + 可重放补丁”，不选择移动host直接替换5min常量。后者会使Schema/UI显示与实际执行不一致，并易漏掉7690的二次校验。

| 字段 | 定义与缺省 | 移动端行为 |
|---|---|---|
| `runtime.minimumFollowUpCommitmentSeconds`（新增） | `Schema.natural().min(10).max(43200).default(300)`；RuntimeConfig可选/读取fallback300，兼容旧调用构造 | whitelist增加；UI标“承诺最短等待（秒）”；10s可用于主动消息测试/用户选择，旧配置仍300s |
| `runtime.sweepIntervalMinutes`（已有） | 现有整数1–1440，default5，保留Math.max(1,...) | whitelist增加；UI说明“兜底扫描，已有到期定时器不等扫描”；不降至秒级、不默认改1 |
| delayed min/max（已有） | 默认10s/1440min，本版不额外暴露 | 注入prompt有效值，保持既有归一化校验 |

两处normalizeFollowUpCommitment都接收同一运行阈值：12267 normalizeDecision及7690投递回执。参数缺省300s维持旧测试/外部调用兼容。固定12h最大值暂不配置化，prompt与UI说明要明确；expiresAt仍沿用24h上限及不可自动无限续期规则。不得把“非法过短被拒绝”描述成“系统自动延迟到5min”。

mobile-config.ts的runtime whitelist加两个字段即可通过现有Config驱动Schema生成；LifeSettings已有动态字段，不再硬编码默认值。mapMobileConfig不能把sweep/承诺阈值随autoAdvance=false清空；它们仍服务用户约定。两份schema由build:host生成并经preview8测试比较，Kotlin MobileSettingsCodec测试覆盖整数、范围、旧配置缺字段、持久化往返及分享码过滤。

设置保存后需要重启：sweep interval是在服务start安装的，不能只改变界面数字就宣称热更新。使用P1扩充后的syncStatus旧生活域与config.status检查desired/loaded；默认不静默迁移为高频，以免增加后台扫描开销。用户自选1min主要缩短恢复/漏wake兜底窗口，不能保证系统回收后的送达时间。

### 新增/修改测试与Linux可验项

- follow-up-commitment.test：三个phase指令隔离、A/B字段与时区、旧四kind和新kind归一化；10s/边界下1ms、300s/下1ms、12h/超12h、24h delayed边界、无效ISO、配置下限10与300；两个normalize调用均用配置。narrator输出测试用真实prompt构造与固定时钟，不只查字符串含“定时”。
- preview8/host：使用本地模型fixture+真实Koishi/SQLite；“七分钟后”即刻出现正确pending且无提前未来消息；推进测试时钟/直接推进due时间后，不发用户第二消息即可完成。至少一个真实10s timer集成测试证明scheduleDueIntentWake路径，而非所有测试手工sweep。其余用可控时钟避免等待七分钟。
- 正则正反例、数字解析、模糊时间澄清、一个受限修正、两种输出不得双登记、流式提前确认失败可观测；旧thinking默认20min与新scheduled精确时间区分。
- ledger/scheduler：visible确认前不得登记、投递失败不得结算、重复回执只登记一次、2个pending上限、取消其中一个不丢另一个wake；新用户消息取消普通delayed但保留显式约定；restart后intent仍在并由周期sweep处理；paused/restore-held不自动恢复。
- autoAdvance关/开、预算满、故事暂停、参与者暂停、模型失败、busy和到期并发；断言LocalBot可见输出、pending/完成/取消的实际状态及无重复模型投递。
- preview8 + MobileSettingsCodecTest + story-ui：Schema/default/边界/生成文件一致性、设置保存重启生效、config.status实际值、旧分享码缺字段兼容、新字段往返；patch首次/重复/锚点失配测试。

```sh
cd /root/hermes-workspace/hds-android
node scripts/patch-mobile-hds.mjs
npm run build:host
node --import tsx --test tests/preview8.test.ts tests/host.test.ts
npm --prefix upstream/hds-interlude run typecheck
node --import tsx --test upstream/hds-interlude/test/follow-up-commitment.test.ts upstream/hds-interlude/test/scheduler.test.ts upstream/hds-interlude/test/delivery-ledger.test.ts upstream/hds-interlude/test/time-context.test.ts
npm run typecheck
npm test
# 第2节UI环境下
npm run test:ui
cd /root/hermes-workspace/hds-android/android
./gradlew testReleaseUnitTest
```

### Android真机必验与阶段出口

- 在核心healthy/预算充足下，分别测试10秒、1分钟、7分钟、明确本地时刻；B路线需阈值允许。每次记录用户请求、结构化计划到期时间、实际收到时间及误差；不发送下一条消息也能到期。
- 开/关持续生活均验证用户显式约定；关闭时不能出现无约定自动闲聊。普通新消息后显式约定保留，待办取消后不再发送。
- 前台、切其他App、息屏分别验证；记录机型/系统/电池策略/运行时状态，不把一次息屏成功宣传成无限保活保证。
- 手动停止、故事暂停、恢复存档暂停、核心重启：不能在未恢复时发消息；恢复后仍保留待办事实、不重复投递。强制停止后不承诺唤醒，归T13。
- 实际已配置模型做中文相对/绝对时间小样本（例如每类5次）评估结构化输出；fixture通过只证明实现链，不证明模型遵循率。记录成功率、失败模式及是否进入受限修正，不写“稳定”而无证据。

出口：D5/D6至少覆盖完整无用户后续消息链及配置双校验；上游补丁可重放、生成Schema一致，D7保持明确未实现。

## 6. Phase 4 — 日志与图片内存峰值、发布候选收尾

### 改动文件（绝对路径）

- `/root/hermes-workspace/hds-android/runtime/host.ts`
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/AppearanceStore.kt`
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/HdsRuntimePlugin.kt`（与P1顺序处理/错误结果一致）
- `/root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt`（仅需要时增强脱敏测试入口，不改变恢复策略）
- `/root/hermes-workspace/hds-android/tests/host.test.ts`
- `/root/hermes-workspace/hds-android/tests/media.test.ts`
- `/root/hermes-workspace/hds-android/tests/story-ui.mjs`
- `/root/hermes-workspace/hds-android/android/app/src/androidTest/java/io/hdsinterlude/android/ImageDecodeTest.kt`（拟新增）
- `/root/hermes-workspace/hds-android/package.json`
- `/root/hermes-workspace/hds-android/package-lock.json`
- `/root/hermes-workspace/hds-android/android/app/build.gradle`（只更新8.1版本元数据）

本阶段原则上不修改上游；若要增加reportOperation行，必须同步补丁且不扩大日志内容范围。

### 关键流程与实现要点

1. **D12最小改动**：host默认 `logging.level='info', verbosity='standard'`；保留colors/kaomoji关闭、logMessageContent/logScriptPreview=false。复用已有登记/到期处理/投递日志，不打开debug全量prompt；周期无工作日志仍留diagnostic，防止刷走重要记录。只有需要解释P3登记失败/预算/暂停时补短原因码，不输出连接凭据、完整请求头或图片base64。
2. **日志验证**：保留原生每行1500字符、200行环形边界和已知凭据/token替换；用测试占位串验证脱敏，不读取或复制真实凭据。UI日志需可选择/可滚动并支持新info行，预算耗尽与暂停原因可定位。info/standard不是所有跳过分支日志，必要的安全诊断信息通过明确状态展示。
3. **D13调整输入层**：保留现有bounds→inSampleSize→缩放→EXIF→JPEG质量循环。image(uri)改为ContentResolver流复制到受限临时文件，复制时计数32MiB硬上限；从临时文件两遍decode/读EXIF，不保留整个压缩源byte[]及其复制。background也复用此图片输入路径；字体仍16MiB原逻辑。临时文件放app cache私有目录并try/finally删除，异常/超限亦清理；未知/损坏尺寸先拒绝，32MiB压缩大小不替代像素检查。
4. **顺序和释放**：多选仍一次解码一张；bitmap从创建起纳入finally，不只在最后压缩块回收，覆盖createScaledBitmap/旋转失败。聊天1024px/480000字节、背景2048px/1500000字节输出限制保留。EXIF八种方向及透明PNG→JPEG背景策略与旧行为对照；先不引入新图像库。桥累计最多3个压缩dataUri，不回传原始大图。
5. **版本与打包**：P1–P3/P4集成后更新到0.1.0-preview.8.1，versionCode在当前16基础上递增；按第2节完整构建顺序生成候选。记录Linux测试、APK版本、设备与各缺陷验收状态；不在未经设备验证时把T09/T12/T13整体标DONE。

### 新增/修改测试与Linux可验项

- host：info/standard包含承诺登记/到期/发送关键行，日志无测试占位凭据/消息全文/图片base64；若采集logger，断言语义字段而非整行样式。复用上游已有logging.test只验证规则，没有修改上游不需为日志重构核心。
- media：保留MIME、尺寸/大小、hash、附件持久化回归；不能据此推断Android Bitmap峰值。
- ImageDecodeTest（设备测试）：超大尺寸JPEG/PNG/WebP、EXIF1–8、损坏/截断、超过32MiB、1张和3张顺序处理、背景；输出尺寸/字节上限、临时文件清理和异常bitmap释放。
- story-ui：info可见/长行换行/深浅色对比；图片选择失败与部分成功提示。

```sh
cd /root/hermes-workspace/hds-android
npm run typecheck
npm test
node --import tsx --test upstream/hds-interlude/test/logging.test.ts
# 第2节UI环境下
npm run test:ui
# 随后按第2节执行android:sync、build-runtime和Gradle打包
```

### Android真机必验与阶段出口

- 运行中从“查看运行日志”观察一次登记→到期→发送；暂停/预算耗尽场景有可解释状态，确认无凭据泄漏；记录不附真实配置/日志中的敏感内容。
- 12MP/48MP照片各反复选择，单张与3张、横向/竖向/EXIF旋转、PNG/WebP/背景，测试系统相册与云端文档provider；不卡死、不ANR、不OOM、不遗留临时文件。
- 用同一设备、同一组图片、相同核心运行负载记录修改前后Java/native/PSS峰值（Android Profiler或设备内存工具），附采样方法与至少5轮数据。目标是去除完整压缩源缓冲并降低峰值；不把理论像素乘积当测量，也不无依据承诺固定节省百分比。
- Android目录运行 `./gradlew connectedDebugAndroidTest`；覆盖导入取消、解码失败后继续正常聊天、后台选图返回、低内存设备。
- 跑完整纯文字、图文、切角色、存档恢复、预算、分享码回归。正常停止与force-stop后均不自动重放消息。

出口：D12/D13有真实日志与内存证据；四阶段Linux门禁全绿、真机项逐条完成或显式标阻塞；本轮实现仍不得自行提交git。

## 7. D7 后续归属与最终交付标准

D7本版不实施START_STICKY/自动重启/Doze策略：这些涉及服务外壳、PRoot/Node/数据库生命周期、用户主动停止意愿、恢复存档hold及防止重复业务动作，不能当作缩短sweep的附带修改。已存在FGS与wake lock，故本版保留它们；纠正“无前台服务”的描述。

Preview 8.2 / T13按 `HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md` 继续受控恢复：区分主动停止/意外退出、有限指数退避与重启上限、健康探测、进程退出与持久化恢复、厂商电池策略。设备强制停止后不承诺继续发送；后台定时也不承诺操作系统级精确闹钟。该文档已有规划内容仍需实施前回读源码，不把规划当现状。

8.1最终实现验收记录应包含：每D的通过/失败/未验，命令退出码，fixture与真实设备证据分离，APK版本与内嵌host版本、prompt/正则样本结果、无后续用户消息的实际到期回执、配置重启前后差异、大图峰值数据。任何“accepted”“已登记”“intent completed”均不能单独代替可见送达证明。
