# T13 后台保活、恢复与成本控制 — 实施任务书

版本：0.1（草案） · 编制日期：2026-10-15（Asia/Shanghai）
对应主任务：[04-TASKS.md](04-TASKS.md) 的 **T13 — 后台、恢复与成本控制**
验收用例来源：[05-ACCEPTANCE.md](05-ACCEPTANCE.md) 的 A06、A08、H08、R01—R04、R10、U03

> **本文性质**：这是**待实施的实施任务书**，不是已完成的功能说明。除「§1 现状核对」中标为「已核实」的条目外，其余接口、策略、常量均为**拟实施设计**，运行时尚不存在。首版实现前不产生真实 APK 证据。

---

## preview.8 实施复核

此文仍是保活设计草案，preview.8 未将 L1/L2/L4 标为完成。本版实现滚动 24 小时模型请求预算（默认 120，可调整）及每 60 秒的本机健康/预算通知投影，详见 `docs/PREVIEW8.md`。

实施前必须纠正：

1. `restore-held.json` 是恢复存档/回滚后的暂停标记，**不是通用崩溃或非干净退出标记**；只有明确 `story.resume` 才清除。不能把每次服务重建都当作备份恢复。
2. 成功进入 healthy 立即清零，会让“启动成功后秒崩”的循环永远绕过重启上限。应保留滑动窗口记录，稳定运行一段时间后再衰减，并验证进程重建时的持久计数。
3. 本机 RPC health 不证明外部网络或模型服务可用。不要把互联网断网等同于本地核心挂死，也不要为断网重启并重放业务。
4. AlarmManager 非精确闹钟不能保证 Doze 中按 30 秒心跳；唤醒锁也不能承诺绕过 Doze。系统回收、服务重建、子进程残留的行为仍需实际设备证据。
5. 本版 budget 计量模型尝试次数；QQ 保活、状态查询、已经决定的消息投递不消耗该额度，避免把免费轮询与模型费用混为一谈。直接聊天主叙事、手动整理豁免；其他辅助任务保守计入。

以下原设计保留供下一阶段修订，不能直接用于宣传持续保活保证。

---

## 1. 现状核对（已核实）

下列结论由人工逐行核对当前仓库源码得出，每条附 `文件:行号`。**这是本次任务书的出发点：所有"待改"项都相对于此。**

### 1.1 前台服务（`android/app/src/main/java/io/hdsinterlude/android/HdsService.kt`，共 44 行）

