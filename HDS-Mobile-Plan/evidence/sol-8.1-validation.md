# Preview 8.1 实施与验证记录

基线已核实：`main / 3d69c29 / 0.1.0-preview.8`。按 SPEC/PLAN 的 P1→P2→P3→P4 顺序实现并在每阶段执行 typecheck、相关测试。改动留在工作区，未提交git，原有审阅/规划证据保留。下面区分Linux fixture、原生编译、真实设备，所有失败与重跑原始输出均保留。

## 最终命令结果

| 命令/检查 | 最终退出码与真实摘要 |
|---|---|
| `npm run typecheck` | 0；`tsc --noEmit` 无诊断 |
| `npm --prefix upstream/hds-interlude run typecheck` | 0；noUnused/完整上游检查无诊断 |
| `node scripts/patch-mobile-hds.mjs` | 0；窄补丁已应用；临时fixture验证首次/重复/未知锚点 |
| `npm test`（原样默认入口，最后一轮） | 0；build:host成功，**46 tests / 46 pass / 0 fail / 0 skipped**，90203.7137ms |
| 上游 follow-up-commitment/scheduler/delivery-ledger/time-context/logging 五组 | 0；**39 tests / 39 pass / 0 fail** |
| `HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui` | 0；accepted消除unknown重试、三Tab位置、200条窗口、节点复用、输入增高/收缩及既有UI回归PASS |
| `npm run android:sync`（最终同步） | 0；typecheck、Vite生产构建、Capacitor Web资产复制/插件同步成功 |
| `git diff --check` | 0；无空白错误 |
| Android `./gradlew ...` / `bash ./gradlew lintRelease testReleaseUnitTest assembleDebug connectedDebugAndroidTest` | 原命令126（无执行位），bash复核1（Java缺失）；**环境不具备/未验证** |
| `python3 scripts/build-runtime.py` | 未运行，无退出码；Python3.11.2，脚本声明需≥3.12，Android链也未就绪 |
| 附加直接编译 runtime/host.ts、model-config.ts（非既定入口） | 2；17项既有类型错误；HEAD runtime源码对照的诊断码/数量相同，未扩大范围改QQ/框架类型 |

最后一轮原样 `npm test` 的真实尾部：

```text
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 90203.7137
```

## 阶段与缺陷状态

| 阶段 | 实现与Linux验收 | Android出口 |
|---|---|---|
| P1 图片链路 | 保存屏障/实际识图同步状态/能力声明/多选契约已接通；阶段typecheck、12项Node、UI通过，后续回归计入最终46项 | Kotlin/真实图库/ContentResolver未验证 |
| P2 聊天与见闻 | 共享刷新、角色/生命周期/Tab位置、智能滚动/200条合并、状态/原ID重试、输入增高；阶段typecheck、相关Node与UI通过 | 触摸/软键盘/大字体/生命周期真机未验证 |
| P3 主动联系 | scheduled-contact、受限时间解析/一次修正/登记诊断、阈值与扫描白名单、到期/取消/回执链、补偿器防提前发送；上下游typecheck、集成、补丁、UI通过 | 真实模型遵循率、后台/息屏未验证；D7不在本版修复 |
| P4 日志与内存 | info/standard与脱敏边界；图片流→受限临时文件及Bitmap finally；host/media/logging/全量/UI/Web同步通过 | 原生编译、设备测试和内存实测未验证；未生成APK，版本不更新 |

| D | 当前判定与证据边界 |
|---|---|
| D1 | 已实现可读入口原因/aria关联；Linux原因函数与UI通过；真机触控待验 |
| D2 | 已实现强制保存、非敏感路线投影比较、healthy/发送前复核及旧回调隔离；Node/fixture通过 |
| D3 | 已实现clipData+data URI去重/截断/顺序处理/部分错误；真实Android桥未验证 |
| D4 | 已实现unknown显式确认、unsupported拦截、native全候选及sidecar检查；Linux host/配置测试通过；真实服务商待验 |
| D5 | 已实现定时语义/精确解析/落库诊断/无后续消息timer/可见回执结算/补偿器防早发；真实LocalBot/SQLite及实验SSE fixture通过；非模型成功率保证 |
| D6 | 已实现默认300s、10–43200s阈值与1–1440min扫描Schema/白名单/UI；上下游双校验、生成Schema一致；原生持久化未验证 |
| D7 | **未修复**；已有FGS/wake lock保留，受控重启/Doze/厂商策略归P8.2/T13 |
| D8 | 已实现跨入口协调/dirty再拉/角色与Tab阅读位置；Node/UI通过，真机大字体与异步布局待验 |
| D9 | 已实现底部跟随/新增提示/稳定对象与memo行，200→200和回访UI通过 |
| D10 | 已实现accepted/已显示、sending/failed/unknown、原ID安全重试；历史确认accepted后不再呈现未知重发；host/Node/UI通过 |
| D11 | 已实现42–150px自动增高/清空收缩；UI通过；中文IME/软键盘待验 |
| D12 | 已实现info/standard、关闭正文/剧本预览；Logger与规则测试通过；原生脱敏/200行环形边界设备未验证 |
| D13 | 已实现压缩源临时文件、32MiB/100MP约束、逐张Bitmap释放；Android编译与12/48MP峰值实测未验证，不宣称内存节省比例 |

R映射：R1→P1，R2→P3，R3→P2，R4→P2/P4，R5→本记录的环境/补丁/真机清单。

## 产物与版本

- `package.json`、`package-lock.json`（含根package项）、Android versionName均保持 **0.1.0-preview.8**，versionCode保持 **16**；版本文件零diff。原生/设备出口未通过，不能执行8.1版本更新条件。
- 最后host bundle SHA256：`8445b4a6764f05db0a37f18e65f590831a5c5fece1b3f92a82d2f87a037f7983`。
- 两份生成Schema SHA256一致：`db2864a09181dc1489a35f235659dadd6de88551f2ea5f9bcd142705da490038`。
- 最后Web资产：`index-IO3TJGrd.css` / `index-CsJK2wE2.js`，已复制到Android Web assets。**guest未重打包、APK未生成，不能把这些Linux产物冒充设备包证据。**

## P4 结果与未验证边界

- host默认info/standard，关闭消息正文/剧本预览、颜色与颜文字。host测试采集真实Logger语义行且不含人设/世界书fixture全文；日志规则5项通过。首个Logger测试直接ESM导入koishi触发其loader互操作异常，改为与host bundle一致的CJS入口后通过，未改既有断言。
- Android图片32MiB限制改为流→私有cache临时文件，decodeFile bounds/sample/scale/EXIF/质量循环；所有Bitmap从创建起纳入finally释放。新增100MP像素上限，兼容48MP常见照片，防止无效超大尺寸。聊天1024px/480000B、背景2048px/1500000B不变。字体仍16MiB原路径。每次解码后删除临时文件，桥最多3张压缩图，按顺序处理。
- 新增设备测试ImagePickerTest（data/clipData/混合去重/取消）、ImageDecodeTest（EXIF1–8角点/12MP JPEG、PNG、WebP/三次顺序处理/透明PNG策略/背景/损坏与32MiB超限/临时文件清理/合成占位串脱敏与1500字上限）。这些测试尚未编译或运行，不得视为通过。48MP和Java/native/PSS峰值、Bitmap异常释放的内存工具验证仍需真机。
- P4集成复核修正：发送前再次确认设置版本/角色/核心状态；识图RPC只发送规范化非敏感投影（仍兼容早期settings形状请求）。阅读位置的角色切换计数与故事重置生命周期分离，防止切回同一角色丢位置；三Tab设置sticky以便阅读中切换；核心healthy后自动复核识图域且不清除其他dirty提示。历史登记记录明确不代表实际送达。原生部分失败只透出已知安全错误短句；不回传provider异常中的URI。
- 附加（非仓库既定入口）直接编译runtime/host.ts、model-config.ts失败17项，涉及原有Koishi表扩展、dispose/Session/部分配置类型及QQ类型。用git HEAD的runtime源码复制到/tmp，复用相同依赖/上游/契约检查，诊断码和数量完全相同（TS2345×9、TS2416×1、TS2322×2、TS2739×1、TS2740×1、TS2769×1、TS2707×1、TS2339×1）。未扩大范围重构这些既有类型问题；根npm run typecheck与上游typecheck是真实独立门禁，不能把它们说成覆盖runtime全部类型。
- 原生Gradle脚本无执行位，原命令退出126；bash执行退出1，明确缺Java。需JDK21、SDK35/build-tools35、Gradle依赖与Android设备。未生成APK，未确认内嵌host运行版本。build-runtime.py未运行：本机Python3.11.2低于脚本说明所需3.12，且Android构建链未就绪；后续必须在受支持环境重建guest，不能把现有旧runtime包当8.1产物。
- 不更新package.json、package-lock.json、android/app/build.gradle：保持0.1.0-preview.8、versionCode16。原因是原生/设备门禁未验、附加类型检查仍有基线错误，默认全量测试另有QQ时序失败历史，最终复跑已通过，仍保留不稳定风险；Android/设备出口未满足“P1–P4全部验收通过后”条件。不修改任务板，不宣称T09/T12/T13 DONE。

## Android 真机必验清单（全部未验证）

1. 在JDK21/SDK35环境重新运行 `npm test` → `npm run android:sync` → Python≥3.12下 `python3 scripts/build-runtime.py` → android目录 `bash ./gradlew lintRelease testReleaseUnitTest assembleDebug`；设备连接后 `bash ./gradlew connectedDebugAndroidTest`。记录APK versionName/versionCode及内嵌host哈希/版本。
2. 系统文件选择器、厂商图库、云端文档provider：单选、2/3张、超剩余名额、重复、取消、部分/全部失败、损坏/失效URI、后台返回；切角色或停止核心后的旧回调不可写入附件。
3. 开识图后小于500ms回聊天、输入仍聚焦、保存失败、双击、重启期间编辑；必须等待实际识图配置匹配。unknown/unsupported主模型与备用候选阻止发图；supported native、文本主叙事+独立vision分别发送纯图/图文。能力声明不代表服务端真实支持。
4. 聊天上滑时新消息和图片迟加载不抢位置，新消息按钮回到末尾；200条窗口更替保持可见锚点。三个见闻Tab/跨页/切角色/恢复存档/大字体阅读位置与details展开状态不串用。
5. 中文输入法composition、换行、12000字粘贴、字号/横竖屏/软键盘变化；输入42–150px，无按钮或导航遮挡。断网/核心停止/结果丢失重试保持原ID，修改内容或附件生成新ID；accepted不等于角色已回复。
6. 配置阈值10/300秒、扫描1/5分钟保存并重启，核对config.status与desired/loaded差异。真实配置模型：10秒/1分钟/7分钟/明确本地时刻；前台/其他App/息屏；不发送下一条消息，记录请求、结构化dueAt、实际收到时间与误差。中文相对/绝对时间各至少5次记录遵循率与修正次数，不能用fixture成功率替代。
7. 开/关持续生活均验证显式约定；普通新消息保留显式约定、普通delayed取消；待办取消/改期/重复回执/最多2条/取消一条保留另一条wake。预算满、模型故障、参与者或故事暂停、存档restore-held、手动停止、核心重启、并发busy不得伪造送达或重复投递。实验流式提前确认未登记应明确可见；系统force-stop不承诺唤醒，受控恢复归P8.2/T13。
8. 12MP/48MP JPEG、PNG/WebP、EXIF1–8、透明图、背景、三张顺序处理；反复选图后能继续聊天，无ANR/OOM/临时文件残留。相同设备、素材、核心负载下，修改前后各至少5轮，用Profiler或设备工具记录Java/native/PSS峰值与采样方法；当前无任何测量数值，不能宣称降低固定百分比。
9. 运行日志观察登记→到期→投递、预算/暂停原因；验证info可见、长行换行/选择/滚动、1500字符/200行边界和已知凭据/token脱敏。导出证据只用占位串或脱敏摘要。

## 补充矩阵与剩余验证范围

收尾新增真实SQLite矩阵覆盖：相同origin投递回执不重复登记、两条pending上限/第三条rejected、取消一条仍保留wake、核心重启后预算用尽不调用模型、restore-held不自动恢复、参与者暂停、模型500失败、实际LocalBot投递失败不完成、恢复端点后并发sweep只送达一次；开/关autoAdvance分别覆盖。测试用直接调用周期扫描函数推进恢复后的due，不等价于实测操作系统后台定时。待办上限/回执复用真实持久化方法作为fixture，初始B路线确认→回执→登记另有完整模型/LocalBot链。

