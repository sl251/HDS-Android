好的，我来按照要求并行读取关键文件，严格控制步骤数。先同时读取最核心的几个文件。
好，核心服务文件读完。现在并行读 `ProotLaunch.kt`、`MainActivity.kt`、`runtime/host.ts`（先看前半段）和规划文件。
现在读 `host.ts` 剩余部分和 `05-ACCEPTANCE.md`。
所有关键文件读取完毕（共 6 步），信息已足够。现在输出四块核对结论。

---

# HDS-Android T13 后台保活技术核对报告

---

## A. 现状核对

### A1 前台服务类型与声明

**`AndroidManifest.xml:29`**：
```xml
<service android:name=".HdsService" android:exported="false"
         android:foregroundServiceType="specialUse">
  <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
            android:value="User-started local HDS narrative engine and its managed PRoot process" />
</service>
```
前台服务类型为 **`specialUse`**，不是 `dataSync`、`mediaPlayback` 或 `systemExempted`。`specialUse` 是 Android 14 以上唯一允许"不符合其他类型语义但确有必要"的前台服务类型，Google Play 上架需要人工审核。权限声明 `FOREGROUND_SERVICE_SPECIAL_USE`（`AndroidManifest.xml:49`）已同步声明。

通知渠道 ID 为 `hds-runtime`，重要程度 `IMPORTANCE_LOW`（`HdsService.kt:32`）。通知文本固定为「HDS 正在手机内运行」/ 「QQ 连接状态见信箱；停止后 QQ 与自动叙事同时结束」，**不反映实时状态**（`HdsService.kt:35`）。

### A2 WakeLock 续期方式

**`HdsService.kt:25`**（单行显示已折叠）：
```kotlin
private val renew = object : Runnable {
    override fun run() {
        wakeLock?.acquire(10 * 60 * 1000L)   // 持续 10 分钟
        handler.postDelayed(this, 9 * 60 * 1000L) // 9 分钟后再次续期
    }
}
```
- WakeLock 标志：`PARTIAL_WAKE_LOCK`，Tag：`HDS:runtime`（`HdsService.kt:29`）
- `setReferenceCounted(false)`，即非引用计数模式（`HdsService.kt:29`）
- 每次 `acquire` 指定 10 分钟超时，再用 `Handler.postDelayed` 每 9 分钟重新 acquire，形成滚动续期，不存在单次永久 WakeLock
- `onDestroy` 中调用 `release()`（`HdsService.kt:42`）

### A3 启动标志

**`HdsService.kt:40`**：
```kotlin
return START_NOT_STICKY
```
**关键：服务返回 `START_NOT_STICKY`，而非 `START_STICKY`。** 这意味着系统回收服务后 **不会自动重启** HdsService，也不会重传 Intent。

### A4 `onDestroy` / `onTaskRemoved` 行为

**`HdsService.kt:42`**（完整 `onDestroy`）：
```kotlin
override fun onDestroy() {
    handler.removeCallbacks(renew)
    wakeLock?.let { if (it.isHeld) it.release() }
    if (active === this) active = null
    if (!intentionalStop) HdsRuntime.get(this).stopAsync()
    super.onDestroy()
}
```
- `onTaskRemoved` **未重写**。`MainActivity` 文件不存在（工具报告 `no such file or directory`），此处为 `Service` 的默认空实现。
- `intentionalStop` 区分「用户主动停止」（`STOP` Intent 或 `HdsService.stop()` 静态方法）与「意外销毁」（`if (!intentionalStop) stopAsync()`）。**但无论哪种情况，都不会自动重启服务**。
- `intentionalStop = false` 路径下仍调用 `stopAsync()`，即意外销毁时也会发信号让 Node 子进程停下，并不会保留进程继续运行。

### A5 子进程由谁启动与监管

子进程启动：`HdsRuntime.startNow()`（`HdsRuntime.kt:237`）在 `executor`（单线程 `ExecutorService`，`HdsRuntime.kt:29`）中调用 `ProcessBuilder` 启动 PRoot（`HdsRuntime.kt:275`）。

监管方式：
1. **健康检查循环**（`HdsRuntime.kt:282-295`）：启动后 90 秒内每 500ms 轮询 `rpc("health", ...)` 等待 `sqlite: true`；
2. **退出监听线程**（`HdsRuntime.kt:296-299`）：`Thread { child.waitFor() }` 等待子进程退出，若进程死亡且状态非 `stopping`，则置 `state = "failed"`，调用 `HdsService.stop(context)`；
3. **没有** 自动重启逻辑，只是报告失败状态。

### A6 状态如何从 Kotlin 传到 WebView

