# agy 派活 brief：HDS-Android 后台保活任务书（T13）技术核对与细节草稿

工作目录：/root/hermes-workspace/hds-android

## 交付方式（重要，先看）

1. **先动手读文件**，本次任务只读：不要修改、新建、删除任何文件，不要 `git add`/`commit`/`checkout`/`stash`，不要跑构建。
2. **禁止写脚本去自查字符串**（不要 grep 循环、不要写 python 自检、不要在 shell 里反复 run_command 验证自己的输出）。核查用一次直接读取即可。
3. **步骤上限 20 步**，超出就停下，把已确认的结论写出来，标出未完成部分。
4. 全部结论以 **stdout 的中文 Markdown 文本**返回，不要写成文件。（引用代码位置必须给出 `文件:行号`；不确定的地方写 `未核实`，不要猜。）

## 背景

安卓端 HDS（Koishi/Node 跑在 PRoot Ubuntu 里）切后台/息屏后链路断掉、回来页面假死。要做一份给执行模型（GPT）看的任务书，落到 `HDS-Mobile-Plan/07-BACKGROUND-KEEPALIVE.md`。规划里 T13 就叫「后台、恢复与成本控制」，验收在 `HDS-Mobile-Plan/05-ACCEPTANCE.md`、任务定义在 `HDS-Mobile-Plan/04-TASKS.md` 的 T13 节。

初步分层（待你用真实代码核对）：
- L1 进程守护：Node/PRoot 子进程死了能自动拉起，区分「意外退出」与「用户主动停止」，写重启原因。
- L2 链路自愈：App 回到前台能判断 Node 死活并重连，不能假死；考虑独立健康检查端点、指数退避、断线本地缓存。
- L3 通知栏：常驻通知显示真实状态（运行中/重连中/已停止）+ 服务端状态为唯一真相源，UI 只订阅。
- L4 省电：电池优化白名单引导、厂商（vivo/iQOO）后台策略引导、息屏网络降级。

## 你要读的文件（按需，不必全读）

- `android/app/src/main/java/io/hdsinterlude/android/HdsService.kt`
- `android/app/src/main/java/io/hdsinterlude/android/HdsRuntime.kt`
- `android/app/src/main/java/io/hdsinterlude/android/ProotLaunch.kt`
- `android/app/src/main/java/io/hdsinterlude/android/MainActivity.kt`（若存在）
- `android/app/src/main/AndroidManifest.xml`（权限、service 声明）
- `runtime/host.ts`（RPC 分发、配置下发、bridge/status、health、restore-held）
- `HDS-Mobile-Plan/04-TASKS.md` 的 T13 节、`HDS-Mobile-Plan/05-ACCEPTANCE.md`
- 与 `restore-held.json` / 「恢复的故事需先明确恢复运行」相关的实际实现位置

## 你要输出的四块（中文 Markdown）

### A. 现状核对（必须带 文件:行号）
逐条核对上面的初步分层说法是否属实，写出真实代码现状：前台服务类型/通知渠道/WakeLock 续期方式、启动标志、onDestroy/onTaskRemoved 行为、子进程由谁启动与监管、状态如何从 Kotlin 传到 WebView、host.ts 有没有独立健康检查端点、RPC 是否无长连接、restore-held 机制的实际实现位置与行为。

### B. 任务书用的分层实施细节草稿
L1–L4 每层写：涉及文件（精确路径）、具体改法（要新增/修改的类、函数、常量名与大致逻辑）、依赖的上游接口、验证方式。**能自证的（单测/类型检查/静态）** 与 **必须真机验证的** 分开标注。

### C. 风险与坑
在 Android 14/15 + 厂商 ROM 上做这类保活的实际限制：前台服务类型限制、`START_STICKY` 与 `specialUse`、Foreground Service 启动限制（后台启动限制）、Doze/App Standby 分桶、WakeLock 续期上限、vivo/iQOO 自启管理；以及 PRoot + Node 子进程树被杀的实际情况。

### D. 纠正
上面「初步分层」里如果有与真实代码不符的说法，直接指出，并给出正确表述。