额外补齐：仅经过校验的reply分支可以设置reserved purpose，普通模型intent不得自标显式约定；中途否定/引用/假设/用户自身未来行动不注册、healthy识图核对、历史accepted回执消除unknown重试、普通扫描结束也重排下一pending wake。尚未穷尽所有UI保存/选图/上传/切角色的竞态组合；真正clipData/ContentResolver、真实服务商遵循率、Android后台与内存峰值均未测。

补偿器源码偏差：新增测试日志发现pending出站补偿器不检查delayed计划的到期时间，会提前补发。仅为scheduled-contact future事件增加调度归属标记，补偿器跳过，由due intent完成情境核对；实际到期送达后终结旧计划事件。新增断言实际消息occurredAt≥dueAt且仅一条，不再只断言intent completed。普通delayed的原补偿行为未扩改。此补丁已同步重放脚本。

首次扩充失败还暴露测试误将端点冷却当成可立即重试：生产冷却保持不变，fixture显式恢复端点可投递状态后继续验证。

测试入口的历史失败均保留在下面：默认npm test在并行负载下多次失败于既有QQ inbox断言，单独QQ/串行全量与最终两轮默认全量均通过。NODE_OPTIONS传test-concurrency被Node拒绝（退出9）；taskset对照仍出现QQ失败；最后使用受支持的 `npm test -- --test-concurrency=1` 得45/45，随后原样默认入口最终46/46。UI曾因Vite未启动和既有保存重试时序断言失败，最终单独运行已通过。不能据复跑通过宣称不存在时序波动。

现有上游开发依赖恢复命令（已在本轮执行，未改manifest/lock）：`npm install --cache /tmp/hds81-npm-cache --prefix /tmp/hds81-typecheck --no-save --package-lock=false --ignore-scripts yml-register@1.2.5`，随后 `ln -s /tmp/hds81-typecheck/node_modules/yml-register node_modules/yml-register`。如果/tmp被清理，需在锁定开发环境恢复该原有依赖后再跑上游typecheck。


<details>
<summary>逐次真实命令、退出码和完整输出（包含失败与重跑，以及P1–P3源码偏差记录）</summary>

# Preview 8.1 实施验证记录

基线：main / 0.1.0-preview.8。SPEC 与 PLAN 已完整读取。仅在工作区修改，不提交 git。下面命令输出由执行脚本直接追加，非模拟结果。原有未跟踪的规划/审阅证据保留。

阶段状态随验收更新；Linux fixture 不代表 Android 设备验收。版本须在全部门禁满足后更新。

### P1 · 2026-10-15T16:51:25.832165+00:00

```sh
npm run typecheck
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


```

### P1 · 2026-10-15T16:52:04.649464+00:00

```sh
npm run build:host && node --import tsx --test tests/image-chat.test.ts tests/model-config.test.ts tests/preview7.test.ts tests/preview8.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (5373.986106ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (7.500683ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.980155ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.091472ms)
✔ vision projection is canonical, secret-free and checks every candidate (6.394297ms)
✔ image entry explains all unavailable states in priority order (0.844194ms)
✔ vision routing rejects missing or disabled dedicated models (5.240623ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
✖ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (5191.737951ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (56.042933ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.170636ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (15.36448ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (8405.347336ms)
ℹ tests 12
ℹ suites 0
ℹ pass 11
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 29875.424659

✖ failing tests:

test at tests/preview7.test.ts:1:1473
✖ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (5191.737951ms)
  ReferenceError: images is not defined
      at Object.dispatch (/root/hermes-workspace/hds-android/runtime/generated/host.cjs:22220:7)
      at run (/root/hermes-workspace/hds-android/tests/preview7.test.ts:52:19)
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/preview7.test.ts:56:25)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)

```

### P1 · 2026-10-15T16:52:26.676437+00:00

```sh
cd android && ./gradlew testReleaseUnitTest
```

退出码：`126`

```text
/bin/sh: 1: ./gradlew: Permission denied

```

### P1 · 2026-10-15T16:52:26.874513+00:00

```sh
npm run typecheck && npm run build:host && node --import tsx --test tests/image-chat.test.ts tests/model-config.test.ts tests/preview7.test.ts tests/preview8.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (4895.733036ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (4.512779ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.529958ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (2.134033ms)
✔ vision projection is canonical, secret-free and checks every candidate (5.781298ms)
✔ image entry explains all unavailable states in priority order (0.417626ms)
✔ vision routing rejects missing or disabled dedicated models (2.972394ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
✖ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (4937.532188ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (15.684101ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (2.483871ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (4.43061ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (4965.161623ms)
ℹ tests 12
ℹ suites 0
ℹ pass 11
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21280.839241

✖ failing tests:

test at tests/preview7.test.ts:1:1473
✖ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (4937.532188ms)
  ReferenceError: images is not defined
      at Object.dispatch (/root/hermes-workspace/hds-android/runtime/generated/host.cjs:22220:7)
      at run (/root/hermes-workspace/hds-android/tests/preview7.test.ts:52:19)
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/preview7.test.ts:56:25)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7)

```

