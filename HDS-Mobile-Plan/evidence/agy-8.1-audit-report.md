# agy 只读核查报告（Preview 8 证据链）

> 由 agy（gemini-3.8-flash-high, plan 只读模式）产出，主代理落盘。

根据对项目目录下 `HDS-Mobile-Plan/TASK-BOARD.csv`、`HDS-Mobile-Plan/08-PARITY-PREVIEW8.md`、`docs/PREVIEW8.md` 以及 `docs/TEST-ON-PHONE.md` 四个核心文件的逐行通读核对，以下为三份完整清单：

---

### 清单一：看板中 DONE / IN_PROGRESS 条目的证据文件核实清单

在 `HDS-Mobile-Plan/TASK-BOARD.csv` 中，共有 13 项处于 `DONE` 或 `IN_PROGRESS` 状态。对其在 `docs/` 或 `HDS-Mobile-Plan/` 下的证据文档核验如下：

#### 1. 存在真实对应证据文档的条目
- **T01（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:2](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L2)
  - 对应证据：[docs/evidence/T01/baseline.md](file:///root/hermes-workspace/hds-android/docs/evidence/T01/baseline.md#L1-L40)、[docs/evidence/T01/toolchain.lock.json](file:///root/hermes-workspace/hds-android/docs/evidence/T01/toolchain.lock.json#L1-L48)、[docs/feature-parity.csv](file:///root/hermes-workspace/hds-android/docs/feature-parity.csv#L1-L71)、[docs/license-inventory.csv](file:///root/hermes-workspace/hds-android/docs/license-inventory.csv#L1-L13)、[HDS-Mobile-Plan/sources.lock.json](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/sources.lock.json#L1-L66)，文件均真实存在且内容完整。
- **T03（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:4](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L4)
  - 对应证据：[docs/QQ-ROADMAP.md](file:///root/hermes-workspace/hds-android/docs/QQ-ROADMAP.md#L1-L46)、[docs/QQ-PREVIEW5-FEEDBACK.md](file:///root/hermes-workspace/hds-android/docs/QQ-PREVIEW5-FEEDBACK.md#L1-L66)、[docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L1-L42) 均真实存在。
- **T07（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:8](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L8)
  - 对应证据：[docs/MOBILE-PATCHES.md](file:///root/hermes-workspace/hds-android/docs/MOBILE-PATCHES.md#L1-L22) 真实存在并记录了角色卡格式与边界。
- **T09（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:10](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L10)
  - 对应证据：[docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L5-L12) 包含 UI 设置与交互描述。
