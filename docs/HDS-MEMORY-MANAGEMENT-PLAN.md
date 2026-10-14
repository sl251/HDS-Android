# HDS Android 记忆与故事管理补齐方案

调研日期：2026-10-14。本文是源码对照与实施方案，本次未修改 App 功能、未清理用户数据，也未运行手机上的清库操作。

## 1. 结论与版本范围

**App 已经包含原版记忆引擎，主要缺少手机端的管理入口、完整备份和重开流程。** 不需要另写一套记忆系统；应将原版服务能力接入 Android 桥接与界面，同时补齐 App 自己保存的数据。

本次对照的版本：

| 对象 | 版本 / 提交 | 说明 |
| --- | --- | --- |
| 原版 HDS-Interlude 的 GitHub master | rc51 / `cfb24868d5025e25ff22f0ee2713b4cf157582a2` | 查询时的远端 HEAD |
| App 内嵌原版基线 | rc51 / `9a77fadb88c6e57914ebac8ca75cf54a27354d01` | `.references/HDS-Interlude` 与 `docs/MOBILE-PATCHES.md` 对齐 |
| HDS-Android 的 GitHub main | `3b184de56e606bb6e2965eb2a81acc0a6da0fc46` | 公开默认分支，preview.5.4 |
| 当前本地 App | preview.6 / `8fc9b20a1152cd35a78afcdde9e3c85a438e92d2` | 对应远端 `codex/story-experience`，比公开默认分支更新 |

原版远端比内嵌基线多两个提交，差异主要是构建产物、构建脚本和文档。通过 GitHub tree 与本地 `git ls-tree` 对比，`src/service.ts`、`src/index.ts`、`src/database.ts` 的原版 blob SHA 相同。因此，本次讨论的清理机制不属于“App 因为原版版本太旧而缺失”。App 对这些源码另有窄范围移动端补丁。

证据入口：