`HdsRuntime.status()` 返回 `JSONObject`（`HdsRuntime.kt:102-105`），包含 `state`、`installed`、`running`、`progress`、`error`、`logs`、`device` 等字段。调用方式通过 `HdsRuntime.rpc()` 的 HTTP `POST /rpc` 接口（`HdsRuntime.kt:353-369`）——这是从 Kotlin 到 Node 进程的调用，而非 Kotlin 到 WebView。

`MainActivity.kt` 不存在（工具返回 404），因此 Kotlin→WebView 的状态传递方式（`JavascriptInterface`、`evaluateJavascript`、`WebMessageListener` 哪种）**未核实**。仅能确认服务内部状态通过 `@Volatile` 变量维护，并由 `status()` 方法打包输出。

### A7 host.ts 有无独立健康检查端点

**有**，且是专属方法：

**`host.ts:163`**：
```typescript
if (method === 'health') return { hds: HDS.version, storyId: story.id, platform: bot.platform, sqlite: true }
```
路由仍走 `POST /rpc`，请求体 `{ method: "health" }`，不是独立 URL 的 `/health` 端点。Kotlin 侧在 `rpc()` 方法中 `allowlist` 了 `"health"` 方法（`HdsRuntime.kt:355`），且在 `maintainStory` 里例外允许 `health` 调用（`HdsRuntime.kt:354`）。

**即：没有独立 HTTP 端点（如 `GET /health`），健康检查复用 `/rpc` + `method:"health"` 路径。**

### A8 RPC 是否无长连接

**`HdsRuntime.rpc()`（`HdsRuntime.kt:353-369`）**：每次 RPC 新开一个 `HttpURLConnection`，connectTimeout 3000ms，readTimeout 20000ms，调用完毕 `connection.disconnect()`。**是纯短连接 HTTP，无 WebSocket 或长轮询。**

### A9 restore-held 机制的实际实现位置与行为

**文件级实现：`runtime/host.ts:24-25`**：
```typescript
const restoreMarker = join(input.dataDir, 'restore-held.json')
let restoreHeld = existsSync(restoreMarker)
```

**行为链**（`host.ts`）：
| 行号 | 行为 |
|------|------|
| 25 | 启动时检查 `restore-held.json` 是否存在，赋值给 `restoreHeld` 布尔变量 |
| 38 | `LocalBot.sendMessage()` 若 `restoreHeld` 为 true，抛出「恢复的故事需先明确恢复运行」，阻断所有角色发消息 |
| 84 | `if (restoreHeld) { await app.interlude.setDesktopRuntimePhase('paused'); story = setStatus(story, 'paused') }` — 启动时若 held，把故事置为 paused 状态 |
| 166-169 | `story.resume` RPC 调用时，`if (!paused && restoreHeld) { restoreHeld = false; unlinkSync(restoreMarker); ... setDesktopRuntimePhase('running') }` — 用户显式 resume 后删除标记文件，解除 held 状态 |

**Kotlin 侧没有操作 `restore-held.json` 的代码**（文件在 `/hds-data` 即 PRoot 内的挂载路径，`HdsRuntime.kt:252` 显示 profile 挂载为 `/hds-data`，但 Kotlin 层没有主动写此文件的逻辑）。生成该标记文件的逻辑**未核实**——需看 `runtime/host.ts` 之外的关闭/暂停路径（本次未涉及）。

---

## B. 任务书用的分层实施细节草稿

### L1 进程守护

**现状**：`START_NOT_STICKY` + 无自动重启，意外退出只报 `state = "failed"`。

**涉及文件**：
- `android/app/src/main/java/io/hdsinterlude/android/HdsService.kt`
- `android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt`

**具体改法**：

1. **重启决策**：在 `HdsRuntime.kt` 的退出监听线程（`HdsRuntime.kt:296-299`）中，区分 `cleanStop`（Node 正常发送 `HDS_MOBILE_CLEAN_STOP`）与意外退出。新增 `RestartPolicy` 数据类：
   ```kotlin
   data class RestartReason(val exitCode: Int, val attemptIndex: Int, val timestamp: Long)
   ```
   维护 `private val restartHistory = ArrayDeque<RestartReason>()`，若 60 秒内已尝试 3 次则放弃并保持 `state = "failed"`。

2. **服务自重启**：意外退出时，改为调用 `startAsync()` 而非 `HdsService.stop(context)`；若 Node 进程消亡但 Service 还活着，直接在 executor 线程中重新 `startNow()`，不必重建 Service。**注意**：现有 `START_NOT_STICKY` 意味着 Service 本身被系统杀掉后不重建，因此若要保证 Service 存续，需额外的机制（见 C 节风险）。