| # | 事实 | 位置 | 对 T13 的含义 |
|---|---|---|---|
| S1 | 前台服务类型为 `specialUse`，附 `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` 说明 | `AndroidManifest.xml:29-30` | 类型合法；上架需人工审核说明 |
| S2 | `onStartCommand` 固定返回 `START_NOT_STICKY` | `HdsService.kt:40` | **系统回收进程后不会自动重建服务**——保活链最大短板 |
| S3 | `onDestroy` 中：若非用户主动停止，则调用 `HdsRuntime.get(this).stopAsync()` | `HdsService.kt:42` | **意外销毁时反而主动杀掉运行时**（自杀而非自救） |
| S4 | 已持有 `PARTIAL_WAKE_LOCK`，每 9 分钟续约一次（10 分钟租期） | `HdsService.kt:23-25,29-30` | L4 唤醒锁现状已存在，非空白 |
| S5 | 通知固定文案「HDS 正在手机内运行」，`IMPORTANCE_LOW`，`setOngoing(true)`，带「停止全部」动作 | `HdsService.kt:32,35` | 通知**不反映实时状态**（在线/重连中/已降级） |
| S6 | 已有 `stop(context)` 静态方法置 `intentionalStop` 再 `stopService` | `HdsService.kt:15-21` | 区分"用户停止 / 意外销毁"的开关已具备 |
| S7 | 权限：`WAKE_LOCK`、`INTERNET`、`ACCESS_NETWORK_STATE`、`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_SPECIAL_USE`、`POST_NOTIFICATIONS` | `AndroidManifest.xml:45-50` | **未**声明 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`；无 `RECEIVE_BOOT_COMPLETED`（且首版不做开机自启，见 §3.4） |

### 1.2 运行时监管（`HdsRuntime.kt`）

| # | 事实 | 位置 | 对 T13 的含义 |
|---|---|---|---|
| R1 | `state` 为单值字符串（`stopped/installing/starting/healthy/stopping/failed`），`status()` 仅返回 `{state, installed}` | `HdsRuntime.kt:31,102` | 状态机存在，但向 UI 暴露的字段过少 |
| R2 | **子进程退出监听会置 `failed` 并调用 `HdsService.stop(context)`**，无任何重启 | `HdsRuntime.kt:296-299` | **不存在"崩溃自动拉起"**；当前是崩溃即整链停止 |
| R3 | 启动后轮询 `POST /rpc {method:"health"}` 判定健康，成功后 `state="healthy"` | `HdsRuntime.kt:283` | 健康探针已存在，可复用为保活心跳的判据 |
| R4 | 启动失败路径同样 `HdsService.stop(context)` | `HdsRuntime.kt:235` | 失败即停链，无退避重试 |
| R5 | PRoot 以 `--kill-on-exit` 启动 | `HdsRuntime.kt:250` | 宿主进程死亡时 guest 被一并清理，语义干净（利于受控重启） |
| R6 | 每次启动重写 `etc/resolv.conf`：优先用系统 DNS，空则回退 `1.1.1.1/8.8.8.8` | `HdsRuntime.kt:246-247` | 断网恢复后 DNS 需要重新写入——这是 L2 的一个具体动作点 |
| R7 | 所有运行时调用串行化在单线程 `executor` | `HdsRuntime.kt:29` | 重连/重启逻辑必须入同一 executor，避免并发启动风暴 |
| R8 | `stopAsync()` / `stopBlocking()` 已区分异步与阻塞收尾 | `HdsRuntime.kt:337-338` | 重启策略可复用 `stopBlocking` 做干净收尾再拉起 |

### 1.3 宿主进程与协议（`runtime/host.ts`，共 233 行）

| # | 事实 | 位置 | 对 T13 的含义 |
|---|---|---|---|
| H1 | 只有 `POST /rpc` 单一端点，**无独立 `/health` 路由** | `runtime/host.ts:204` | 健康检查复用 `/rpc {method:"health"}`，返回 `{hds, storyId, platform, sqlite}` |
| H2 | 请求鉴权为 `Bearer token` + `Host` 头校验 + 禁止 `Origin` | `runtime/host.ts:202` | 保活心跳走同一鉴权，无需新增认证面 |
| H3 | 方法白名单中 `health` 在维护期仍可用（唯一放行项） | `HdsRuntime.kt:354-355` | 备份/维护期间心跳不会误报失败 |
| H4 | `restore-held.json` 语义：**存在 = 上次异常中断、需恢复** | `runtime/host.ts:24,84,168` | 是"上次是否干净退出"的唯一持久标记 |
| H5 | 存在该标记时，启动流程把故事置 `paused` | `runtime/host.ts:84` | 恢复后不自动推进，等用户确认 |
| H6 | 首次非 pause 方法调用时清除标记并写 `running` | `runtime/host.ts:167-169` | 标记清除时机是"用户真的恢复使用"，定义明确 |
| H7 | 停止流程会调用 `mobileDrainBeforeStop()` 再 `app.stop()` | `runtime/host.ts:216` | 干净收尾有既定钩子，可用于写入"干净退出"标记 |

### 1.4 Kotlin 侧写入点（纠正早期误判）

| # | 事实 | 位置 | 含义 |
|---|---|---|---|
| K1 | **`MainActivity` 实为 `MainActivity.java`**（BridgeActivity 子类），`onCreate` 中 `registerPlugin(HdsRuntimePlugin.class)` | `MainActivity.java` | WebView ↔ 原生的桥接入口；早期核对曾误判为不存在 |
| K2 | JS 侧只经 `HdsRuntimePlugin.status()` 取 `runtime().status()`，无本地状态副本 | `HdsRuntimePlugin.kt:24` | **服务端（运行时）是唯一真相源**，UI 不缓存状态——对保活有利 |
| K3 | 导入存档/回滚桌面板时，Kotlin 侧会写 `restore-held.json` | `HdsRuntimePlugin.kt:74,92` | 早期核对误判"Kotlin 不碰该标记"；实际两侧都会写，改动时须同时核对 |

### 1.5 核对中被推翻的早期假设

- ❌「子进程死了能自动拉起」→ 实为 R2：崩溃即整链停止。
- ❌「已设 `START_STICKY`」→ 实为 S2：`START_NOT_STICKY`。
- ❌「有独立 `/health` 端点」→ 实为 H1：只有 `POST /rpc`。
- ❌「无唤醒锁」→ 实为 S4：已有 9 分钟续约的 `PARTIAL_WAKE_LOCK`。
- ❌「`MainActivity.kt` 不存在、Kotlin 不碰 `restore-held.json`」→ 实为 K1/K3。

---

## 2. 设计目标与分层

保持 HDS 语义不变的前提下，把"用户开着就得一直跑、断了能自己回来、但绝不重复动作、也不能无限烧配额"变成有明确边界的机制。分四层，逐层可独立验收。

```
L4  电源与厂商策略   ← 电池白名单引导、Doze 观察、息屏降级
L3  通知与可见性     ← 通知反映真实状态、快速恢复入口
L2  链路自愈         ← 前台心跳、指数退避、断线暂存
L1  进程保活         ← 崩溃受控重启、START_STICKY 语义、重启风暴封顶
```

**贯穿约束**：所有层共享一条铁律——**保活只恢复"通道"，绝不自动重放业务动作**。未确认结果一律标 `unknown`，交由用户或幂等键决定（对齐 05 的 R01—R04）。

---

## 3. 分层实施

### 3.1 L1 — 进程保活与受控重启

**目标**：运行时意外退出后，在**有限次数**内自愈；用户主动停止则永不自启。

拟实施：

1. 引入 `RestartPolicy`（Kotlin，`HdsRuntime.kt` 内或独立文件）：
   - 滑动窗口 60 秒内最多重启 **3** 次；超限进入 `failed`，通知说明"多次启动失败，请查看诊断"。
   - 每次重启前先 `stopBlocking()` 干净收尾（复用 R8），再按退避 `2s → 5s → 15s` 拉起。
   - 重启计数在用户主动 `start()` 或成功进入 `healthy` 后清零。
2. 改 `HdsService.onDestroy` 语义（S3）：
   - 区分 `intentionalStop`（用户）→ 不收尾、不重启；
   - 意外销毁 → **先判断运行时是否仍在健康态**，健康则走 L1 重启；不健康则记录并停止整链（保留现有"失败即停"的保守行为）。
3. `onStartCommand` 返回改 `START_STICKY`：
   - 仅用于让系统回收后重建**服务外壳**；重建后由 L1 判断是否需要拉运行时，**不假设 guest 进程还活着**。
   - 注意 Android 12+ 后台 FGS 启动限制：`START_STICKY` 重建属系统发起，不在前台启动限制内；但重建后若需重启 PRoot，必须走前台服务已在前台的前提（服务外壳已在 `onCreate` `startForeground`）。
4. **明确不做的**：不申请开机自启（`RECEIVE_BOOT_COMPLETED`）；对齐 04 的 T13 门槛"强制停止后不承诺继续运行"与 A08。

**验证**：
- 单测：`RestartPolicy` 窗口/退避/清零逻辑（纯 Kotlin，无 Android 依赖）。
- 真机：`adb shell am force-stop` 后确认不自启；`kill <node pid>` 后确认 3 次内自愈、且不产生重复消息（复用 R01 的 `requestId` 幂等）。

### 3.2 L2 — 链路自愈与断线暂存

**目标**：网络抖动/切换不导致叙事中断，也不在恢复时集中补做错过的事。

拟实施：

1. 前台心跳：`HdsService` 内新增 `checkAndReconnect()`（走 R7 同一 executor），周期 **30 秒**调用 R3 的 health 探针；连续 **2** 次失败判定链路断。
2. 指数退避重连：`5s → 15s → 60s → 300s` 封顶；达封顶后不再自动尝试，通知改为"网络中断，点击重试"。
3. 恢复动作（断线期间与恢复时）：
   - 重写 `resolv.conf`（复用 R6 逻辑，应对切换网络后 DNS 变化）；
   - **不**执行错过的 tick；对齐 R03「断网 30 分钟 / 停机 24 小时后有限衔接，不集中执行漏掉的 tick」。
   - 若断线期间有未确认的发送，标 `unknown` 并计入配额，不自动重发（对齐 R02、S04 语义）。
4. 息屏/Doze 下降低探针频率（与 L4 联动）：Doze 中改由 `AlarmManager`（非精确）+ 唤醒锁驱动，避免被 Doze 掐断心跳导致的误判。

**验证**：
- 集成：模拟断网 → 确认进入退避序列、恢复后重新写 resolv.conf、无漏 tick 集中执行。
- 契约：用现有 `/rpc` 桩比较断线前后请求集合，确认无重复可见动作。

### 3.3 L3 — 通知与可见性

**目标**：用户一眼看出"到底还活着没有"。

拟实施：

1. 通知正文改为随状态更新：`运行中 / 重连中（第N次）/ 已暂停（等待网络）/ 启动失败`。复用同一条 `hds-runtime` 通知（`setOnlyAlertOnce(true)`，避免连续打扰）。
2. 通知动作扩展：保留「停止全部」（S5 已有），新增「重试连接」（仅断线态显示）。
3. `HdsService.stop()`/失败态需要在通知里给出**准确**表述，不得把"未发送"写成"已发送"（贯穿约束）。
4. UI 侧（T09）状态刷新仍以 `HdsRuntimePlugin.status()` 为唯一来源（K2），通知只做投影，不引入第二真相源。

**验证**：U03（拒绝通知权限只影响该能力，解释准确）；截取各状态通知文案做人工核对。

### 3.4 L4 — 电源与厂商策略

**目标**：在真机（iQOO 15 / OriginOS）上尽量不被系统杀掉，且对用户透明。

拟实施：

1. 电池白名单引导：新增可选引导页，用 `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 拉起系统对话框；**声明相应权限**（S7 当前未声明，需在 manifest 增补 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`）。
2. 厂商后台策略引导（vivo/iQOO 特有）：文字引导用户去「i管家 → 后台高耗电 / 自启动」放行，不假设系统设置可编程修改。
3. WakeLock 现状（S4）保留；补充：进入 Doze 时释放长周期锁，改由 L2 的 AlarmManager 驱动，避免违反 Doze 语义被系统强杀。
4. 息屏降级可观测：记录并展示"息屏期间是否存活、是否被中断"，对齐 R04「报告真实存活/中断，恢复数据一致」。
5. 首版不做开机自启（同 L1）。

**验证**：A08（iQOO 15 重启整机后恢复数据、不伪称强停期间仍在运行）、R04（关屏/Doze/厂商限制下报告真实状态）。

---

## 4. 成本控制（对齐 T13 门槛）

04 的 T13 明确要求"设置可配置日调用预算""预算截止后停止新增后台调用并告知"。

拟实施：

1. 新增可配置项：`日后台调用预算`（默认建议 0 = 不限制，由用户显式开启）；计量口径为**后台发起的模型/QQ 请求数**，不折算金额（金额随服务商变动，仅做可选展示）。
2. 达预算时：停止新增后台请求，前台仍可用；通知与 UI 明示"已达今日后台预算，明日恢复"。
3. **待用户确认**：默认值取 0（不限制）还是给一个小额上限？

**验证**：R10（达后台调用预算后停新增后台请求，有说明）。

---

## 5. 验收映射

| 用例 | 说明 | 本任务书对应 |
|---|---|---|
| A06 | WebView 返回/切应用不误结束持续运行 | L1（服务外壳保持）、L3 |
| A08 | iQOO 整机重启后恢复、不伪称仍在运行 | L1 §4、L4 §5 |
| H08 | 时区/长间隔恢复用模拟时钟，不改系统时间 | L2 §3（不补 tick）；测试用注入时钟，**不改手机系统时间** |
| R01 | 接收后回应前杀进程，同 requestId 重试无重复 | 贯穿约束 + L1 验证 |
| R02 | 计划落库/送达/回写各边界崩溃不误标已发 | L2 §3 |
| R03 | 断网 30min / 停机 24h 有限衔接 | L2 §3 |
| R04 | 关屏/Doze/厂商限制报告真实状态 | L4 §4 |
| R10 | 达后台预算停新增请求 | §4 |
| U03 | 拒绝通知权限只影响该能力 | L3 §4 |

---

## 6. 需要用户先决策的点

1. **重启封顶**：60 秒内 3 次是否够？（iQOO 冷启动 PRoot + Node 可能就要十几秒，可能需放宽到"5 分钟内 3 次"。）
2. **心跳周期**：30 秒是否过密？（对耗电敏感可放宽到 60 秒。）
3. **日预算默认值**：0（不限制）还是给个上限？
4. **是否要 iQOO 厂商引导页**：会新增一个用户可见步骤，是否接受？

---

## 7. 未核实 / 待补充

- `ProotLaunch.kt` 只做了接口层核对（`ProbeResult`），未逐行确认它与 `HdsRuntime` 的重启衔接细节，实施前需补读。
- 未核实 `AlarmManager` 在该 app 的现有用法（可能已有，需 grep 确认后复用而非新增）。
- `HDS_MOBILE_CLEAN_STOP` 的输出目前只打在 stdout；L1 的"干净退出"判定是否要落文件（与 `restore-held.json` 对称）尚未定。
- 06-HANDOFF-PROMPTS.md 未更新以引用本文。

---

## 8. 与其他文档的关系

- 本文是 [04-TASKS.md](04-TASKS.md) 中 **T13** 的展开；T13 的"输入/交付/完成门槛"仍以 04 为准，本文只补实施细节。
- 实施前建议先完成 T05、T06、T11（T13 的依赖）。
- 与 05-ACCEPTANCE.md 的用例映射见 §5；本文不新增验收用例。

---

## 附：核对过程说明

本文 §1 的现状事实，由本机 Hermes 代理与 `agy`（Antigravity CLI，`claude-sonnet-4-6`，plan/只读模式）分别读取源码后交叉核对；agy 报告中有 3 处结论（`MainActivity` 存在性、Kotlin 写入 `restore-held.json`、若干行号）经人工回读源码纠正，以 §1 为准。