- [原版命令文档](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/blob/cfb24868d5025e25ff22f0ee2713b4cf157582a2/command.md)
- [原版服务实现](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/blob/cfb24868d5025e25ff22f0ee2713b4cf157582a2/src/service.ts)
- [原版命令注册](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/blob/cfb24868d5025e25ff22f0ee2713b4cf157582a2/src/index.ts)
- [公开 App 宿主](https://github.com/sl251/HDS-Android/blob/3b184de56e606bb6e2965eb2a81acc0a6da0fc46/runtime/host.ts)
- [preview.6 宿主](https://github.com/sl251/HDS-Android/blob/8fc9b20a1152cd35a78afcdde9e3c85a438e92d2/runtime/host.ts)

## 2. 原版记忆如何工作

记忆并非一张聊天表。主要有以下层次：

| 层次 | 持久化位置 | 用途 |
| --- | --- | --- |
| 基础人设与世界设定 Canon | `interlude_story.setting`，初始值来自 `storyDefaults` | 决定角色身份、世界、初始关系与文风 |
| 原始经历 | `interlude_script_entry` | 保存用户消息、真实送达的角色消息、剧情与管理员注记；提供近期上下文及历史召回 |
| 场景 / 剧情弧摘要 | `interlude_scene`、`interlude_arc` | 压缩长剧情、维持连续性 |
| 普通记忆摘要 | `interlude_memory` | 以类别、重要度保存耐久记忆，可以关联参与者 |
| 长期事实 | `interlude_fact` | 人物、世界、关系、事件、承诺等结构化事实；有效状态为 `active` |
| 未来事项 | `interlude_intent` | 提醒、承诺、延迟回复与剧情余波；属于未来可能性，不等于已经发生 |
| 设定演化 | `interlude_state_patch`、`story.state.settingOverlay`、参与者关系 overlay、`interlude_overlay_snapshot` | 审核与沉淀性格、价值观、关系和世界的变化 |
| 运行状态 | `story.state`、参与者状态、日程及长线记录 | 连续性快照、临时细节、情绪偏移、生活状态、调度等 |

每轮写作通过原版上下文编译与检索流程读取这些材料。删除其中一条事实，不会自动抹掉原文、场景摘要、人设中的同一信息。

后台整理已在 App 中存在：`runtime/host.ts` 使用 `HDS.Config(...)` 创建原版服务，没有关闭默认的 `memory` 或 `model.compaction`。原版默认开启记忆整理，未压缩条目达到 **16 条或 10000 字符** 时可触发压缩，并有默认 **10 分钟** 的后台检查。对话完成也会调度整理，后台任务会给正在进行的叙事让路。这里的“条目”不等于 16 轮对话。

App 的 `autoAdvance=false` 关闭自动生活推进与主动联系，没有同时关闭记忆压缩。记忆仍受运行进程存活、故事状态、模型可用性和整理阈值影响。长期记忆暂时为空，不能直接判断为没有记忆引擎。

## 3. 原版的清理与修正是分开的

| 原版命令 | 对应服务 | 实际语义 |
| --- | --- | --- |
| `interlude.memory.add` | `addAdminFact` | 添加高置信度事实；关系事实必须写清具体人物 |
| `interlude.memory.forget` | `forgetAdminFact` | 将指定事实从 `active` 改为 `superseded`，保留记录供审计；事实查询不再选择该行 |
| `interlude.script.note` | `addAdminScriptNote` | 写入有管理员来源的剧情修正，后续整理会读取 |
| `interlude.memory.cancel` | `cancelAdminIntent` | 将待处理意图改为 `cancelled` |
| `interlude.memory.apply/reject` | `applyAdminStatePatch` / `rejectAdminStatePatch` | 批准或拒绝待审核的演化提案 |
| `interlude.overlay.clear` | `clearSettingOverlay` | 清理指定演化层；使相关待审核/已应用/已压缩提案与活动快照失效，关系清理还处理参与者 overlay；保留剧本与记忆 |
| `interlude.compact` | `compactStory` | 执行整理，不是删除记忆；可能调用模型产生费用 |
| `interlude.timeline.rebase` | `rebaseTimeline` | 将游标移到当前时间，清理部分临时连续性状态，保留历史并写审计条目；不是恢复某个历史存档 |
| `interlude.purge.range` | `purgeStoryRange` | 删除指定时间范围的原文及匹配关联记录，处理重叠场景、意图、提案等；不回退故事时间游标 |
| `interlude.purge.all` | `purgeAllData` / `purgeAllStoryData` | 清理故事经历和派生层，以当前模板重建设定、空运行状态与参与者关系，保留一个空白主剧本 |
| `interlude.database.clear` | `clearDatabase` | 清理实现中明确枚举的 HDS 表，阻止部分在途旧任务写回并清理历史向量缓存；不删除其它插件表或物理 SQLite 文件 |

原版的批量删除、overlay 清理等命令有执行前预览或 y/n 确认。物理删除失败时，部分路径会退化为逻辑失效与正文清空。它们是应用级清理，不能理解为设备介质上的安全擦除。

需要避免两种错误承诺：

1. **“遗忘事实 = 彻底忘记此事”不成立。** `forgetAdminFact` 只修改事实行状态；原文和摘要仍可让模型想起，后续整理也可能重新生成类似事实。建议按钮叫“停用这条事实”，明确说明保留来源经历。
2. **“删除某段经历 = 回到事情发生前”不成立。** `purgeStoryRange` 最后补齐活动场景，但不整体恢复先前的 `story.state`、参与者状态或所有 overlay 归档。涉及回滚剧情，需要完整存档；需要完全清理，需要更广的重置流程。

还有两个源码边界应作为实施时的回归项：

- `clearDatabase` 的表清单没有覆盖所有已注册表，例如端点、别名、作品和 Qzone 记录。因此不应对外宣称“删除所有 HDS 数据”。当前 App 关闭 Qzone，但跨通道端点确实在使用。
- 原版 `interlude.reset` 依次调用 `clearDatabase()` 与 `purgeAllStoryData(story.id)`；前者正常删除故事行时，后者会通过 `getStory()` 读取已删除故事而抛错。此项是静态源码发现，未做运行复现；App 不应直接照搬该命令调用顺序。

## 4. App 目前缺在哪里

本地关键证据：

- `runtime/host.ts:26` 注册独立的 `mobile_message` 和 `mobile_request` 表。
- `runtime/host.ts:77` 在启动时缓存当前故事对象；重建故事后必须更新引用或重启宿主。
- `runtime/host.ts:78` 保存 `card-revision.json`；开场白还有 `card-opening-v1` 幂等标记。
- `runtime/host.ts:101` 起的 dispatch，故事相关接口只有快照、暂停/恢复和发消息等，没有管理接口。
- `android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt:345` 再次限制 RPC 白名单；只改 Node 宿主不能让手机调用新增功能。
- `apps/mobile-ui/main.tsx:224` 起的见闻页是只读列表，只有刷新与暂停/恢复，没有事实修正、整理或重置入口。
- `HdsStore.kt:154` 的删除角色只是软删除角色库条目；剧情目录与原始卡保留，相同原文件再次导入可以恢复。
- `HdsStore.kt:171` 起按角色卡 ID 使用独立 profile，所以当前角色重置应限制在该 profile。
- `runtime/qq.ts:58` 将白名单保存在角色 profile 的 `qq-policy.json`；`qq.ts:104` 将信箱保存在公共 QQ 目录的 `inbox-{账号}.json`，不属于该角色专用数据库。

| 能力 | 当前本地状态 | 判断 |
| --- | --- | --- |
| 原文记录、后台整理、长期事实、历史召回 | 引擎已有 | 不应重写 |
| 查看故事、事实、普通记忆与部分心绪 | 已有，但条数固定且信息简化 | 应补分页、来源、状态与整理状态 |
| 单条事实停用、手动补充事实 | 未接到 App | 优先补 |
| 手动整理记忆 | 未接到 App | 优先补 |
| 取消提醒/延迟回复 | 原版已有，App 未接 | 第二阶段 |
| 演化提案批准/拒绝、清除演化 | 原版已有，App 未接 | 第二阶段 |
| 当前角色重开、完整存档导出/恢复 | 缺少完整工作流 | 优先补 |
| 按时间段删除、回到存档 | 缺少入口及完整一致性方案 | 后置 |
| 高级节奏、日程、行动窗口与可选扩展 | 部分沿用默认，部分关闭或无界面 | 单独评估，不等于记忆功能缺失 |

尤其不能用“删除角色后重新导入”代替重开，也不能只删 `mobile_message` 或只调用 `clearDatabase`：前者会保留引擎记忆，后者会保留 App 的旧聊天展示和请求幂等记录。

## 5. 推荐产品方案

### 第一阶段：先让用户能维护记忆和重开

见闻 → 长期记忆：区分“长期事实”和“经历摘要”；事实显示类型、重要度、置信度、来源与有效状态。提供“补充事实”“停用事实”“立即整理”。不能把普通记忆摘要 ID 传给事实停用接口。

整理过程显示排队、整理中、完成、无可整理内容、失败。模型调用可能收费，结果不可用成功提示掩盖；现在的列表上限也不应被表述为数据库总量。

空间 → 当前故事管理：提供“导出完整存档”“恢复存档”“从当前人设重新开始”。删除角色保持现有语义，并继续说明它保留故事。

重开预览应显示角色名、当前基础人设来源、经历与事实数量、待处理事项数量，以及将保留模型配置、角色卡和 QQ 登录。用户确认后，操作范围限定当前角色的完整故事，包含该角色通过 QQ 产生的 HDS 剧情。

重开后保留旧存档作为可恢复备份，但明确标注“旧内容仍在备份中”。提供单独的备份删除入口，避免用户误认为旧内容已从手机完全删除。QQ 公共信箱记录独立管理，不随当前角色重置自动清空。

### 第二阶段：补齐原版管理能力

- “未来事项”：列出意图、到期时间与状态，允许取消。
- “角色变化”：展示稳定演化及证据，批准/拒绝提案，按性格、价值观、关系、世界或全部清理演化层。
- “日程”：查看日程与重新审查；此操作可能调用模型。
- “故事修正”：添加管理员注记；出现时间游标污染时提供高级的重新对齐当前时间操作。
- “运行说明”：展示记忆整理最后成功时间、待整理量与失败原因，并区分生活推进、记忆整理、日程审查、Alter 等开关和调用来源。

### 第三阶段：精确删除与多存档

加入按时间段删除、多个可命名存档，以及同一卡创建多条独立故事。彻底排除某件事，需要追踪原文、摘要、事实、演化、连续性状态及召回缓存的来源，并定义是否允许未来新消息重新记住；不建议首版用关键词删库实现。

## 6. 推荐技术实现

### 6.1 小粒度管理复用服务，长操作使用任务接口

建议接口命名（以下均是待新增，不是现有 API）：

| 接口 | 实现方向 |
| --- | --- |
| `memory.facts.list` | 分页、状态过滤和来源查询；沿用原版事实表语义 |
| `memory.facts.add` | `addAdminFact` |
| `memory.facts.forget` | `forgetAdminFact`，返回停用结果而非彻底遗忘承诺 |
| `story.maintenance.start` / `story.maintenance.status` | 任务类型包含 compact、overlay-clear 等；返回 operationId 后轮询 |
| `memory.intents.list/cancel` | `adminPendingIntents` / `cancelAdminIntent` |
| `memory.patches.list/apply/reject` | 原版对应管理服务 |
| `story.overlay.status` | `adminOverlayStatus` |
| 原生 `backup/export/restore/reset` | Android 负责停机、文件操作、恢复和重新启动，避免由要被停止的 Node 进程拥有整个操作 |

同步更新 TypeScript 合同、Kotlin 白名单、Node dispatch、界面。调用方只指定当前角色与合法参数，服务端复核范围、记录归属及操作 ID，不接受任意路径、SQL 或整段 Koishi 命令。所有维护写操作与叙事、压缩共用受控的故事维护流程；单条原版函数本身未必提供完整的并发屏障，需要封装后再开放。

当前 Android RPC 读取超时只有 **20 秒**，而模型整理及原版清库等待可能更久。不能直接将长操作挂在这个同步 RPC 上。任务需记录最终结果、支持重复查询与 requestId 去重；客户端超时后查询旧任务，避免再次触发删除或付费模型调用。

普通浏览页面按需分页；完整备份通过 Android 文档写入流导出，不塞进现有 RPC 的 4 MiB 响应限制。鉴权继续沿用本机 loopback 与 Bearer token。

### 6.2 首版全量重开建议采用停机后的 profile 备份与替换

当前“一张卡一个 profile”的边界明确，使用新空 profile 比逐表清空更容易做到完整，也能避免遗漏未来增加的表。

建议顺序：

1. 在原生层创建可恢复操作清单，锁定目标 cardId 与 operationId；将角色置于维护中，拒绝本地发消息、QQ 自动入站与自动发送，防止重复唤醒。
2. 停止 QQ 通道并请求 HDS 排空任务、关闭数据库。必须获得干净关闭确认；现有 `stopBlocking()` 超时后会强制终止，因此还需区分“正常保存后关闭”和“强制退出”，不能把两者都作为可导出一致存档的成功状态。
3. 检查目标在应用角色数据目录内，将当前 profile 在同一文件系统移动到受管理备份目录。该步骤发生在无写者时，备份包含完整数据库与 profile 附属文件。
4. 创建新的同角色 profile，只按明确允许清单复制该角色的 `qq-policy.json` 等保留配置。不复制旧 `hds.sqlite`、`card-revision.json`、预设同步状态或消息请求记录。
5. 用已保存的当前角色卡与用户设定启动新宿主；重新创建故事、参与者、端点、初始事实和一次开场白。核心启动早期保持维护门，完成健康与数据校验后才放行调度和通道。
6. 清空前端旧消息、故事快照与 pending request，绑定新的故事代次；让旧响应无法覆盖新页面。恢复操作前的运行意愿：原本停止则保持停止，原本运行则在校验后恢复。
7. 在操作清单写成功；如果创建或启动失败，停止新进程，恢复原 profile 并报告“未重开，旧故事已恢复”。崩溃后依据清单恢复，不能只在 UI 的 catch 中处理回滚。

模型密钥在全局加密设置中，角色卡在角色库，QQ 组件和登录在公共 QQ 目录，均不在重开目标内。旧 profile 备份可能包含历史隐私信息，应给出明确的保留/删除选项。

如后续要求同一卡多故事，可演进到 `profiles/{cardId}/{storyInstanceId}` 加当前指针；首版无需为了重开先改造所有故事寻址。

### 6.3 完整存档的边界

至少包含：格式版本、App/HDS 版本、cardId、校验和、完整 SQLite、当前角色卡及原始来源文件、profile 附属状态、角色 QQ 白名单。恢复前停机、校验包和数据库兼容性；ZIP 解包拒绝越界路径。

默认不导出 API Key、QQ 登录 token 或公共 QQ 信箱。恢复故事不会撤回已经发到真实 QQ 的消息，也不自动重发存档中的历史投递；恢复完成前保留发送门，检查未完成意图与投递状态，再按明确策略启用。

备份、恢复和重开都记录实际完成阶段；导出成功必须以文件写入和校验完成为准。原版命令中的查询输出或截图不等于可恢复存档。

## 7. 实施文件与验收

主要修改：`runtime/host.ts`；`packages/contracts/index.ts`；`HdsRuntime.kt`、`HdsRuntimePlugin.kt`、`HdsStore.kt`；`apps/mobile-ui/main.tsx`，并抽出记忆管理、故事管理组件。若维护屏障需要扩展核心，保持窄补丁并更新 `scripts/patch-mobile-hds.mjs` 与 `docs/MOBILE-PATCHES.md`，避免重新 vendor 后消失。

必须验证的数据行为：

1. 停用事实后，事实检索不再选择该行，审计仍能看到；来源经历仍在的语义符合界面说明。
2. 新增事实属于正确故事；不存在的 ID、普通摘要 ID、别的角色 ID 不允许误操作。
3. 清除 overlay 后，旧待审核提案和旧快照不能立即恢复该演化；剧情与普通记忆保留。
4. 重开后本地旧聊天、事实、摘要、意图、情绪、关系演化、日程和历史召回均不进入新故事；开场白恰好一次，当前人设与用户身份正确。
5. 模型配置、角色卡、QQ 登录与其他角色历史保留；公共 QQ 信箱是否保留与说明一致。
6. 在主叙事、压缩、QQ 入站或发送进行中触发维护，旧结果不能污染新 profile；已经送达真实 QQ 的消息不承诺撤回。
7. 停机失败、备份空间不足、创建失败、启动失败、进程被杀与客户端超时均可恢复、可查询，不重复清理或重复调用模型。
8. 导出后恢复，原文、事实、状态与卡修订一致；恢复不会偷偷发送过期回复。
9. 对真实模型请求体检查旧标记是否进入新上下文，不能只看页面是否清空。

实施后运行适用的宿主集成测试、类型检查与生产构建，并在 Android 真机验证文件导出、停止/重启、系统杀进程恢复和 QQ 通道。本文仅作静态分析，尚未对这些新功能做运行验收。

推荐交付顺序：**第一批完成事实管理、手动整理、完整存档与当前角色重开；第二批接入待办、演化和日程管理；第三批做精确删除及多故事。**