3. **重启日志**：`log("进程重启：exitCode=$code，第${attempt}次，原因=意外退出")` 写入现有 `output` 环形缓冲，并暴露到 `status()` 的新字段 `restartHistory`。

4. **区分「用户主动停止」**：现有 `intentionalStop` 字段已区分；需保证重启逻辑在 `intentionalStop = true` 时完全跳过。

**依赖的上游接口**：现有 `startNow()` / `stopNow()` / `cleanStop` 变量。

**验证方式**：
- 🟡 **必须真机验证**：手动 `adb shell kill <pid>` 杀掉 PRoot 子进程，确认 `state` 先变 `failed` 再恢复 `healthy`；60s 内连续杀 3 次确认放弃机制。
- 🟢 **可静态/单测验证**：`RestartPolicy` 的退避计算可写纯 Kotlin 单测。

---

### L2 链路自愈（App 回前台重连）

**现状**：Node 进程活着时，`HdsRuntime.rpc()` 是同步短连接 HTTP（`HdsRuntime.kt:353-369`），3s connect timeout，20s read timeout。前台重连没有专门触发逻辑（`MainActivity.kt` 不存在，无法核实 WebView 侧行为）。

**涉及文件**：
- `android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt`
- `android/app/src/main/java/io/hdsinterlude/android/MainActivity.kt`（待新建或确认）

**具体改法**：

1. **独立健康检查端点**（可选增强）：在 `host.ts` 中新增 `GET /health` HTTP 路由，与 `/rpc` 并列，无需 token，只返回 `{"ok":true}`，供 Kotlin 快速探活（绕过 RPC allowlist 逻辑）。现有 `method:"health"` 路径保留。

2. **App 前台回调**：在 `MainActivity`（或 `Application.ActivityLifecycleCallbacks`）的 `onResume` 中，调用 `HdsRuntime.get(ctx).checkAndReconnect()`，新增方法：
   ```kotlin
   fun checkAndReconnect() {
       if (state == "healthy" && process?.isAlive == true) return
       if (state == "failed" && !intentionalStop) startAsync()
   }
   ```

3. **指数退避**：重连间隔从 2s 起，每次翻倍至 60s 上限，失败超过阈值后不再自动尝试，通知栏显示「需手动恢复」。

4. **断线本地缓存**：`messages.sendLocal` 的请求幂等性已由 `requestId` + `mobile_request` 表保证（`host.ts:181-190`）。Kotlin 层需补充：若 Node 离线时用户发消息，本地暂存 `(requestId, content, timestamp)` 列表，上线后依序重发，每条结果验证 `duplicate: true` 时跳过。

**验证方式**：
- 🟡 **必须真机验证**：切后台 5 分钟、息屏 10 分钟后回前台，确认通知变 `重连中`，随后变 `运行中`。
- 🟢 **可单测验证**：`checkAndReconnect()` 的状态机分支可 mock `process.isAlive` 写单测。

---

### L3 通知栏状态

**现状**：通知在 `onCreate` 建立后文本固定（`HdsService.kt:35`），不随运行状态变化。没有「重连中」或「已停止」变体。`startForeground(42, notification)`（`HdsService.kt:36`）。

**涉及文件**：
- `android/app/src/main/java/io/hdsinterlude/android/HdsService.kt`
- `android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt`

**具体改法**：

1. 在 `HdsService` 中新增 `updateNotification(state: String)` 方法：
   ```kotlin
   fun updateNotification(state: String) {
       val text = when(state) {
           "healthy"    -> "运行中 · 点击查看"
           "starting"   -> "启动中…"
           "failed"     -> "连接中断，尝试恢复"
           "stopping"   -> "正在停止"
           else         -> "已停止"
       }
       val notification = buildNotification(text)
       getSystemService(NotificationManager::class.java).notify(42, notification)
   }
   ```

2. 在 `HdsRuntime` 的所有 `state =` 赋值点（`startNow()` 的各阶段、退出监听线程、`stopNow()`）后调用 `HdsService.active?.updateNotification(state)`。

3. **服务端状态为唯一真相源**：UI WebView 侧的状态只订阅 `status()` 返回值，不在本地维护副本状态；Kotlin 侧的 `@Volatile state` 就是单一真相源。

**验证方式**：
- 🟡 **必须真机验证**：通知栏在 `starting` / `healthy` / `failed` / `stopped` 各状态下文本正确。
- 🟢 **可静态验证**：`when(state)` 分支覆盖 `HdsRuntime` 所有 state 值，可用枚举 exhaustive 检查。