### P1 · 2026-10-15T16:52:29.174774+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/
Call log:
[2m  - navigating to "http://127.0.0.1:5173/", waiting until "load"[22m

    at /root/hermes-workspace/hds-android/tests/story-ui.mjs:57:14 {
  name: 'Error'
}

Node.js v24.20.0

```

### P1 · 2026-10-15T16:52:34.510520+00:00

```sh
cd android && bash ./gradlew testReleaseUnitTest
```

退出码：`1`

```text

ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.

Please set the JAVA_HOME variable in your environment to match the
location of your Java installation.


```

### P1 · 2026-10-15T16:53:34.314225+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### P1 · 2026-10-15T16:53:38.028468+00:00

```sh
npm run typecheck && npm run build:host && node --import tsx --test tests/image-chat.test.ts tests/model-config.test.ts tests/preview7.test.ts tests/preview8.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (6214.908096ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.002718ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (0.911717ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (2.295989ms)
✔ vision projection is canonical, secret-free and checks every candidate (4.753431ms)
✔ image entry explains all unavailable states in priority order (0.371971ms)
✔ vision routing rejects missing or disabled dedicated models (2.428253ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (7292.398325ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (60.663667ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (16.542573ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (26.982771ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (7389.897842ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34524.268453

```

## P1 阶段结果

Linux：typecheck、build:host、12项相关Node测试、现有UI回归通过。首轮实现误将识图校验插入维护分支导致 ReferenceError，已移除并重跑通过；首次UI启动时Vite尚未运行，随后启动Vite并重跑通过。缓存Chromium路径已核实可用。Gradle脚本本身无执行位，使用bash复核后确认缺少Java；JDK21/SDK35和设备未就绪，原生测试未验证。

偏差：既有图片集成fixture补充显式supported声明，保留所有既有断言；旧配置仍unknown，不能继续默认发图。HdsStore启动透传已有normalize链路，仅增加连接变更后的能力重置。端点投影移除query避免回传可能的凭据，因此仅query中的连接变更仍依赖通用dirty重启提示；不比较明文凭据。

### P2 · 2026-10-15T16:55:02.268707+00:00

```sh
npm run typecheck
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


```

### P2 · 2026-10-15T16:55:59.973399+00:00

```sh
npm run typecheck && npm run build:host && node --import tsx --test tests/host.test.ts tests/message-contract.test.ts tests/image-chat.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6698.701027ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (7094.084142ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (10.640965ms)
✔ message merge retains identity and detects a moving 200-row window (12.528494ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (6.26238ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 23586.085529

```

### P2 · 2026-10-15T16:56:00.774753+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### P2 · 2026-10-15T16:56:58.255163+00:00

```sh
npm run typecheck && node --import tsx --test tests/host.test.ts tests/message-contract.test.ts tests/image-chat.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6796.35545ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (6463.250484ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.540081ms)
✔ message merge retains identity and detects a moving 200-row window (8.369051ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (14.610086ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20441.114602

```

### P2 · 2026-10-15T16:57:02.332785+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(Math.abs(await page.evaluate(() => scrollY - window.__readingY)) < 150)

    at file:///root/hermes-workspace/hds-android/tests/story-ui.mjs:285:10 {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.20.0

```

### P2 · 2026-10-15T16:58:28.822233+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /有 1 条新消息/ })[22m

    at /root/hermes-workspace/hds-android/tests/story-ui.mjs:289:56 {
  name: 'TimeoutError'
}

Node.js v24.20.0

```

### P2 · 2026-10-15T16:59:36.776591+00:00

```sh
npm run typecheck && node --import tsx --test tests/message-contract.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.807955ms)
✔ message merge retains identity and detects a moving 200-row window (4.055541ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (2.70898ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 335.170575

```

### P2 · 2026-10-15T17:00:00.276223+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

## P2 阶段结果

Linux：typecheck、build:host、host/message-contract/image-chat（5项）通过；最终UI输出包含Preview 8.1节点复用、200→200滚动窗口、新消息提示、跨页阅读位置、textarea增高/收缩通过。新增UI用例先发现两个问题：首个断言应比较可见锚点而非窗口删除首条后的绝对scrollY；另外非聊天页scroll事件清除了新消息提示，已限制为聊天页并重跑。既有断言未修改。触摸/键盘/大字体仍待Android。

### P3 · 2026-10-15T17:01:26.563804+00:00

```sh
npm run typecheck && npm run build:host && npm --prefix upstream/hds-interlude run typecheck
```

退出码：`2`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources

> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

error TS2688: Cannot find type definition file for 'yml-register/types'.
  The file is in the program because:
    Entry point of type library 'yml-register/types' specified in compilerOptions

```

### P3 · 2026-10-15T17:02:08.044834+00:00

```sh
npm run typecheck && npm run build:host && npm --prefix upstream/hds-interlude run typecheck
```

退出码：`2`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources

> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

error TS2688: Cannot find type definition file for 'yml-register/types'.
  The file is in the program because:
    Entry point of type library 'yml-register/types' specified in compilerOptions

```

### P3 · 2026-10-15T17:02:15.465424+00:00

```sh
npm --prefix upstream/hds-interlude run typecheck -- --types node
```

退出码：`2`

```text

> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters --types node

src/index.ts(475,7): error TS2322: Type 'Schema<ObjectS<{ enabled: Schema<boolean, boolean>; platforms: Schema<("qq" | "wechat")[], ("qq" | "wechat")[]>; quoteReply: Schema<boolean, boolean>; messageReactions: Schema<...>; allowedReactions: Schema<...>; nativeFaces: Schema<...>; expressionThreshold: Schema<...>; allowedNativeFaces: Schema<...>; }>, ObjectT...' is not assignable to type 'Schema<ChatActionsConfig>'.
  The types returned by 'computed(...)' are incompatible between these types.
    Type 'Schema<Computed<ObjectS<{ enabled: Schema<boolean, boolean>; platforms: Schema<("qq" | "wechat")[], ("qq" | "wechat")[]>; quoteReply: Schema<boolean, boolean>; messageReactions: Schema<...>; allowedReactions: Schema<...>; nativeFaces: Schema<...>; expressionThreshold: Schema<...>; allowedNativeFaces: Schema<...>; }>...' is not assignable to type 'Schema<Computed<ChatActionsConfig>, Computed<ChatActionsConfig>>'.
      Types of parameters 'data' and 'data' are incompatible.
        Type 'Computed<ChatActionsConfig>' is not assignable to type 'Computed<ObjectS<{ enabled: Schema<boolean, boolean>; platforms: Schema<("qq" | "wechat")[], ("qq" | "wechat")[]>; quoteReply: Schema<boolean, boolean>; messageReactions: Schema<...>; allowedReactions: Schema<...>; nativeFaces: Schema<...>; expressionThreshold: Schema<...>; allowedNativeFaces: Schema<...>; }>>'.
          Type 'ChatActionsConfig' is not assignable to type 'Computed<ObjectS<{ enabled: Schema<boolean, boolean>; platforms: Schema<("qq" | "wechat")[], ("qq" | "wechat")[]>; quoteReply: Schema<boolean, boolean>; messageReactions: Schema<...>; allowedReactions: Schema<...>; nativeFaces: Schema<...>; expressionThreshold: Schema<...>; allowedNativeFaces: Schema<...>; }>>'.
            Type 'ChatActionsConfig' is not assignable to type 'ObjectS<{ enabled: Schema<boolean, boolean>; platforms: Schema<("qq" | "wechat")[], ("qq" | "wechat")[]>; quoteReply: Schema<boolean, boolean>; messageReactions: Schema<...>; allowedReactions: Schema<...>; nativeFaces: Schema<...>; expressionThreshold: Schema<...>; allowedNativeFaces: Schema<...>; }>'.
              Type 'ChatActionsConfig' is not assignable to type '{ enabled?: boolean; platforms?: ("qq" | "wechat")[]; quoteReply?: boolean; messageReactions?: boolean; allowedReactions?: ("like" | "smile" | "laugh" | "heart" | "surprised" | "sad" | "angry")[]; nativeFaces?: boolean; expressionThreshold?: number; allowedNativeFaces?: ("smile" | ... 6 more ... | "awkward")[]; }'.
                Types of property 'platforms' are incompatible.
                  Type '("qq" | "wechat" | "local")[]' is not assignable to type '("qq" | "wechat")[]'.
                    Type '"qq" | "wechat" | "local"' is not assignable to type '"qq" | "wechat"'.
                      Type '"local"' is not assignable to type '"qq" | "wechat"'.
src/service.ts(17,80): error TS6133: 'WeatherConfig' is declared but its value is never read.
src/service.ts(17,100): error TS6133: 'WeatherSnapshot' is declared but its value is never read.
src/service.ts(10255,17): error TS6133: 'compactUnlocked' is declared but its value is never read.

```

### P3 · 2026-10-15T17:02:18.062925+00:00

```sh
npm install --prefix /tmp/hds81-typecheck --no-save --package-lock=false --ignore-scripts yml-register@1.2.5
```

退出码：`1`

```text
npm error code EROFS
npm error syscall open
npm error path /root/.npm/_cacache/tmp/***
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/yml-register: EROFS: read-only file system, open '/root/.npm/_cacache/tmp/***'
npm error rofs Often virtualized file systems, or other file systems that don't support symlinks, give this error.
npm error Log files were not written due to an error writing to the directory: /root/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

```

### P3 · 2026-10-15T17:02:37.012835+00:00

```sh
npm install --cache /tmp/hds81-npm-cache --prefix /tmp/hds81-typecheck --no-save --package-lock=false --ignore-scripts yml-register@1.2.5
```

退出码：`0`

```text

added 3 packages in 1s

1 package is looking for funding
  run `npm fund` for details
npm notice
npm notice New major version of npm available! 11.19.0 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice

```

### P3 · 2026-10-15T17:03:09.642585+00:00

```sh
node --import tsx --test upstream/hds-interlude/test/follow-up-commitment.test.ts upstream/hds-interlude/test/scheduler.test.ts upstream/hds-interlude/test/delivery-ledger.test.ts upstream/hds-interlude/test/time-context.test.ts
```

退出码：`0`

```text
✔ partial requires actual delivery, while unfinished attempts remain pending (18.22133ms)
✔ ledger read and write failures do not interrupt confirmation or remaining bubble scheduling (86.639314ms)
✔ M6 ledger groups text and platform segments under their script event identities (12.877296ms)
✔ M6 ledger reports partial and terminal delivery without downgrading delivered speech (8.114624ms)
✔ cancelled is terminal: later bookkeeping cannot revive a withdrawn action (4.948058ms)
✔ returning to pending for a retry clears the previous completion timestamp (5.164989ms)
✔ a successful retry clears an earlier transport failure reason (2.90045ms)
✔ M6 persistence changes metadata only and delivery preserves exact bubble text and source row (1.320011ms)
✔ platform references resolve the exact action segment and reject absent actions (1.658592ms)
✔ follow-up commitment instructions are limited to live and due turns (7.10855ms)
✔ only live and due prompt payloads carry the bounded commitment list (90.71357ms)
✔ scheduleWake keeps the earliest wake and cancels a later existing one (35.334283ms)
✔ wake fire returning busy rearms after retryDelayMs and retries (19.781005ms)
✔ wake fire throwing reports to onWakeError without rearm (10.012117ms)
✔ cancelWake cancels a single story; cancelWakes filters by story (7.604657ms)
✔ scheduleExclusive dedupes, defers while busy, and releases after completion (27.398603ms)
✔ scheduleExclusive halted releases the gate without running the task (2.89978ms)
✔ scheduleExclusive task failure reports to onTaskError and still releases (12.445783ms)
✔ backoff gates by fingerprint and expires into deletion (3.384628ms)
✔ 16:00 in Shanghai is an authoritative daylight afternoon (100.682983ms)
✔ long intervals expose both endpoint clocks and continuity age (5.601672ms)
✔ reload-style ISO timestamp rows are materialized as Date objects (2.034194ms)
✔ timezone formatters are reused instead of rebuilt on every turn (17.83337ms)
✔ recentScript payload carries derived ownership without changing stored entries (1.362336ms)
✔ timeline display uses the story timezone and prints its GMT offset (0.302171ms)
✔ explicit user-reported clocks stay distinct from the message receive time (9.443637ms)
✔ prompt payload keeps receive time and user-reported action time as separate fields (6.31966ms)
✔ short live windows reject explicit future clocks and multiple completed lesson stages (2.076139ms)
✔ midnight wraparound and latency grace do not drop legitimate live scripts (1.145469ms)
✔ the current user message remains both a durable event and the explicit currentEvent (0.656515ms)
✔ background Agency payload includes relationship identity but not raw chat history (0.748433ms)
✔ headline-window semantics: narrative declarations block, references and user deadlines pass (10.818136ms)
✔ user-endorsed clocks from the message exempt the guard while unendorsed ones stay blocked (6.951033ms)
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14722.474622

```

### P3 · 2026-10-15T17:03:26.265234+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters


```

### P3 · 2026-10-15T17:05:04.996029+00:00

```sh
npm run build:host && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (52.618003ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.094387ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✖ real 10-second due timer delivers without another user message while autoAdvance is off (2239.872955ms)
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 60334ms
    └─ 错误: All narrative providers failed. 原有模型连接 (attempt 1): request timeout
ℹ tests 3
ℹ suites 0
ℹ pass 2
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 67519.606177

✖ failing tests:

test at tests/scheduled-contact.test.ts:1:4853
✖ real 10-second due timer delivers without another user message while autoAdvance is off (2239.872955ms)
  TypeError: Cannot read properties of undefined (reading 'phase')
      at Server.<anonymous> (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:50:17)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)

```

### P3 · 2026-10-15T17:05:13.550077+00:00

```sh
node scripts/patch-mobile-hds.mjs && npm run typecheck && npm run build:host && node --import tsx --test tests/preview8.test.ts tests/host.test.ts
```

退出码：`0`

```text
Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6193.231965ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (16.407684ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (2.606777ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (4.514271ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (5769.448418ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (451.147492ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (2.884995ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16676.865275

```

### P3 · 2026-10-15T17:06:12.442130+00:00

```sh
npm run typecheck && node scripts/patch-mobile-hds.mjs && npm run build:host && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (44.081257ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.406306ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✖ real 10-second due timer delivers without another user message while autoAdvance is off (11673.497224ms)
ℹ tests 3
ℹ suites 0
ℹ pass 2
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14181.184657

✖ failing tests:

test at tests/scheduled-contact.test.ts:1:4853
✖ real 10-second due timer delivers without another user message while autoAdvance is off (11673.497224ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'pending'
  - 'completed'
  
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:72:12)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'pending',
    expected: 'completed',
    operator: 'strictEqual',
    diff: 'simple'
  }

```

### P3 · 2026-10-15T17:06:44.459082+00:00

```sh
node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`1`

```text
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (60.977208ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.26927ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✖ real 10-second due timer delivers without another user message while autoAdvance is off (11410.93437ms)
ℹ tests 3
ℹ suites 0
ℹ pass 2
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14495.649618

✖ failing tests:

test at tests/scheduled-contact.test.ts:1:4853
✖ real 10-second due timer delivers without another user message while autoAdvance is off (11410.93437ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'pending'
  - 'completed'
  
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:78:12)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'pending',
    expected: 'completed',
    operator: 'strictEqual',
    diff: 'simple'
  }

```

### P3 · 2026-10-15T17:08:03.178617+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm run build:host && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (44.178497ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.265876ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude ├─ ! 记忆压缩失败：context disposed
✔ real 10-second due timer delivers without another user message while autoAdvance is off (22451.041247ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 26541.45467

```

### P3 · 2026-10-15T17:08:08.813471+00:00

```sh
npm run typecheck && node --import tsx --test upstream/hds-interlude/test/follow-up-commitment.test.ts upstream/hds-interlude/test/scheduler.test.ts upstream/hds-interlude/test/delivery-ledger.test.ts upstream/hds-interlude/test/time-context.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ partial requires actual delivery, while unfinished attempts remain pending (1.965472ms)
✔ ledger read and write failures do not interrupt confirmation or remaining bubble scheduling (7.829629ms)
✔ M6 ledger groups text and platform segments under their script event identities (1.879519ms)
✔ M6 ledger reports partial and terminal delivery without downgrading delivered speech (0.912791ms)
✔ cancelled is terminal: later bookkeeping cannot revive a withdrawn action (0.852394ms)
✔ returning to pending for a retry clears the previous completion timestamp (0.774717ms)
✔ a successful retry clears an earlier transport failure reason (0.980773ms)
✔ M6 persistence changes metadata only and delivery preserves exact bubble text and source row (1.205101ms)
✔ platform references resolve the exact action segment and reject absent actions (1.719652ms)
✔ follow-up commitment instructions are limited to live and due turns (2.754716ms)
✔ only live and due prompt payloads carry the bounded commitment list (41.233828ms)
✔ scheduled policy and fixed local time survive both compiled prompt orders (2.486984ms)
✔ scheduleWake keeps the earliest wake and cancels a later existing one (14.925416ms)
✔ wake fire returning busy rearms after retryDelayMs and retries (2.841947ms)
✔ wake fire throwing reports to onWakeError without rearm (3.146092ms)
✔ cancelWake cancels a single story; cancelWakes filters by story (0.753133ms)
✔ scheduleExclusive dedupes, defers while busy, and releases after completion (5.548846ms)
✔ scheduleExclusive halted releases the gate without running the task (0.654659ms)
✔ scheduleExclusive task failure reports to onTaskError and still releases (3.553797ms)
✔ backoff gates by fingerprint and expires into deletion (0.690861ms)
✔ 16:00 in Shanghai is an authoritative daylight afternoon (32.886841ms)
✔ long intervals expose both endpoint clocks and continuity age (3.022397ms)
✔ reload-style ISO timestamp rows are materialized as Date objects (2.054111ms)
✔ timezone formatters are reused instead of rebuilt on every turn (6.050902ms)
✔ recentScript payload carries derived ownership without changing stored entries (1.363558ms)
✔ timeline display uses the story timezone and prints its GMT offset (0.390865ms)
✔ explicit user-reported clocks stay distinct from the message receive time (4.233718ms)
✔ prompt payload keeps receive time and user-reported action time as separate fields (1.317598ms)
✔ short live windows reject explicit future clocks and multiple completed lesson stages (2.551034ms)
✔ midnight wraparound and latency grace do not drop legitimate live scripts (1.208583ms)
✔ the current user message remains both a durable event and the explicit currentEvent (0.827311ms)
✔ background Agency payload includes relationship identity but not raw chat history (0.762255ms)
✔ headline-window semantics: narrative declarations block, references and user deadlines pass (2.490384ms)
✔ user-endorsed clocks from the message exempt the guard while unendorsed ones stay blocked (1.004778ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3137.172978

```

### P3 · 2026-10-15T17:09:28.526053+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm test
```

退出码：`2`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

src/service.ts(2060,68): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
src/service.ts(2061,221): error TS2365: Operator '>' cannot be applied to types 'unknown' and 'number'.

```

### P3 · 2026-10-15T17:09:33.479243+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### P3 · 2026-10-15T17:10:57.192682+00:00

```sh
npm run typecheck && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (195.863986ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (20.177717ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
✖ real 10-second due timer delivers without another user message while autoAdvance is off (28724.366129ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (170.848143ms)
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 3260ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
[W] hds-interlude ├─ ! 记忆压缩失败：context disposed
ℹ tests 4
ℹ suites 0
ℹ pass 3
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 56368.343887

✖ failing tests:

test at tests/scheduled-contact.test.ts:1:4853
✖ real 10-second due timer delivers without another user message while autoAdvance is off (28724.366129ms)
  AssertionError [ERR_ASSERTION]: model must receive compiled narrative context
      at Server.<anonymous> (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:48:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```

### P3 · 2026-10-15T17:11:04.906674+00:00

```sh
node --import tsx --test tests/message-contract.test.ts
```

退出码：`0`

```text
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (26.516ms)
✔ message merge retains identity and detects a moving 200-row window (30.601335ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (16.889378ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3894.985487

```

### P3 · 2026-10-15T17:11:29.703995+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: timeline/memory/mind tab reading positions.
PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### P3 · 2026-10-15T17:12:36.874375+00:00

```sh
npm run typecheck && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (793.427524ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (12.717161ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 306ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (25168.394508ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (9.825244ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 30511.295591

```

### P3 · 2026-10-15T17:13:00.706818+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm test
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (9.890126ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (10.109884ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (3.891285ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.275797ms)
✔ regex lore is preserved but never executed and budgets visibly trim (0.879587ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.308114ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (497.842525ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (49.354948ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (5065.777922ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (4621.249424ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.764484ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.945864ms)
✔ message merge retains identity and detects a moving 200-row window (12.086863ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (7.47084ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (8.807034ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.009682ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (3.426899ms)
✔ vision projection is canonical, secret-free and checks every candidate (6.631706ms)
✔ image entry explains all unavailable states in priority order (0.386944ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.62065ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.671888ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.413782ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (174.719302ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (2.892186ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (16.417684ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (15.817049ms)
✔ vision routing rejects missing or disabled dedicated models (2.620654ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (8123.194339ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (51.42586ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (7.969315ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (19.389973ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (7146.622191ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (1119.005089ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (2.468196ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (18.998706ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.160823ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (110.513959ms)
✔ QQ policy fails closed and renders message elements as inert text (4.88414ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: bd9e9db1-7460-4519-a703-baf385b8150a
[I] adapter connect to server: ws://127.0.0.1:38233/
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] session Error: OneBot WebSocket connection has closed
        at event <dispose> (/root/hermes-workspace/hds-android/node_modules/koishi-plugin-adapter-onebot/lib/index.js:699:19)
        at Object.apply (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/reflect.ts:221:23)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:21)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:29)
        at Array.filter (<anonymous>)
        at ForkScope.reset (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:177:51)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:264:12)
        at ForkScope.fork <root> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:118:14)
        at QQRuntime.stop (/root/hermes-workspace/hds-android/runtime/generated/host.cjs:21822:23)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: onebot:55555:12345
    └─ 错误: Private transport returned no message receipt.
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (10975.824432ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (34.488334ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.311696ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 193ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (21383.455942ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (10.536842ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (5529.269553ms)
ℹ tests 44
ℹ suites 0
ℹ pass 43
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 87661.665258

✖ failing tests:

test at tests/qq.test.ts:1:1400
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (10975.824432ms)
  AssertionError [ERR_ASSERTION]: Real HDS delivery must appear in QQ inbox
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/qq.test.ts:103:12)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```

### P3 · 2026-10-15T17:13:39.216485+00:00

```sh
npm run typecheck && node --import tsx --test tests/qq.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ QQ policy fails closed and renders message elements as inert text (26.67722ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 2fa53bf9-5608-4183-a3b0-5be67149e34d
[I] adapter connect to server: ws://127.0.0.1:45379/
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: 2fa53bf9-5608-4183-a3b0-5be67149e34d
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=2fa53bf9-5608-4183-a3b0-5be67149e34d
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (13703.141085ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16900.253759

```

### P3 · 2026-10-15T17:14:47.774817+00:00

```sh
npm test
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (36.703954ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (31.420985ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (5.947794ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.22622ms)
✔ regex lore is preserved but never executed and budgets visibly trim (10.709519ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.305688ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (1473.152649ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (204.912587ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (5402.107969ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ real HDS forwards native image input, retains attachment history and holds restored stories (4867.143375ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.912668ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.682679ms)
✔ message merge retains identity and detects a moving 200-row window (3.973198ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (3.045256ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.520185ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (0.98406ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (1.985522ms)
✔ vision projection is canonical, secret-free and checks every candidate (3.371962ms)
✔ image entry explains all unavailable states in priority order (0.398615ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.940518ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.775011ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.493435ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (54.019447ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.477327ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (6.093705ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (6.27099ms)
✔ vision routing rejects missing or disabled dedicated models (2.750614ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (6494.655157ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (19.489468ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.464182ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (5.556031ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (5667.258186ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (482.646966ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.481636ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (28.028861ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.528897ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (111.984504ms)
✔ QQ policy fails closed and renders message elements as inert text (5.310708ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 2f7a8c88-44d5-418a-bd67-b1ed0ebfa154
[I] adapter connect to server: ws://127.0.0.1:32785/
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: 2f7a8c88-44d5-418a-bd67-b1ed0ebfa154
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=2f7a8c88-44d5-418a-bd67-b1ed0ebfa154
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (11892.722686ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (46.803578ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.441128ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 275ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (21958.797392ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (23.556132ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude plugin load completed
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (6389.669036ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 84909.031521

```

## P3 阶段结果与源码偏差

最终 P3 `npm test` 44/44，退出0；根/上游typecheck、34项上游相关测试、UI回归均通过。首轮全量43/44失败在既有QQ收件箱可见性断言，单独重跑QQ为2/2，完整重跑44/44；未修改QQ实现和断言，保留该偶发时序风险供后续回归。

新增真实Koishi/SQLite/LocalBot测试：10秒真实timer（不再发用户消息，不手工sweep）；七分钟承诺相对请求时钟精确420000ms；确认实际可见后登记；新消息取消普通delayed并保留显式承诺；故事暂停不完成、恢复后手工推进due时间并验证可见消息和完成；不明确时间恰好一次修正后rejected，原确认不发送；取消普通计划不抹掉显式delayed wake。测试固定关闭辅助记忆/日程/Alter以隔离调度（辅助请求曾被fixture误当主叙事导致测试失败）；其他功能保持原回归。首次LocalBot可见后立即断言pending/completed存在真实异步窗口，新增用例改为等待账本收敛，保留最终状态断言。

偏差及理由：

- 实际prompt会经过script/context-compiler分组，直接在toPromptPayload中加字段会被丢弃；在已列清单的narrator输出边界将策略投影到authoringWindow，未扩展改动文件。
- 现有delayed在叙事成功时即标completed；显式scheduled-contact改为投递回执确认才完成，失败保持pending并退避；普通delayed保留原行为。
- 上游原始typecheck缺开发依赖yml-register（根npm缓存只读导致首安装失败，改用/tmp缓存与/tmp前缀安装1.2.5，再链接到被忽略的node_modules；没有修改依赖清单/锁文件）。随后发现旧移动补丁将ChatActions平台类型扩到local而Schema未同步，已在清单中的index.ts对齐。另删除两个未使用weather类型导入与全仓无调用/测试引用的旧private compactUnlocked死方法；它们是既有noUnused门禁错误，删除不改变执行路径。均纳入补丁，不修改其他上游模块。
- scripts/patch-mobile-hds.mjs支持临时源码目录和只读导入，新补丁逐个识别原文/已应用/未知锚点；fixture首次应用、第二次无差异、锚点失配明确失败以及与实际源码对齐已通过。
- D7未实现START_STICKY/受控恢复，保留原有FGS/wake lock，归Preview 8.2/T13。

### P4 · 2026-10-15T17:16:10.680131+00:00

```sh
npm run typecheck && npm run build:host && node --import tsx --test tests/host.test.ts tests/media.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:16:05→10/16 01:16:06
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 171ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (5469.15325ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (5.091074ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7297.256949

```

### P4 · 2026-10-15T17:16:50.643271+00:00

```sh
npm run typecheck && node --import tsx --test tests/host.test.ts tests/media.test.ts && node --import tsx --test upstream/hds-interlude/test/logging.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

/root/hermes-workspace/hds-android/node_modules/@koishijs/loader/src/index.ts:19
export default class NodeLoader extends Loader {
^

TypeError: Class extends value #<Object> is not a constructor or null
    at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@koishijs/loader/src/index.ts:19:1)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.20.0
✖ tests/host.test.ts (827.586121ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.641664ms)
ℹ tests 2
ℹ suites 0
ℹ pass 1
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1050.268312

✖ failing tests:

test at tests/host.test.ts:1:1
✖ tests/host.test.ts (827.586121ms)
  'test failed'

```

### P4 · 2026-10-15T17:18:05.862627+00:00

```sh
npm run typecheck && node --import tsx --test tests/host.test.ts tests/media.test.ts && node --import tsx --test upstream/hds-interlude/test/logging.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:17:56→10/16 01:17:58
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 221ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (8442.914709ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (25.490976ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12356.284355
✔ user-message logs read as a compact task timeline (27.595827ms)
✔ Alter and error records use stable semantic markers (0.701017ms)
✔ colors can be enabled and kaomoji can be replaced by simple symbols (2.108488ms)
✔ dark and light themes use separate high-contrast 256-color palettes (5.617514ms)
✔ Agency decisions have a distinct subjectivity marker (4.889347ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1516.296673

```

### P4 · 2026-10-15T17:18:15.026791+00:00

```sh
cd android && bash ./gradlew lintRelease testReleaseUnitTest assembleDebug connectedDebugAndroidTest
```

退出码：`1`

```text

ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.

Please set the JAVA_HOME variable in your environment to match the
location of your Java installation.


```

### P4 · 2026-10-15T17:18:18.698441+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: timeline/memory/mind tab reading positions.
PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### P4 · 2026-10-15T17:19:32.158256+00:00

```sh
npm run android:sync
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 android:sync
> npm run build && cap sync android


> hds-android@0.1.0-preview.8 build
> npm run typecheck && vite build


> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

vite v6.0.7 building for production...
transforming...
✓ 117 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.32 kB
dist/assets/index-C6mELJEd.css   31.18 kB │ gzip:   7.28 kB
dist/assets/index-C9BUS3m3.js   343.50 kB │ gzip: 118.23 kB
✓ built in 8.86s
✔ Copying web assets from dist to android/app/src/main/assets/public in 22.14ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 4.79ms
✔ copy android in 179.39ms
✔ Updating Android plugins in 16.01ms
✔ update android in 203.38ms
[info] Sync finished in 0.501s

```

### Final · 2026-10-15T17:20:13.668886+00:00

```sh
node_modules/.bin/tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --resolveJsonModule --types node runtime/host.ts runtime/model-config.ts
```

退出码：`2`

```text
runtime/host.ts(37,20): error TS2345: Argument of type '"mobile_message"' is not assignable to parameter of type 'Keys<Tables, any>'.
runtime/host.ts(38,20): error TS2345: Argument of type '"mobile_request"' is not assignable to parameter of type 'Keys<Tables, any>'.
runtime/host.ts(43,5): error TS2416: Property 'dispose' in type 'LocalBot' is not assignable to the same property in base type 'Bot<Context, any>'.
  Type '() => void' is not assignable to type '() => Promise<void>'.
    Type 'void' is not assignable to type 'Promise<void>'.
runtime/host.ts(60,5): error TS2322: Type 'Partial<StoryDefaults>' is not assignable to type 'StoryDefaults'.
  Property 'characterName' is optional in type 'Partial<StoryDefaults>' but required in type 'StoryDefaults'.
runtime/host.ts(61,5): error TS2322: Type 'Partial<ModelConfig> & { providers: ProviderConfig[]; }' is not assignable to type 'ModelConfig'.
  Property 'failover' is optional in type 'Partial<ModelConfig> & { providers: ProviderConfig[]; }' but required in type 'ModelConfig'.
runtime/host.ts(62,5): error TS2739: Type '{ level: "info"; verbosity: "standard"; colors: false; kaomoji: false; logMessageContent: false; logScriptPreview: false; }' is missing the following properties from type 'LoggingConfig': format, previewLength
runtime/host.ts(63,32): error TS2740: Type '{ enabled: false; }' is missing the following properties from type 'BrowserConfig': mode, allowSearch, allowVisit, searchUrlTemplate, and 12 more.
runtime/host.ts(78,14): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'typeof import("/root/hermes-workspace/hds-android/upstream/hds-interlude/src/index")' is not assignable to parameter of type 'Object<Context, Config>'.
      Types of property 'inject' are incompatible.
        Type '{ required: string[]; optional: string[]; }' is not assignable to type 'Inject'.
          Type '{ required: string[]; optional: string[]; }' is not assignable to type 'Dict<Meta>'.
            Property 'required' is incompatible with index signature.
              Property 'required' is missing in type 'string[]' but required in type 'Meta'.
runtime/host.ts(93,45): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(93,89): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(110,57): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(150,60): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(184,85): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(205,54): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
runtime/host.ts(205,62): error TS2345: Argument of type 'string' is not assignable to parameter of type '`${string}-${string}-${string}-${string}-${string}`'.
runtime/qq.ts(96,113): error TS2707: Generic type 'OneBotBot<C, T>' requires between 1 and 2 type arguments.
runtime/qq.ts(218,24): error TS2339: Property 'ELECTRON_RUN_AS_NODE' does not exist on type '{ DISPLAY: string; XAUTHORITY: string; NAPCAT_MAIN_PATH: string; HOME: string; XDG_CONFIG_HOME: string; NAPCAT_WORKDIR: string; NAPCAT_WRAPPER_PATH: string; NAPCAT_QQ_PACKAGE_INFO_PATH: string; ... 5 more ...; TZ?: string; }'.

```

### Final · 2026-10-15T17:20:36.997135+00:00

```sh
npm run typecheck && node --import tsx --test tests/message-contract.test.ts tests/model-config.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (10.582044ms)
✔ message merge retains identity and detects a moving 200-row window (7.85557ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (2.639488ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (6.809987ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.021133ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (6.90031ms)
✔ vision projection is canonical, secret-free and checks every candidate (7.151193ms)
✔ image entry explains all unavailable states in priority order (0.343264ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1067.710086

```

### P4 · 2026-10-15T17:21:48.025785+00:00

```sh
npm run typecheck && node scripts/patch-mobile-hds.mjs && npm --prefix upstream/hds-interlude run typecheck && npm test
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

Applied narrow local-channel, character-context and Preview 8.1 patches

> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters


> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (28.684678ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (17.064675ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (8.236391ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.223041ms)
✔ regex lore is preserved but never executed and budgets visibly trim (8.21566ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (6.877173ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (1224.464121ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (144.09049ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:19:49→10/16 01:19:51
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 324ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (8114.341617ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:20:03→10/16 01:20:05
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 283ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (9902.088632ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (37.344421ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (3.469334ms)
✔ message merge retains identity and detects a moving 200-row window (5.071281ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (3.703308ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (4.168215ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.346278ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.811287ms)
✔ vision projection is canonical, secret-free and checks every candidate (3.6571ms)
✔ image entry explains all unavailable states in priority order (0.521187ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.657823ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.802089ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.512761ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (72.377428ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.400462ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (6.155319ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (6.517987ms)
✔ vision routing rejects missing or disabled dedicated models (2.363249ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:20:18→10/16 01:20:19
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 160ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (5508.750017ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (35.043309ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (10.613735ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (10.131306ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:20:28→10/16 01:20:31
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 246ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (8757.367669ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (566.412143ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (3.940012ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (39.064963ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (6.100439ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (188.435771ms)
✔ QQ policy fails closed and renders message elements as inert text (4.814429ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: c83024f2-2fbb-4d68-b97e-b463659fb0c2
[I] adapter connect to server: ws://127.0.0.1:32839/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:20:39→10/16 01:20:44
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 160ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[W] session Error: OneBot WebSocket connection has closed
        at event <dispose> (/root/hermes-workspace/hds-android/node_modules/koishi-plugin-adapter-onebot/lib/index.js:699:19)
        at Object.apply (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/reflect.ts:221:23)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:21)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:29)
        at Array.filter (<anonymous>)
        at ForkScope.reset (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:177:51)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:264:12)
        at ForkScope.fork <root> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:118:14)
        at QQRuntime.stop (/root/hermes-workspace/hds-android/runtime/generated/host.cjs:21826:23)
        at processTicksAndRejections (node:internal/process/task_queues:104:5)
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: onebot:55555:12345
    └─ 错误: Private transport returned no message receipt.
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (10562.363475ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (66.387438ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.256736ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:20:54→10/16 01:20:56
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 843ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 1889ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:20:56→10/16 01:21:07
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 771ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:21:07→10/16 01:21:14
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 1866ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:28:14
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:21:14→10/16 01:21:22
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 768ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:21:22→10/16 01:21:24
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 387ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:21:24→10/16 01:21:27
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 1816ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (38158.557791ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (108.32236ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:21:40→10/16 01:21:42
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3847ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (8270.174908ms)
ℹ tests 44
ℹ suites 0
ℹ pass 43
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 124929.737788

✖ failing tests:

test at tests/qq.test.ts:1:1400
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (10562.363475ms)
  AssertionError [ERR_ASSERTION]: Real HDS delivery must appear in QQ inbox
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/qq.test.ts:103:12)
      at runNextTicks (node:internal/process/task_queues:65:5)
      at process.processTimers (node:internal/timers:615:9)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```

### Baseline · 2026-10-15T17:21:53.250499+00:00

```sh
node_modules/.bin/tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --resolveJsonModule --types node /tmp/hds81-baseline-typecheck/runtime/host.ts /tmp/hds81-baseline-typecheck/runtime/model-config.ts
```

退出码：`2`

```text
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(37,20): error TS2345: Argument of type '"mobile_message"' is not assignable to parameter of type 'Keys<Tables, any>'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(38,20): error TS2345: Argument of type '"mobile_request"' is not assignable to parameter of type 'Keys<Tables, any>'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(43,5): error TS2416: Property 'dispose' in type 'LocalBot' is not assignable to the same property in base type 'Bot<Context, any>'.
  Type '() => void' is not assignable to type '() => Promise<void>'.
    Type 'void' is not assignable to type 'Promise<void>'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(60,5): error TS2322: Type 'Partial<StoryDefaults>' is not assignable to type 'StoryDefaults'.
  Property 'characterName' is optional in type 'Partial<StoryDefaults>' but required in type 'StoryDefaults'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(61,5): error TS2322: Type 'Partial<ModelConfig> & { providers: ProviderConfig[]; }' is not assignable to type 'ModelConfig'.
  Property 'failover' is optional in type 'Partial<ModelConfig> & { providers: ProviderConfig[]; }' but required in type 'ModelConfig'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(62,5): error TS2739: Type '{ level: "warn"; colors: false; kaomoji: false; logMessageContent: false; logScriptPreview: false; }' is missing the following properties from type 'LoggingConfig': format, previewLength
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(63,32): error TS2740: Type '{ enabled: false; }' is missing the following properties from type 'BrowserConfig': mode, allowSearch, allowVisit, searchUrlTemplate, and 12 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(77,14): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'typeof import("/tmp/hds81-baseline-typecheck/upstream/hds-interlude/src/index")' is not assignable to parameter of type 'Object<Context, Config>'.
      Types of property 'inject' are incompatible.
        Type '{ required: string[]; optional: string[]; }' is not assignable to type 'Inject'.
          Type '{ required: string[]; optional: string[]; }' is not assignable to type 'Dict<Meta>'.
            Property 'required' is incompatible with index signature.
              Property 'required' is missing in type 'string[]' but required in type 'Meta'.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(92,45): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(92,89): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(109,57): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(149,60): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(177,85): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(197,54): error TS2345: Argument of type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is not assignable to parameter of type 'Session<never, never, Context>'.
  Type 'Session<Context> & { username: string; send: (fragment: unknown) => Promise<`${string}-${string}-${string}-${string}-${string}`[]>; }' is missing the following properties from type 'Session<never, never, Context>': permissions, resolve, stripped, cancelQueued, and 14 more.
../../../tmp/hds81-baseline-typecheck/runtime/host.ts(197,62): error TS2345: Argument of type 'string' is not assignable to parameter of type '`${string}-${string}-${string}-${string}-${string}`'.
../../../tmp/hds81-baseline-typecheck/runtime/qq.ts(96,113): error TS2707: Generic type 'OneBotBot<C, T>' requires between 1 and 2 type arguments.
../../../tmp/hds81-baseline-typecheck/runtime/qq.ts(218,24): error TS2339: Property 'ELECTRON_RUN_AS_NODE' does not exist on type '{ DISPLAY: string; XAUTHORITY: string; NAPCAT_MAIN_PATH: string; HOME: string; XDG_CONFIG_HOME: string; NAPCAT_WORKDIR: string; NAPCAT_WRAPPER_PATH: string; NAPCAT_QQ_PACKAGE_INFO_PATH: string; ... 5 more ...; TZ?: string; }'.

```

### Final · 2026-10-15T17:22:08.895010+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: '重试保存', exact: true })[22m

    at /root/hermes-workspace/hds-android/tests/story-ui.mjs:103:65 {
  name: 'TimeoutError'
}

Node.js v24.20.0

```

### Final · 2026-10-15T17:22:16.347586+00:00

```sh
NODE_OPTIONS=--test-concurrency=1 npm test
```

退出码：`9`

```text
node: --test-concurrency= is not allowed in NODE_OPTIONS

```

### Final · 2026-10-15T17:23:52.610548+00:00

```sh
npm run typecheck && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (82.606351ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (9.492219ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:24→10/16 01:23:26
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 328ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 131ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:26→10/16 01:23:36
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 463ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:36→10/16 01:23:38
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 454ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:30:38
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:38→10/16 01:23:43
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 40ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:43→10/16 01:23:45
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 80ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:45→10/16 01:23:46
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 298ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (24087.866603ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (21.70906ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:48→10/16 01:23:49
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 2233ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (4428.702928ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32208.632092

```

### Final · 2026-10-15T17:24:03.822333+00:00

```sh
hds_test_cpu=$(python3 -c 'import os; print(min(os.sched_getaffinity(0)))') && taskset -c "$hds_test_cpu" npm test
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (9.719621ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (12.106263ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (4.294664ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.356089ms)
✔ regex lore is preserved but never executed and budgets visibly trim (0.899841ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.337917ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (472.241889ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (54.669002ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:22:38→10/16 01:22:39
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 151ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6050.852486ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:22:46→10/16 01:22:47
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 202ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (5620.671463ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.737368ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.813677ms)
✔ message merge retains identity and detects a moving 200-row window (7.113566ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (4.780097ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (2.888401ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (0.9498ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.387843ms)
✔ vision projection is canonical, secret-free and checks every candidate (2.777056ms)
✔ image entry explains all unavailable states in priority order (0.346814ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.164601ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.685389ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.447415ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (45.847519ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.04787ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (4.788891ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (5.102114ms)
✔ vision routing rejects missing or disabled dedicated models (2.448051ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:22:54→10/16 01:22:56
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 145ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (4782.537152ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (19.060794ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.815429ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (7.081432ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:01→10/16 01:23:03
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 123ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (5107.645584ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (514.660616ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.779604ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (61.582002ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (3.141423ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (211.62995ms)
✔ QQ policy fails closed and renders message elements as inert text (16.603155ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 65f3946e-4881-49e5-9f88-fd14dafefb54
[I] adapter connect to server: ws://127.0.0.1:32883/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:23:13→10/16 01:23:18
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 175ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[W] session Error: OneBot WebSocket connection has closed
        at event <dispose> (/root/hermes-workspace/hds-android/node_modules/koishi-plugin-adapter-onebot/lib/index.js:699:19)
        at Object.apply (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/reflect.ts:221:23)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:21)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:179:29)
        at Array.filter (<anonymous>)
        at ForkScope.reset (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:177:51)
        at <anonymous> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:264:12)
        at ForkScope.fork <root> (/root/hermes-workspace/hds-android/node_modules/@cordisjs/core/src/scope.ts:118:14)
        at QQRuntime.stop (/root/hermes-workspace/hds-android/runtime/generated/host.cjs:21826:23)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: onebot:55555:12345
    └─ 错误: Private transport returned no message receipt.
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (12004.583126ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (32.129274ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.231236ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:27→10/16 01:23:29
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 254ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 291ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:29→10/16 01:23:39
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 435ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:39→10/16 01:23:41
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 297ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:30:41
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:41→10/16 01:23:45
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 143ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:45→10/16 01:23:47
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 112ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:47→10/16 01:23:49
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 112ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (22409.332204ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (14.667203ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:50→10/16 01:23:51
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 2948ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (5183.407825ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:23:58→10/16 01:23:59
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3587ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (6114.975153ms)
ℹ tests 45
ℹ suites 0
ℹ pass 44
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 88339.213388

✖ failing tests:

test at tests/qq.test.ts:1:1400
✖ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (12004.583126ms)
  AssertionError [ERR_ASSERTION]: Real HDS delivery must appear in QQ inbox
      at TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/qq.test.ts:103:12)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```

### Final · 2026-10-15T17:24:50.277947+00:00

```sh
node --import tsx --test tests/message-contract.test.ts --test-concurrency=1
```

退出码：`0`

```text
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (3.241031ms)
✔ message merge retains identity and detects a moving 200-row window (4.704631ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (3.841628ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 344.55181

```

### Final · 2026-10-15T17:26:23.397609+00:00

```sh
npm test -- --test-concurrency=1
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts --test-concurrency=1


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (13.884407ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (13.104438ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (6.628544ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.336332ms)
✔ regex lore is preserved but never executed and budgets visibly trim (0.957453ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.383099ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (510.60682ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (58.100437ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:00→10/16 01:25:02
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 174ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (5819.642966ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:08→10/16 01:25:09
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 210ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (5661.452125ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (4.090234ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (3.052189ms)
✔ message merge retains identity and detects a moving 200-row window (4.535079ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (3.227374ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.265552ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.06192ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.321235ms)
✔ vision projection is canonical, secret-free and checks every candidate (3.028004ms)
✔ image entry explains all unavailable states in priority order (0.413964ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.452085ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.745556ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.48048ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (47.178195ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.163679ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (5.25052ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (5.980274ms)
✔ vision routing rejects missing or disabled dedicated models (2.62795ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:17→10/16 01:25:18
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 205ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (5898.346641ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (19.351683ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (6.080167ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (5.532639ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:25→10/16 01:25:26
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 164ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (5325.21204ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (522.244922ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.937478ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (24.181176ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.596411ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (99.101502ms)
✔ QQ policy fails closed and renders message elements as inert text (5.121239ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 19061a08-1283-45de-b81e-523094afaac5
[I] adapter connect to server: ws://127.0.0.1:46129/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:25:33→10/16 01:25:37
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 219ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[I] hds-interlude [群聊] 星禾 ◎ 收到群聊消息
    ├─ 群聊: •8888
    └─ 发送者: •7777
[I] hds-interlude ├─ ◎ 群聊消息准备进入主叙事
       ├─ 群聊: 88888
       ├─ 模式: mention-only
       ├─ 意愿: 0.000
       └─ 档位: off
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: 全局
       ├─ 时间段: 10/16 01:25:37→10/16 01:25:44
       └─ 到期计划: 0
[I] hds-interlude ├─ • 日程物化已滞后于今天，本地重物化锚定=2026-10-16
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 283ms
       ├─ 剧本文字: 15
       └─ 回复模式: group:immediate
[I] hds-interlude ├─ • 无参与者回合已重排 interaction 回复
       ├─ 原mode: immediate
       └─ 处理: 提升为群发
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: 19061a08-1283-45de-b81e-523094afaac5
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=19061a08-1283-45de-b81e-523094afaac5
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (12719.936355ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (67.068954ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (4.622509ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:49→10/16 01:25:50
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 120ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 102ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:25:50→10/16 01:26:00
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 134ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:00→10/16 01:26:02
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 104ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:33:02
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:02→10/16 01:26:06
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 92ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:06→10/16 01:26:08
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 58ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:08→10/16 01:26:10
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 250ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (22183.032289ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (8.612667ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:10→10/16 01:26:11
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3029ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (4598.719364ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:17→10/16 01:26:19
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3439ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (5746.799918ms)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 86338.821785

```

### Final · 2026-10-15T17:27:37.503669+00:00

```sh
npm run typecheck && node --import tsx --test tests/message-contract.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (4.67261ms)
✔ message merge retains identity and detects a moving 200-row window (5.650077ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (2.78405ms)
✔ explicit native rejection is failed; lost transport remains unknown (1.644781ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 627.053452

```

### Final · 2026-10-15T17:27:57.421084+00:00

```sh
npm test
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (10.315875ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (10.460022ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (4.126157ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.302768ms)
✔ regex lore is preserved but never executed and budgets visibly trim (0.915808ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.393379ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (437.874152ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (51.622265ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:32→10/16 01:26:34
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 184ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6288.445162ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:40→10/16 01:26:42
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 231ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (5323.595606ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.598267ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.82266ms)
✔ message merge retains identity and detects a moving 200-row window (4.40892ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (3.052427ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.046091ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.048567ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (3.726138ms)
✔ vision projection is canonical, secret-free and checks every candidate (2.714996ms)
✔ image entry explains all unavailable states in priority order (0.389023ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.077338ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.694834ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.448504ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (46.398969ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.19858ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (4.921164ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (5.413581ms)
✔ vision routing rejects missing or disabled dedicated models (4.110758ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:50→10/16 01:26:51
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 156ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (6707.508948ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (19.21831ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.075306ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (4.654823ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:26:58→10/16 01:26:59
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 159ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (5305.00495ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (519.912403ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (3.772485ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (22.2509ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.357931ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (111.946996ms)
✔ QQ policy fails closed and renders message elements as inert text (4.90275ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: e8b55562-5ba4-46c8-96ad-72015a71c4e0
[I] adapter connect to server: ws://127.0.0.1:46627/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:27:06→10/16 01:27:10
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 209ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[I] hds-interlude [群聊] 星禾 ◎ 收到群聊消息
    ├─ 群聊: •8888
    └─ 发送者: •7777
[I] hds-interlude ├─ ◎ 群聊消息准备进入主叙事
       ├─ 群聊: 88888
       ├─ 模式: mention-only
       ├─ 意愿: 0.000
       └─ 档位: off
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: 全局
       ├─ 时间段: 10/16 01:27:10→10/16 01:27:18
       └─ 到期计划: 0
[I] hds-interlude ├─ • 日程物化已滞后于今天，本地重物化锚定=2026-10-16
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 88ms
       ├─ 剧本文字: 15
       └─ 回复模式: group:immediate
[I] hds-interlude ├─ • 无参与者回合已重排 interaction 回复
       ├─ 原mode: immediate
       └─ 处理: 提升为群发
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: e8b55562-5ba4-46c8-96ad-72015a71c4e0
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=e8b55562-5ba4-46c8-96ad-72015a71c4e0
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (13035.96947ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (33.245498ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.413759ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:21→10/16 01:27:23
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 235ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 391ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:23→10/16 01:27:33
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 365ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:33→10/16 01:27:35
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 161ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:34:35
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:35→10/16 01:27:38
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 61ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:38→10/16 01:27:41
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 88ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:41→10/16 01:27:42
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 155ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (22096.146658ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (23.360316ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:43→10/16 01:27:44
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3480ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (5367.918354ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:27:51→10/16 01:27:53
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3114ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (5857.092162ms)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 87401.478775

```

### Final · 2026-10-15T17:28:28.625691+00:00

```sh
git diff --check && git branch --show-current && git rev-parse --short HEAD && python3 --version && node -p 'JSON.stringify({version:require("./package.json").version,lockVersion:require("./package-lock.json").version,versionCode:16})'
```

退出码：`0`

```text
main
3d69c29
Python 3.11.2
{"version":"0.1.0-preview.8","lockVersion":"0.1.0-preview.8","versionCode":16}

```

### Final · 2026-10-15T17:28:57.984607+00:00

```sh
node /tmp/hds81-versions.mjs && git diff --check && sha256sum runtime/generated/host.cjs packages/contracts/mobile-config.schema.json android/app/src/main/assets/mobile-config.schema.json
```

退出码：`0`

```text
{"package":"0.1.0-preview.8","lock":"0.1.0-preview.8","lockRoot":"0.1.0-preview.8","androidVersionName":"0.1.0-preview.8","androidVersionCode":16}
18a1dbfe5138b97052b9fa91c700d243573234b274ead4be2f47d5013df27b8d  runtime/generated/host.cjs
db2864a09181dc1489a35f235659dadd6de88551f2ea5f9bcd142705da490038  packages/contracts/mobile-config.schema.json
db2864a09181dc1489a35f235659dadd6de88551f2ea5f9bcd142705da490038  android/app/src/main/assets/mobile-config.schema.json

```

### Final · 2026-10-15T17:29:21.867999+00:00

```sh
npm run typecheck && HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: an accepted history receipt resolves an unknown send without resend.
PASS Preview 8.1: timeline/memory/mind tab reading positions.
PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### Final · 2026-10-15T17:30:52.403316+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && node --import tsx --test upstream/hds-interlude/test/follow-up-commitment.test.ts upstream/hds-interlude/test/scheduler.test.ts upstream/hds-interlude/test/delivery-ledger.test.ts upstream/hds-interlude/test/time-context.test.ts upstream/hds-interlude/test/logging.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches
✔ partial requires actual delivery, while unfinished attempts remain pending (2.057658ms)
✔ ledger read and write failures do not interrupt confirmation or remaining bubble scheduling (6.281855ms)
✔ M6 ledger groups text and platform segments under their script event identities (2.001538ms)
✔ M6 ledger reports partial and terminal delivery without downgrading delivered speech (0.997248ms)
✔ cancelled is terminal: later bookkeeping cannot revive a withdrawn action (0.888416ms)
✔ returning to pending for a retry clears the previous completion timestamp (0.808098ms)
✔ a successful retry clears an earlier transport failure reason (0.973961ms)
✔ M6 persistence changes metadata only and delivery preserves exact bubble text and source row (1.241282ms)
✔ platform references resolve the exact action segment and reject absent actions (1.693864ms)
✔ follow-up commitment instructions are limited to live and due turns (2.874598ms)
✔ only live and due prompt payloads carry the bounded commitment list (43.919259ms)
✔ scheduled policy and fixed local time survive both compiled prompt orders (2.413359ms)
✔ user-message logs read as a compact task timeline (7.934747ms)
✔ Alter and error records use stable semantic markers (0.676119ms)
✔ colors can be enabled and kaomoji can be replaced by simple symbols (0.626187ms)
✔ dark and light themes use separate high-contrast 256-color palettes (0.89586ms)
✔ Agency decisions have a distinct subjectivity marker (0.661363ms)
✔ scheduleWake keeps the earliest wake and cancels a later existing one (15.651087ms)
✔ wake fire returning busy rearms after retryDelayMs and retries (2.997971ms)
✔ wake fire throwing reports to onWakeError without rearm (4.035227ms)
✔ cancelWake cancels a single story; cancelWakes filters by story (0.711907ms)
✔ scheduleExclusive dedupes, defers while busy, and releases after completion (5.689316ms)
✔ scheduleExclusive halted releases the gate without running the task (0.632431ms)
✔ scheduleExclusive task failure reports to onTaskError and still releases (3.380962ms)
✔ backoff gates by fingerprint and expires into deletion (0.688552ms)
✔ 16:00 in Shanghai is an authoritative daylight afternoon (25.762818ms)
✔ long intervals expose both endpoint clocks and continuity age (3.350569ms)
✔ reload-style ISO timestamp rows are materialized as Date objects (1.902298ms)
✔ timezone formatters are reused instead of rebuilt on every turn (14.51341ms)
✔ recentScript payload carries derived ownership without changing stored entries (1.370881ms)
✔ timeline display uses the story timezone and prints its GMT offset (0.418414ms)
✔ explicit user-reported clocks stay distinct from the message receive time (4.163639ms)
✔ prompt payload keeps receive time and user-reported action time as separate fields (1.130556ms)
✔ short live windows reject explicit future clocks and multiple completed lesson stages (2.114499ms)
✔ midnight wraparound and latency grace do not drop legitimate live scripts (1.185144ms)
✔ the current user message remains both a durable event and the explicit currentEvent (0.736999ms)
✔ background Agency payload includes relationship identity but not raw chat history (0.727486ms)
✔ headline-window semantics: narrative declarations block, references and user deadlines pass (2.128723ms)
✔ user-endorsed clocks from the message exempt the guard while unendorsed ones stay blocked (1.112064ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3575.690123

```

### Final · 2026-10-15T17:33:07.318707+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm run build:host && node --import tsx --test tests/scheduled-contact.test.ts tests/preview8.test.ts tests/message-contract.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (4.497955ms)
✔ message merge retains identity and detects a moving 200-row window (6.113103ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (7.173996ms)
✔ explicit native rejection is failed; lost transport remains unknown (2.622282ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (18.194105ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (6.1056ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (9.247594ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:30→10/16 01:32:32
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 122ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (6949.0105ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (557.647551ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.734028ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (84.290258ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (5.488959ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:42→10/16 01:32:43
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 290ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 110ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:43→10/16 01:32:53
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 59ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:53→10/16 01:32:55
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 116ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:39:55
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:55→10/16 01:32:58
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 103ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:32:58→10/16 01:33:00
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 76ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:33:00→10/16 01:33:02
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 167ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (21254.118727ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (8.419015ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:33:02→10/16 01:33:03
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 2885ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (4646.5871ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 40243.308051

```

### Final · 2026-10-15T17:35:42.126019+00:00

```sh
npm run typecheck && node --import tsx --test tests/scheduled-contact.test.ts
```

退出码：`1`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (60.14186ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (4.44924ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:34:58→10/16 01:34:59
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 138ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [系统] HDSI → 待投递补偿扫描完成
    ├─ 尝试: 1
    ├─ 成功: 1
    └─ 耗时: 124ms
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:34:59→10/16 01:35:09
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 76ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:09→10/16 01:35:10
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 150ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:42:10
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:10→10/16 01:35:14
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 64ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:14→10/16 01:35:15
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 90ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:35:16
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:35:16
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:15→10/16 01:35:16
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 31ms
    └─ 错误: 已达 24 小时后台模型预算；直接聊天仍可用
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: true
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:15→10/16 01:35:17
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 71ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 04:14:17
       └─ 间隔: 159分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: mobile-local:local-role:local-user
    └─ 错误: fixture endpoint failure
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:17→10/16 01:35:17
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 91ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 05:29:17
       └─ 间隔: 234分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[W] hds-interlude ├─ ! 消息被端点门控阻止
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 端点: abff53e4-8322-4679-82b0-c92c28af5851
       └─ 原因: endpoint-cooldown
✖ real 10-second due timer delivers without another user message while autoAdvance is off (40287.798212ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (29.189257ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:35:38→10/16 01:35:39
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 2287ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (4099.938808ms)
ℹ tests 5
ℹ suites 0
ℹ pass 4
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 47278.011309

✖ failing tests:

test at tests/scheduled-contact.test.ts:1:5377
✖ real 10-second due timer delivers without another user message while autoAdvance is off (40287.798212ms)
  AssertionError [ERR_ASSERTION]: condition did not become true
      at until (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:17:186)
      at async TestContext.<anonymous> (/root/hermes-workspace/hds-android/tests/scheduled-contact.test.ts:163:5)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: undefined,
    operator: 'fail',
    diff: 'simple'
  }

```

### Final · 2026-10-15T17:38:28.081125+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm run build:host && node --import tsx --test tests/scheduled-contact.test.ts tests/preview8.test.ts
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ supported schema derives upstream defaults; master switch gates independent scheduling (16.469192ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.874502ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (5.6525ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:37:48→10/16 01:37:50
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 122ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (6169.746916ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (528.86701ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.644109ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (34.392273ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.43546ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:37:59→10/16 01:38:00
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 216ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:00→10/16 01:38:10
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 114ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:10→10/16 01:38:11
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 184ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:45:11
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:11→10/16 01:38:16
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 63ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:16→10/16 01:38:19
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 65ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:38:19
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:38:19
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:19→10/16 01:38:20
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 39ms
    └─ 错误: 已达 24 小时后台模型预算；直接聊天仍可用
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: true
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ ↻ 跳过暂停参与者的到期计划
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 数量: 1
       └─ 取消重试: 0
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:19→10/16 01:38:20
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 89ms
    └─ 错误: All narrative providers failed. 原有模型连接 (attempt 1): HTTP 500 Internal Server Error：{}
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:19→10/16 01:38:20
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 38ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 03:57:20
       └─ 间隔: 139分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: mobile-local:local-role:local-user
    └─ 错误: fixture endpoint failure
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:20→10/16 01:38:20
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 39ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 05:31:20
       └─ 间隔: 233分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:20→10/16 01:38:21
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 265ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (23823.902961ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (10.243763ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:38:22→10/16 01:38:23
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3849ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (5557.609364ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 41351.352926

```

### Final · 2026-10-15T17:40:42.283300+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && npm test
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters


> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (10.851208ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (12.183737ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (4.4853ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (1.389255ms)
✔ regex lore is preserved but never executed and budgets visibly trim (0.93378ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (2.564204ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (504.975431ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (73.219375ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:39:13→10/16 01:39:14
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 178ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (6566.663448ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:39:21→10/16 01:39:22
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 224ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (5305.729763ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.228281ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.635096ms)
✔ message merge retains identity and detects a moving 200-row window (3.869704ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (4.754295ms)
✔ explicit native rejection is failed; lost transport remains unknown (1.636874ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.13896ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.027247ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.182451ms)
✔ vision projection is canonical, secret-free and checks every candidate (2.719991ms)
✔ image entry explains all unavailable states in priority order (0.37149ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.133666ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.652041ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.459612ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (48.722328ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.252127ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (5.577978ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (5.82908ms)
✔ vision routing rejects missing or disabled dedicated models (2.648793ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:39:29→10/16 01:39:30
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 153ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (6216.225327ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (25.241214ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (22.065657ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (13.302651ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:39:39→10/16 01:39:41
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 122ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (7113.373858ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (604.856598ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.843669ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (22.389564ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.35654ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (94.795503ms)
✔ QQ policy fails closed and renders message elements as inert text (6.116291ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 782cfac6-3f77-45f0-afd3-0fe15734d20c
[I] adapter connect to server: ws://127.0.0.1:43903/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:39:49→10/16 01:39:54
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 151ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[I] hds-interlude [群聊] 星禾 ◎ 收到群聊消息
    ├─ 群聊: •8888
    └─ 发送者: •7777
[I] hds-interlude ├─ ◎ 群聊消息准备进入主叙事
       ├─ 群聊: 88888
       ├─ 模式: mention-only
       ├─ 意愿: 0.000
       └─ 档位: off
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: 全局
       ├─ 时间段: 10/16 01:39:54→10/16 01:39:59
       └─ 到期计划: 0
[I] hds-interlude ├─ • 日程物化已滞后于今天，本地重物化锚定=2026-10-16
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 120ms
       ├─ 剧本文字: 15
       └─ 回复模式: group:immediate
[I] hds-interlude ├─ • 无参与者回合已重排 interaction 回复
       ├─ 原mode: immediate
       └─ 处理: 提升为群发
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: 782cfac6-3f77-45f0-afd3-0fe15734d20c
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=782cfac6-3f77-45f0-afd3-0fe15734d20c
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (11644.652546ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (36.033998ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (2.680149ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:04→10/16 01:40:06
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 224ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:06→10/16 01:40:16
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 53ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:16→10/16 01:40:17
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 141ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:47:17
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 1
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:17→10/16 01:40:22
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 61ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:22→10/16 01:40:24
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 66ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:40:25
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:40:25
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:24→10/16 01:40:25
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 35ms
    └─ 错误: 已达 24 小时后台模型预算；直接聊天仍可用
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: true
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ ↻ 跳过暂停参与者的到期计划
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 数量: 1
       └─ 取消重试: 0
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:24→10/16 01:40:26
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 76ms
    └─ 错误: All narrative providers failed. 原有模型连接 (attempt 1): HTTP 500 Internal Server Error：{}
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:24→10/16 01:40:26
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 37ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 04:11:26
       └─ 间隔: 151分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: mobile-local:local-role:local-user
    └─ 错误: fixture endpoint failure
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:26→10/16 01:40:26
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 39ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 04:17:26
       └─ 间隔: 157分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:26→10/16 01:40:27
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 201ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (23822.134846ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (8.536487ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:28→10/16 01:40:29
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3556ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (5237.663465ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:40:35→10/16 01:40:37
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 4028ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (6489.969273ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 92437.165932

```

### Final · 2026-10-15T17:43:25.303446+00:00

```sh
npm run typecheck && npm --prefix upstream/hds-interlude run typecheck && node scripts/patch-mobile-hds.mjs && npm test
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit


> koishi-plugin-hds-interlude@1.0.1-rc51 typecheck
> tsc -p tsconfig.json --noEmit --incremental false --composite false --noUnusedLocals --noUnusedParameters

Applied narrow local-channel, character-context and Preview 8.1 patches

> hds-android@0.1.0-preview.8 test
> npm run build:host && node --import tsx --test tests/*.test.ts


> hds-android@0.1.0-preview.8 build:host
> node scripts/build-mobile-host.mjs

Compiled actual HDS rc51 and mobile host from sources
✔ V2 JSON and PNG preserve Chinese, emoji and unknown extensions (18.186643ms)
✔ oversized fields rejected, unknown spec tolerated as V3, name truncated, legacy fields mapped (18.313022ms)
✔ PNG raw-text tEXt, wrapped base64, and zTXt compressed cards (6.888825ms)
✔ lore triggers against delivered history; creator notes and disabled lore stay out (2.214494ms)
✔ regex lore is preserved but never executed and budgets visibly trim (1.609785ms)
✔ duplicate chara blocks from successive tools: keep richest instead of rejecting (4.150558ms)
✔ guest probe exercises host imports, real filesystem I/O and child cwd without a model (716.574436ms)
✔ guest probe surfaces ENOSYS at cwd and does not invent a working directory (65.210983ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixed-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:41:59→10/16 01:42:00
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixed-fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 163ms
       ├─ 剧本文字: 56
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real Koishi/HDS/SQLite host persists inbound IDs, builds card context and rejects unauthenticated RPC (5096.015657ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: fixture/vision-fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:06→10/16 01:42:07
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=vision-fixture legacy-primary fixture
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 214ms
       ├─ 剧本文字: 29
       └─ 回复模式: immediate
[I] hds-interlude └─ → 新消息打断主角输入，停止发送后续分段
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ real HDS forwards native image input, retains attachment history and holds restored stories (4935.075249ms)
✔ local image store bounds attachments, prevents path access and deduplicates content (3.960965ms)
✔ attachment contract tolerates legacy JSON objects without treating arbitrary objects as image lists (2.930454ms)
✔ message merge retains identity and detects a moving 200-row window (4.47206ms)
✔ refresh coordinator shares reads, follows dirty mutations and isolates revisions (5.300725ms)
✔ explicit native rejection is failed; lost transport remains unknown (1.990396ms)
✔ mobile assignments drive the original HDS main, compaction, timeline and Alter routes (3.39191ms)
✔ legacy single connection retains all roles; empty assignments never silently route to another task (1.084999ms)
✔ official preset addresses agree with the embedded upstream HDS resolver (4.758799ms)
✔ vision projection is canonical, secret-free and checks every candidate (3.182538ms)
✔ image entry explains all unavailable states in priority order (0.416835ms)
✔ task board follows the main model and preserves an independent psychology model in HDS routing (4.53308ms)
✔ deleting the assigned provider repairs orphaned tasks without using disabled connections (0.712939ms)
✔ legacy multi-model task sets can be inherited without discarding backup providers (0.457204ms)
✔ typ0-style koishi YAML keeps native persona semantics and never persists connection secrets (49.132289ms)
✔ direct JSON, share envelopes and multiple HDS instances are recognized without choosing silently (1.167571ms)
✔ unsupported YAML constructs and oversized native fields fail without echoing secrets (5.053561ms)
✔ editing preserves Tavern extensions and HDS native fields while reflecting the current persona (5.640926ms)
✔ vision routing rejects missing or disabled dedicated models (2.475316ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 当前事件包含图片附件
       ├─ 数量: 1
       └─ 原生识图: 开启
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: writer/writer
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:14→10/16 01:42:15
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=writer writer writer
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 180ms
       ├─ 剧本文字: 19
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
✔ dedicated vision feeds observations to text narration; memory management respects story scope and confirmation (6839.785022ms)
✔ supported schema derives upstream defaults; master switch gates independent scheduling (20.303796ms)
✔ rolling budget persists across restart, clock rollback and concurrent manual work (3.413463ms)
✔ preset sync filters secrets and unsupported switches; rechecks remote revision (5.568937ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:23→10/16 01:42:24
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 99ms
       ├─ 剧本文字: 11
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
Applied narrow local-channel, character-context and Preview 8.1 patches
Applied narrow local-channel, character-context and Preview 8.1 patches
✔ real Koishi model requests stop at budget, retain quota after restart, and foreground chat still delivers (6067.452743ms)
✔ Preview 8.1 patch applies baseline fixtures, is idempotent and rejects unknown anchors (490.348537ms)
✔ Preview 8.1 thresholds keep defaults and independent explicit-contact settings (1.597699ms)
✔ Xauthority writes an authenticated wildcard record despite stale xauth locks (25.54007ms)
✔ optional HTTPS accelerator only wraps GitHub artifact URLs (1.397641ms)
✔ downloads report real bytes and enforce hashes, limits and cancellation (94.710956ms)
✔ QQ policy fails closed and renders message elements as inert text (4.740634ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[W] hds-interlude [系统] HDSI ! 角色端点已注册
    ├─ 故事: character:mobile-local:local-role
    ├─ 平台: onebot
    ├─ 账号: 55555
    └─ 端点: 73fb2dad-bde6-45f7-97a8-d0a3f9ad5c6f
[I] adapter connect to server: ws://127.0.0.1:39045/
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: onebot:•5555:•2345
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: onebot:55555:12345
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: onebot:55555:12345
       ├─ 时间段: 10/16 01:42:31→10/16 01:42:36
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 238ms
       ├─ 剧本文字: 15
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: onebot:55555:12345
[I] hds-interlude [群聊] 星禾 ◎ 收到群聊消息
    ├─ 群聊: •8888
    └─ 发送者: •7777
[I] hds-interlude ├─ ◎ 群聊消息准备进入主叙事
       ├─ 群聊: 88888
       ├─ 模式: mention-only
       ├─ 意愿: 0.000
       └─ 档位: off
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: 全局
       ├─ 时间段: 10/16 01:42:36→10/16 01:42:43
       └─ 到期计划: 0
[I] hds-interlude ├─ • 日程物化已滞后于今天，本地重物化锚定=2026-10-16
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 97ms
       ├─ 剧本文字: 15
       └─ 回复模式: group:immediate
[I] hds-interlude ├─ • 无参与者回合已重排 interaction 回复
       ├─ 原mode: immediate
       └─ 处理: 提升为群发
[W] hds-interlude [系统] HDSI ! 同一归属存在多个启用端点，出站地址按最近连接观测选取
    ├─ 归属: story-role:character:mobile-local:local-role
    └─ 选中: 73fb2dad-bde6-45f7-97a8-d0a3f9ad5c6f
[W] hds-interlude [系统] HDSI ! 出站地址以端点注册表为准（旧字段漂移）端点=73fb2dad-bde6-45f7-97a8-d0a3f9ad5c6f
    ├─ 注册: onebot/55555
    └─ 旧: mobile-local/local-role
✔ real OneBot adapter and HDS enforce whitelist, persist inbox and send literal text once (13150.613666ms)
✔ scheduled time grammar uses story timezone and rejects ambiguous or past times (33.509055ms)
✔ commitment bounds and delayed purpose enforce independent valid plans (3.365132ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:47→10/16 01:42:49
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 138ms
       ├─ 剧本文字: 27
       └─ 回复模式: delayed
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: delayed-reply
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:49→10/16 01:42:59
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 161ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:42:59→10/16 01:43:00
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 48ms
       ├─ 剧本文字: 31
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 01:50:00
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:00→10/16 01:43:05
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 90ms
       ├─ 剧本文字: 16
       └─ 回复模式: none
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 2
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:05→10/16 01:43:06
       └─ 到期计划: 0
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 93ms
       ├─ 剧本文字: 20
       └─ 回复模式: immediate
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:06→10/16 01:43:08
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 71ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:43:08
[I] hds-interlude ├─ • 已登记承诺回访
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 类型: scheduled-contact
       └─ 到期: 10/16 02:43:08
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:08→10/16 01:43:09
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 42ms
    └─ 错误: 已达 24 小时后台模型预算；直接聊天仍可用
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: true
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] hds-interlude ├─ ↻ 跳过暂停参与者的到期计划
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 数量: 1
       └─ 取消重试: 0
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:08→10/16 01:43:09
       └─ 到期计划: 1
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[E] hds-interlude [到期意图] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 69ms
    └─ 错误: All narrative providers failed. 原有模型连接 (attempt 1): HTTP 500 Internal Server Error：{}
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:08→10/16 01:43:09
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 55ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 05:38:09
       └─ 间隔: 235分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[E] hds-interlude [到期意图] 星禾 ✗ 消息投递失败
    ├─ 参与者: mobile-local:local-role:local-user
    └─ 错误: fixture endpoint failure
[I] hds-interlude ├─ • 即将处理到期计划
       ├─ 数量: 1
       ├─ 类型: follow-up-commitment
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:09→10/16 01:43:09
       └─ 到期计划: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 71ms
       ├─ 剧本文字: 24
       └─ 回复模式: immediate
[I] hds-interlude ├─ ⟳ 已设置下次自动推进
       ├─ 时间: 10/16 04:26:09
       └─ 间隔: 163分钟
[I] hds-interlude └─ ✓ 剧本推进完成
       └─ 可见消息: 1
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:09→10/16 01:43:11
       └─ 到期计划: 0
[W] hds-interlude ├─ ! 结构化可见回复缺失，已抛弃本次未落库剧本并重新写作
[E] hds-interlude [用户消息] 星禾 ✗ 模型调用失败
    ├─ 任务: 主叙事
    ├─ 阶段: narrative-provider
    ├─ 当前图片: 0
    ├─ 历史图片: 0
    ├─ 音频: 0
    ├─ 耗时: 196ms
    └─ 错误: scheduled-contact: ambiguous-time
[W] hds-interlude [自动重试] HDSI ↻ 叙事模型请求失败，已安排自动重试
    ├─ 故事: character:mobile-local:local-role
    ├─ 参与者: mobile-local:local-role:local-user
    ├─ 次数: 1/6
    └─ 等待: 60秒
✔ real 10-second due timer delivers without another user message while autoAdvance is off (24360.896265ms)
✔ cancelling ordinary plans preserves explicit delayed contact and its next wake (18.603434ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:11→10/16 01:43:13
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 3881ms
       ├─ 剧本文字: 22
       └─ 回复模式: 未提供或无效
✔ experimental SSE exposes an early invalid confirmation as unregistered without a duplicate reply (5694.185655ms)
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
[I] sqlite auto creating table user
[I] sqlite auto creating table binding
[I] sqlite auto creating table channel
[I] sqlite auto creating table mobile_message
[I] sqlite auto creating table mobile_request
[I] sqlite auto creating table interlude_story
[I] sqlite auto creating table interlude_participant
[I] sqlite auto creating table interlude_script_entry
[I] sqlite auto creating table interlude_memory
[I] sqlite auto creating table interlude_intent
[I] sqlite auto creating table interlude_scene
[I] sqlite auto creating table interlude_arc
[I] sqlite auto creating table interlude_fact
[I] sqlite auto creating table interlude_state_patch
[I] sqlite auto creating table interlude_web_observation
[I] sqlite auto creating table interlude_overlay_snapshot
[I] sqlite auto creating table interlude_sticker
[I] sqlite auto creating table interlude_schedule_preplan
[I] sqlite auto creating table interlude_seeded_event
[I] sqlite auto creating table interlude_qzone_post
[I] sqlite auto creating table interlude_endpoint
[I] sqlite auto creating table interlude_endpoint_state
[I] sqlite auto creating table interlude_story_alias
[I] sqlite auto creating table interlude_work
[I] sqlite auto creating table interlude_long_arc_guidance
[I] sqlite auto creating table interlude_long_arc_progress
[I] hds-interlude [用户消息] 星禾 ← 收到参与者私聊消息
    └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude ├─ ← 用户回合已入队
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 已取消旧计划: 0
[I] hds-interlude [记忆整理] HDSI ◈ 后台调度已启动
    ├─ 剧本扫描: 5分钟
    └─ 记忆扫描: 10分钟
[I] hds-interlude ├─ ⋯ 模型调用开始
       ├─ 任务: 主叙事
       ├─ 模型: 原有模型连接/fixture
       ├─ 参与者: mobile-local:local-role:local-user
       ├─ 时间段: 10/16 01:43:20→10/16 01:43:21
       └─ 到期计划: 0
[I] hds-interlude 模型特化已切换 档位=full 家族=generic 来源=manual 探测=fixture legacy-primary 原有模型连接
[I] hds-interlude └─ → 消息投递开始
       └─ 参与者: mobile-local:local-role:local-user
[I] hds-interlude └─ → 实验性流式首条回复已提前投递
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude ├─ ✓ 模型调用完成
       ├─ 任务: 主叙事
       ├─ 耗时: 2699ms
       ├─ 剧本文字: 53
       └─ 回复模式: immediate
[I] hds-interlude ├─ • 已丢弃过期主模型结果
       ├─ 参与者: mobile-local:local-role:local-user
       └─ 请求: 1
[I] hds-interlude plugin load started version=1.0.1-rc51
[I] hds-interlude [系统] HDSI ✓ 服务初始化完成
    ├─ 主叙事路由: 已配置
    ├─ 共享主剧本: true
    └─ 自动推进: false
[I] hds-interlude plugin load completed
[I] hds-interlude [系统] HDSI ✓ 服务已就绪
✔ native persona reaches real HDS; SSE delivers once before completion; edited persona keeps SQLite history (5287.898281ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 90203.7137

```

### Final · 2026-10-15T17:43:57.754701+00:00

```sh
node --import tsx --test upstream/hds-interlude/test/follow-up-commitment.test.ts upstream/hds-interlude/test/scheduler.test.ts upstream/hds-interlude/test/delivery-ledger.test.ts upstream/hds-interlude/test/time-context.test.ts upstream/hds-interlude/test/logging.test.ts
```

退出码：`0`

```text
✔ partial requires actual delivery, while unfinished attempts remain pending (2.265323ms)
✔ ledger read and write failures do not interrupt confirmation or remaining bubble scheduling (8.898614ms)
✔ M6 ledger groups text and platform segments under their script event identities (2.254001ms)
✔ M6 ledger reports partial and terminal delivery without downgrading delivered speech (1.167771ms)
✔ cancelled is terminal: later bookkeeping cannot revive a withdrawn action (0.987536ms)
✔ returning to pending for a retry clears the previous completion timestamp (0.931619ms)
✔ a successful retry clears an earlier transport failure reason (1.154877ms)
✔ M6 persistence changes metadata only and delivery preserves exact bubble text and source row (1.434591ms)
✔ platform references resolve the exact action segment and reject absent actions (2.410626ms)
✔ follow-up commitment instructions are limited to live and due turns (3.319182ms)
✔ only live and due prompt payloads carry the bounded commitment list (39.528621ms)
✔ scheduled policy and fixed local time survive both compiled prompt orders (2.768287ms)
✔ user-message logs read as a compact task timeline (9.093271ms)
✔ Alter and error records use stable semantic markers (0.696767ms)
✔ colors can be enabled and kaomoji can be replaced by simple symbols (0.612232ms)
✔ dark and light themes use separate high-contrast 256-color palettes (0.717629ms)
✔ Agency decisions have a distinct subjectivity marker (0.580937ms)
✔ scheduleWake keeps the earliest wake and cancels a later existing one (23.606708ms)
✔ wake fire returning busy rearms after retryDelayMs and retries (5.31761ms)
✔ wake fire throwing reports to onWakeError without rearm (4.707113ms)
✔ cancelWake cancels a single story; cancelWakes filters by story (1.312414ms)
✔ scheduleExclusive dedupes, defers while busy, and releases after completion (7.363913ms)
✔ scheduleExclusive halted releases the gate without running the task (0.971136ms)
✔ scheduleExclusive task failure reports to onTaskError and still releases (5.75836ms)
✔ backoff gates by fingerprint and expires into deletion (5.16162ms)
✔ 16:00 in Shanghai is an authoritative daylight afternoon (44.03477ms)
✔ long intervals expose both endpoint clocks and continuity age (2.795065ms)
✔ reload-style ISO timestamp rows are materialized as Date objects (1.918624ms)
✔ timezone formatters are reused instead of rebuilt on every turn (5.576647ms)
✔ recentScript payload carries derived ownership without changing stored entries (1.496028ms)
✔ timeline display uses the story timezone and prints its GMT offset (0.367141ms)
✔ explicit user-reported clocks stay distinct from the message receive time (3.717301ms)
✔ prompt payload keeps receive time and user-reported action time as separate fields (1.284617ms)
✔ short live windows reject explicit future clocks and multiple completed lesson stages (2.111492ms)
✔ midnight wraparound and latency grace do not drop legitimate live scripts (1.298777ms)
✔ the current user message remains both a durable event and the explicit currentEvent (0.80087ms)
✔ background Agency payload includes relationship identity but not raw chat history (0.732364ms)
✔ headline-window semantics: narrative declarations block, references and user deadlines pass (2.223242ms)
✔ user-endorsed clocks from the message exempt the guard while unendorsed ones stay blocked (1.094102ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4358.053511

```

### Final · 2026-10-15T17:44:39.116233+00:00

```sh
HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome HDS_UI_URL=http://127.0.0.1:5173 npm run test:ui
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 test:ui
> node tests/story-ui.mjs

PASS Preview 8.1: an accepted history receipt resolves an unknown send without resend.
PASS Preview 8.1: timeline/memory/mind tab reading positions.
PASS Preview 8.1: row identity, 200-row moving window, new-message badge, chat reading restoration and textarea grow/shrink.
PASS: wake/progress/focus, settings accordions, persisted file backgrounds and reload/cache, text replies with legacy image objects, explicit light/dark logs, pure-image preview/send, memory source/add/forget, archive confirmation, autosave race/retry, restart, role switch and 320/390/740 px light/dark layouts. Native calls are fixtures, not device verification.

```

### Final · 2026-10-15T17:45:52.929763+00:00

```sh
npm run android:sync && node /tmp/hds81-versions.mjs && sha256sum runtime/generated/host.cjs packages/contracts/mobile-config.schema.json android/app/src/main/assets/mobile-config.schema.json && git diff --check
```

退出码：`0`

```text

> hds-android@0.1.0-preview.8 android:sync
> npm run build && cap sync android


> hds-android@0.1.0-preview.8 build
> npm run typecheck && vite build


> hds-android@0.1.0-preview.8 typecheck
> tsc --noEmit

vite v6.0.7 building for production...
transforming...
✓ 117 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.32 kB
dist/assets/index-IO3TJGrd.css   31.20 kB │ gzip:   7.28 kB
dist/assets/index-CsJK2wE2.js   344.53 kB │ gzip: 118.63 kB
✓ built in 4.18s
✔ Copying web assets from dist to android/app/src/main/assets/public in 50.23ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 2.62ms
✔ copy android in 150.12ms
✔ Updating Android plugins in 7.73ms
✔ update android in 91.61ms
[info] Sync finished in 0.283s
{"package":"0.1.0-preview.8","lock":"0.1.0-preview.8","lockRoot":"0.1.0-preview.8","androidVersionName":"0.1.0-preview.8","androidVersionCode":16}
8445b4a6764f05db0a37f18e65f590831a5c5fece1b3f92a82d2f87a037f7983  runtime/generated/host.cjs
db2864a09181dc1489a35f235659dadd6de88551f2ea5f9bcd142705da490038  packages/contracts/mobile-config.schema.json
db2864a09181dc1489a35f235659dadd6de88551f2ea5f9bcd142705da490038  android/app/src/main/assets/mobile-config.schema.json

```

</details>