- **T10（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:11](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L11)
  - 对应证据：[docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L27) 与 [docs/QQ-ROADMAP.md](file:///root/hermes-workspace/hds-android/docs/QQ-ROADMAP.md#L1-L46) 均存在。
- **T12（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:13](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L13)
  - 对应证据：[docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L7-L12) 与 [docs/feature-parity.csv](file:///root/hermes-workspace/hds-android/docs/feature-parity.csv#L1-L71) 均存在。
- **T13（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:14](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L14)
  - 对应证据：[docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L13-L20) 与 [HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md#L1-L231) 均存在。
- **T14（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:15](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L15)
  - 对应证据：[docs/PREVIEW7.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW7.md#L24-L28) 与 [docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L41) 均存在。
- **T15（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:16](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L16)
  - 对应证据：[docs/evidence/preview8/release.md](file:///root/hermes-workspace/hds-android/docs/evidence/preview8/release.md#L1-L20) 真实存在且记录了完整发布校验。

#### 2. 无任何真实证据文件或证据路径无效的条目
- **T06（DONE）**：[HDS-Mobile-Plan/TASK-BOARD.csv:7](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L7)
  - **证据缺失**：`evidence` 字段所填内容为 `tests/host.test.ts; tests/image-chat.test.ts; tests/preview7.test.ts; tests/preview8.test.ts; scripts/patch-mobile-hds.mjs`。在 `docs/` 或 `HDS-Mobile-Plan/` 目录下**没有任何对应的交付文档或验证报告**，全为测试脚本代码。缺少 [HDS-Mobile-Plan/04-TASKS.md:63](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/04-TASKS.md#L63) 明确要求的 `upstream-patches.md` 交付文档。
- **T08（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:9](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L9)
  - **证据缺失**：`evidence` 字段所填内容为 `tests/card-format.test.ts（lore 触发/预算裁剪）; tests/model-tasks.test.ts`。在 `docs/` 或 `HDS-Mobile-Plan/` 下**没有任何文档证据**，且第一项带有中文括号注释并非纯路径。缺少 [HDS-Mobile-Plan/04-TASKS.md:77](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/04-TASKS.md#L77) 要求的映射说明、PromptTrace、差分与真实 API 观察报告。
- **T05（IN_PROGRESS）**：[HDS-Mobile-Plan/TASK-BOARD.csv:6](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L6)
  - **路径非真实文件**：`evidence` 字段列出的 `docs/evidence/preview3` 与 `docs/evidence/preview4` 为**目录路径而非具体证据文件**，且两目录下均无独立 Markdown 验证报告文件；`tests/` 亦为目录；所附 [docs/CHANGELOG.md](file:///root/hermes-workspace/hds-android/docs/CHANGELOG.md#L22-L46) 仅为发版更新说明，非 T05 阶段交付证据。
- **T04（DONE）**：[HDS-Mobile-Plan/TASK-BOARD.csv:5](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L5)
  - **缺乏独立证据归档**：`evidence` 字段主要引用代码目录 `android/`、`packages/contracts/` 及工作流 `.github/workflows/android-preview.yml`，在 `docs/evidence/` 下没有 T04 专属交付与复验报告，仅侧面挂靠通用说明 [docs/PREVIEW8.md](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L23)。

---

### 清单二：08-PARITY-PREVIEW8.md 与 TASK-BOARD.csv 对 preview8 范围描述的矛盾点

1. **Urge / Agency / 调度配置的“已完成”与“待实施草案”口径矛盾**：
   - [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:14](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L14) 明确标注：*“本草案可作为分阶段任务书，不能原样当作全部已验证的方案”*；在 [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:70-75](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L70-L75) 中明确认定 `urge`、`agency` 当前在移动端是 `❌ 缺失 / 关 ← 体感差距主因`，属于待实施的 `P0-1` 任务（行 97-104）。
   - 但在 [HDS-Mobile-Plan/TASK-BOARD.csv:13](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L13) 的 T12 描述中，却直接声称 *“8 分区 42 字段、手动预设同步、Alter 参数已完成”*，将 Urge/Agency 归入已完成 8 分区；而在真实测试与上游映射中，Urge/Agency 尚未进行真机验证（08 文档行 187 标注仍为“未核实项”）。
2. **presetSync 分区支持数量互相矛盾**：
   - [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:17](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L17) 明确更正：*“`presetSync.sections` / `SHARE_SECTIONS` 实际为 17 个分区，不是正文所称 18 个”*。
   - 但在同一份文档的后文 [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:107](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L107) 仍然表述为：*“`presetSync.sections` 可选 18 个分区（src/index.ts:577）”*，文档内部前后冲突。
   - [HDS-Mobile-Plan/TASK-BOARD.csv:13](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L13) 则将该范围混写为 *“8 分区 42 字段、手动预设同步”*，未澄清移动端支持表单的 8 分区与预设同步支持的 17 分区之间的定义差别。
3. **QQ 引用回复与表达层（chatActions）的阶段与任务归属矛盾**：
   - 在 [HDS-Mobile-Plan/TASK-BOARD.csv:4](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L4)（T03）中记录：*“群引用已走真实 OneBot 适配器 + 本地服务替身验证”*；在 [HDS-Mobile-Plan/TASK-BOARD.csv:11](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L11)（T10）中再次写道：*“群引用已走真实 OneBot payload”*。
   - 但在 [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:113-114](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L113-L114) 与 [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:172](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L172) 中，群引用回复被定义为表达补全的 `P1-3 · chatActions`，列为 `M4` 里程碑，并明确要求将 NapCat 适配器作为前置验证项。TASK-BOARD 在 G0 门槛的 T03 和 G3 门槛的 T10 中重复登记，任务边界与 08 规划的里程碑阶段明显错位。
4. **后台与保活（T13 / 07 文档）的实施边界矛盾**：
   - [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:20](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L20) 严格限定红线：*“07 的完整保活方案另行实施，本版只配套预算与通知健康投影”*，并在 [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:158](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L158) 说明 07 是保活专文，两者边界清楚。
   - 但在 [HDS-Mobile-Plan/TASK-BOARD.csv:14](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L14) 中，T13 将 [HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md#L1-L231) 直接列为 evidence，并将前台预算与保活混排于同一项（标记为 IN_PROGRESS），同时 notes 承认 *“START_STICKY、自动重启自愈、Doze/厂商保活未做”*。
5. **前置门槛尚未通过与下游任务推进状态矛盾**：
   - [HDS-Mobile-Plan/TASK-BOARD.csv:3](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/TASK-BOARD.csv#L3) 明确记录 T02（iQOO本地运行验证）为 `TODO`、*“未连接任何设备，全部 NOT RUN”*。
   - 依赖链中，T03 依赖 T02（行 4），T05 依赖 T04 与 T02（行 6），T06 依赖 T04 与 T05（行 7），T10 依赖 T03、T05、T06（行 11）。在 T02 仍为 `TODO` 且未过门槛的情况下，看板将下游的 T03、T05、T06、T10、T12 等全部标记为 `IN_PROGRESS` 或 `DONE`。
   - [HDS-Mobile-Plan/08-PARITY-PREVIEW8.md:21](file:///root/hermes-workspace/hds-android/HDS-Mobile-Plan/08-PARITY-PREVIEW8.md#L21) 承认无真机环境（*“允许发布如实标注边界的 preview，不满足完整移植首版验收”*），但与看板设定的 G0 阻断逻辑发生根本矛盾。

---

### 清单三：TEST-ON-PHONE.md 与 docs/PREVIEW8.md 中明确标注未测 / 未验证 / 未做的项目清单

#### 1. docs/PREVIEW8.md 中的标注清单
1. **真机与后台运行策略实测（NOT RUN）**：
   - 文件与行号：[docs/PREVIEW8.md:36](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L36)
   - 标注内容：`没有 iQOO/其他真机连接：30 分钟主动消息分布、Doze、系统回收、后台耗电、覆盖升级和厂商后台策略尚未实测。`
2. **07 文档保活、自愈与系统服务机制（未做 / 待独立实现）**：
   - 文件与行号：[docs/PREVIEW8.md:37](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L37)
   - 标注内容：`07 文档的自动恢复/重启监管、START_STICKY、断网自愈和电池引导仍待独立实现；本版保留既有停止/启动行为，只补本机健康和预算通知。强制停止后不会继续运行。`
3. **真实远端分享站与 QQ 账号功能（未测 / 未做）**：
   - 文件与行号：[docs/PREVIEW8.md:38](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L38)
   - 标注内容：`真实分享站预设与真实 QQ 账号引用尚未执行；测试使用本地服务替身。QQ 群引用路径已通，私聊引用、表情回应、原生表情不在本版承诺内。`
4. **QQ 社交扩展、创作线、高级卡格式与空间（未做 / 留到后续）**：
   - 文件与行号：[docs/PREVIEW8.md:39](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L39)
   - 标注内容：`QQ 多账号、好友管理、文件传输、旧消息同步、works 创作线、CHARX 等留到后续；QQ 空间仍关闭。`
5. **UI 回归的真机验证（未测）**：
   - 文件与行号：[docs/PREVIEW8.md:28](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L28)
   - 标注内容：`原生调用为 fixture，不能替代真机。`
6. **预设无人值守自动更新（未做）**：
   - 文件与行号：[docs/PREVIEW8.md:11](file:///root/hermes-workspace/hds-android/docs/PREVIEW8.md#L11)
   - 标注内容：`没有启用无人值守自动更新。`

#### 2. docs/TEST-ON-PHONE.md 中的标注清单
1. **测试替身与真实真机环境差异（未测）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:3](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L3)
   - 标注内容：`真机运行由你验证；本次自动化测试使用固定模型响应，不冒充真实 API 或 Android 结果。`
2. **系统底层架构与厂商设备（未实测）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:45](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L45)
   - 标注内容：`只包含 ARM64 运行器；4 KB/16 KB 页、iQOO/OriginOS 和后台策略均未实测。无法启动请反馈 ABI、页大小、Android/API 与日志。`
3. **真实 QQ 登录、投递与高级功能（未验证 / 未实现）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:46](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L46)
   - 标注内容：`QQ 扫码、快捷登录、文本私聊与 @ 群聊为实验接入；真实手机登录与投递尚待验证。空间、媒体和多账号同时在线未实现，不能用“QQ 已连接”代替这些能力已通过。`
4. **复杂卡格式与高级世界书执行引擎（未完成）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:47](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L47)
   - 标注内容：`CHARX、iTXt/zTXt、V3 外链资源、扩展脚本、正则与递归世界书执行未完成。`
5. **完整世界书提示词编排对齐（未实现）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:48](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L48)
   - 标注内容：`世界书支持关键词、secondary/selective、常驻、禁用、大小写、顺序/优先级、前后位置和保守预算。暂不等同 SillyTavern 完整提示编排。`
6. **数据生命周期管理、媒体与高级设置（待实现）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:49](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L49)
   - 标注内容：`备份/恢复、电脑迁移、升级回滚、媒体、浏览器、完整高级设置与费用预算仍待实现。本版不要用于唯一副本的重要长期故事。`
7. **异常退出与进程回收边界（未验证 / 需故障测试）**：
   - 文件与行号：[docs/TEST-ON-PHONE.md:50](file:///root/hermes-workspace/hds-android/docs/TEST-ON-PHONE.md#L50)
   - 标注内容：`正常停止会请求核心退出；超时后只结束本应用创建的 PRoot 进程。停止/进程回收边界和未知投递恢复仍需要真机故障测试。`