---

### L4 省电与厂商策略

**现状**：无任何电池优化白名单引导、无息屏网络降级、无厂商后台策略引导代码。权限已声明 `WAKE_LOCK`、`INTERNET`、`ACCESS_NETWORK_STATE`（`AndroidManifest.xml:45-47`）。

**涉及文件**：
- `android/app/src/main/java/io/hdsinterlude/android/MainActivity.kt`（待创建/确认）
- `AndroidManifest.xml`

**具体改法**：

1. **电池优化白名单引导**：首次启动时检查 `PowerManager.isIgnoringBatteryOptimizations(packageName)`，若否，弹 `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` Intent 引导。需声明权限 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`（Android 14 非豁免 App 须引导，不能静默申请）。

2. **vivo/iQOO 后台策略引导**：在首次启动或检测到 `Build.MANUFACTURER.lowercase() == "vivo"` 时，展示引导弹窗，指引用户进入「电池」→「后台高耗电」→ HDS 设为「允许」。无法自动配置，只能引导。文档化品牌包名路径（未核实，需真机验证）。

3. **息屏网络降级**：监听 `ConnectivityManager` 网络状态（`HdsRuntime.kt:245-246` 已有用法参考），息屏后停止主动发消息、只保留健康检查；亮屏后恢复。通过 `PowerManager.isInteractive()` 判断屏幕状态。

**验证方式**：
- 🟡 **必须真机验证（vivo/iQOO 设备）**：白名单引导后真机后台测试，对比引导前后存活时间差异。
- 🟢 **可单测验证**：`isIgnoringBatteryOptimizations` 分支逻辑可用 mock 单测。

---

## C. 风险与坑

### C1 前台服务类型限制（Android 14+）

`specialUse` 是最严格的前台服务类型，Google Play **强制人工审核**，需要在应用申请时提供充分使用理由。`PROPERTY_SPECIAL_USE_FGS_SUBTYPE`（`AndroidManifest.xml:30`）已声明子类型描述，但 Play 上架合规风险仍需评估。Android 14 开始要求在 `startForeground()` 调用时明确指定类型（`startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)`），当前代码 `startForeground(42, notification)` 未传第三参数——**在 Android 14+ 可能触发 `MissingForegroundServiceTypeException`**（`HdsService.kt:36`，未核实是否已被 targetSdk 或 compat 处理）。

### C2 `START_NOT_STICKY` 的实际含义

**当前实现 `START_NOT_STICKY`（`HdsService.kt:40`）**：系统内存不足回收 Service 后不会自动重建。这意味着：
- 切后台后系统 OOM Kill 掉 Service，Service **不会自动重启**
- L1 的进程守护必须在 Service 存活时才有意义；若 Service 本身被杀，整个守护链断掉
- 改成 `START_STICKY` 会让系统尝试重建 Service（但 Intent 为 null），但在 Android 12+ 有**后台 FGS 启动限制**——从后台启动前台服务需要豁免条件（`SYSTEM_ALERT_WINDOW`、设备管理员、`MANAGE_MEDIA` 等），普通 App 无法从后台自启前台服务

### C3 后台 FGS 启动限制（Android 12+）

Android 12 起，从后台状态调用 `startForegroundService()` 会抛出 `ForegroundServiceStartNotAllowedException`，除非满足豁免条件（如 `ACTION_BOOT_COMPLETED` 广播接收者、EXACTLY_ONCE alarm 等）。当前代码在 `HdsRuntime.kt:162, 177, 235` 多处调用 `HdsService.stop(context)`，即在 `executor` 工作线程（后台）调用停止，问题不大；但若要在 Node 退出后重启 Service，则触发了后台启动限制。

### C4 Doze / App Standby 分桶

- **Doze 模式**：手机静止+息屏+充电未插入约 30 分钟后进入 Doze，周期性窗口间隙才允许网络和闹钟。`PARTIAL_WAKE_LOCK` 在 Doze 下**不起作用**（Doze 直接 ignore WakeLock）。`specialUse` 前台服务在 Doze 下是否豁免**取决于系统版本**，非完全豁免。
- **App Standby 分桶**：未被使用的 App 会进入 RARE / RESTRICTED 桶，后台任务执行机会极少。前台服务可使 App 不进入深度桶，但前台服务被杀后 App 仍可能被分桶。
- **Android 15 限制**：`FOREGROUND_SERVICE_TYPE_SPECIAL_USE` 在 Android 15 新增额外限制，长时间（超过 10 小时/24 小时）运行的前台服务可能被系统提示用户终止（Battery Saver 强制停止提醒）。

### C5 WakeLock 续期上限

当前实现每 9 分钟 acquire 一次 10 分钟超时的 WakeLock（`HdsService.kt:25`），理论上可无限续期。但：
- Android 系统不限制 WakeLock 持有时长，但 **Battery Stats 会标记**长持 WakeLock，厂商 ROM 可能据此强杀
- Doze 下 WakeLock 被忽略（见 C4）
- `Handler.postDelayed` 在 Doze 下可能不按时触发，导致续期漏掉后 WakeLock 超时释放

### C6 PRoot + Node 子进程树被杀

PRoot 用 `--kill-on-exit` 参数（`HdsRuntime.kt:250`），即 PRoot 主进程退出时杀掉其所有子进程。但 Android OOM Killer 和 LMKD 直接从 cgroup 层杀进程组，可能跳过 PRoot 的 `--kill-on-exit` 语义，直接发 SIGKILL 给进程树所有成员。Kotlin 的 `Process.waitFor()` 此时会立即返回非 0，退出监听线程（`HdsRuntime.kt:296-299`）会检测到并上报 `state = "failed"`。**真正的风险**是：若 PRoot 被 SIGKILL 而 Node 子进程仍在，可能出现孤儿 Node 进程占用端口，导致下次启动 `ServerSocket(0)` 重新选端口没有问题，但旧 Node 进程不会停止（除非 cgroup 将其一起杀掉，这通常是默认行为）。

### C7 vivo/iQOO 后台策略

vivo OriginOS / iQOO 有独立的「后台高耗电管理」和「自启管理」，即使 App 已是前台服务，也可能在 N 分钟无用户交互后被 ROM 自行挂起或终止。这是 ROM 层行为，无法通过 AndroidManifest 或 API 绕过，只能引导用户手动白名单（L4）。

---

## D. 纠正

### D1 「Node/PRoot 子进程死了能自动拉起」— **错误，当前无此实现**

> **初步分层原文（L1）**：「Node/PRoot 子进程死了能自动拉起」

**真实代码现状**：子进程死亡时（`HdsRuntime.kt:298`）只是 `state = "failed"`，随即调用 `HdsService.stop(context)` 停掉 Service。**没有任何自动重启逻辑。** 这是 T13 需要新增的能力，不是现有能力。

### D2 「区分意外退出与用户主动停止，写重启原因」— **区分机制存在，重启机制不存在**

`intentionalStop` 字段确实存在（`HdsService.kt:22`），能区分主动停止与意外销毁。但「写重启原因」和「重启」本身均未实现，均为待实现内容。

### D3 「App 回到前台能判断 Node 死活并重连」— **被动有，主动无**

退出监听线程（`HdsRuntime.kt:296`）是被动监听。App 回到前台时**没有主动触发检查/重连**的代码（`MainActivity.kt` 不存在，无法核实 WebView 侧是否有轮询），这是需要在 T13 中新增的能力。

### D4 「通知栏显示真实状态（运行中/重连中/已停止）」— **当前通知文本固定，不动态更新**

`HdsService.kt:35` 的通知文本在 `onCreate` 时创建后不再更新。「服务端状态为唯一真相源、UI 只订阅」的说法作为**目标架构**是合理的，但当前实现中通知文本就是固定字符串，与运行时状态无关。

### D5 「指数退避」— **当前无**

`HdsRuntime.kt` 中没有任何指数退避逻辑。启动失败后直接 `HdsService.stop(context)`，不重试。指数退避是 T13 待实现内容。

### D6 「独立健康检查端点」— **不独立，复用 /rpc**

`host.ts:163` 的 `health` method 走 `POST /rpc` 通道，不是独立的 `GET /health` 端点。这并非错误，只是与「独立端点」的表述有偏差。调用 `health` 仍需 Bearer token 认证（`host.ts:203`）。

### D7 「息屏网络降级」— **当前无实现，仅有启动时读 DNS**

`HdsRuntime.kt:245-246` 只在 `startNow()` 时读一次 DNS 写入 `resolv.conf`，不存在息屏后动态降级网络请求的逻辑。这是 T13 待实现内容。

---

> **步骤统计**：共使用 6 次文件读取工具（3 并行 + 2 并行 + 1 后续），未超出 20 步上限。`MainActivity.kt` 文件不存在，WebView ↔ Kotlin 的具体桥接方式**未核实**；`restore-held.json` 写入时机（谁在什么条件下创建该文件）在 `host.ts` 之外**未核实**（当前读取范围未覆盖 `runtime/host.ts` 之外的关闭/暂停调用链）。
