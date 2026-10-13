# preview.5：手机本地 QQ 候选

本分支实现 NapCat 扫码登录、登录状态与快捷登录、OneBot 私聊/群聊文本收发、按角色保存的自动回复白名单，以及 App 信箱。真实账号扫码、Android PRoot 和锁屏存活需要用户在手机验证；Linux ARM64 检查不代替真机结论。

## 使用路径

1. 覆盖安装候选 APK，更新环境，选中角色并保存模型，启动 HDS。
2. 打开“信箱”，点击“下载并准备组件”。从腾讯与 NapCat 官方地址下载约 235 MiB，逐个校验 SHA-256；需要至少 1.6 GiB 空闲空间。网络失败可重试，取消不会清除登录态。
3. 点击“启动 QQ”，用官方 QQ 扫码确认。可保存二维码，尝试相册识别；不允许时在另一台设备展示二维码。App 不索取 QQ 密码，也不复用官方 Android QQ 的私有会话。
4. 须达到“QQ 与 HDS 消息通道已连接”；二维码、已扫码或已登录均不等于消息通道在线。
5. 在“角色自动回复”填写允许互动的 QQ 号/群号，再打开自动回复。空白名单拒绝全部；群内仅回应 @，使用 HDS 原有冷却和上下文。手动发送以登录 QQ 的身份发出。

## 实现

`HdsRuntime` 保留单个 PRoot / Node 启动路径。`runtime/qq.ts` 在同一 PRoot 中监管 QQ 子进程，退出时关闭 OneBot 和 QQ。QQ 采用上游安装器的官方 Linux QQ + NapCat 应用入口路线，由独立监管的 Xvfb 提供容器内虚拟显示，不向 Android 桌面展示窗口。普通 Node 缺少 `qq_magic_napi_register`；QQ 的 Node 模式也未通过启动验证，因此采用上游实际使用的虚拟显示方案。GnuTLS 全局符号与 GTK/音频等 ELF 链接依赖一并固定。Xvfb 禁止 TCP 监听，Unix 套接字位于 App 私有 rootfs。QQ 进程组与显示进程在停止时一并结束。

- QQ 数据挂载到 `/qq-data`，对应私有 `noBackupFilesDir/hds/qq`，不在 rootfs 或某个人设目录内。修复环境、编辑人设和切换角色不会删除登录记录。切换角色会停止旧进程，重新启动 QQ 后可使用快捷登录。
- 模型与 HDS 仍在原来的角色数据库内；QQ 通过 HDS `addStoryEndpoint` 加到当前故事，不创建第二套叙事核心。白名单按角色保存。
- 管理 API 与 OneBot 仅监听 `127.0.0.1` 随机端口，使用不同的随机 token。WebView 不接触管理 token；操作经过原生 RPC 白名单。
- 安装不运行联网 shell 脚本或 Debian 包维护脚本。组件固定来源见 `runtime/qq-components.ts`，Ubuntu 依赖见 `runtime/qq-libs.lock.json`。校验后解包到暂存目录，完成后才激活。
- 使用兼容 Koishi 4.18 的 `koishi-plugin-adapter-onebot@6.9.5`。旧的带作用域 `@koishijs/plugin-adapter-onebot@6.0.2` 已弃用，不能与本项目的 Satori 4 混用。
- 信箱按账号保存最近 2,000 条消息，每会话显示最近 200 条。重复入站在 Koishi 绑定前拦截；手动发送按 requestId 防重。结果不明时不自动重发，需在官方 QQ 核对。
- 通知“停止全部”结束 HDS 与 QQ；运行期间使用带超时续期的部分唤醒锁，停止释放。它不保证免于 Doze、厂商回收或系统强停。

## 检查与边界

`tests/qq.test.ts` 使用真实 Koishi、HDS、SQLite、OneBot WebSocket 适配器和本地模型夹具，检查管理 API 鉴权、私聊白名单、@ 群触发与发送回执、共享故事、入站去重、手动文本防 CQ 注入与防重、停止后的投递门控。

`scripts/qq-linux-smoke.ts` 在原生 ARM64 Linux 机器的实际打包 Ubuntu 用户空间中下载固定组件并尝试取得真实未扫描二维码。不登录账号、不发送 QQ 消息、不发布二维码或 token。以对应候选提交的 Actions 结果为准。

尚待手机验证：扫码确认、真实私聊/群聊投递、断网重连、16 KiB 页设备、后台与耗电。尚未实现：QQ 空间、媒体上传/下载、好友管理、多账号同时在线、账号注销/清除登录态、旧聊天同步。图片/语音等显示类型占位，不宣称原项目完整多媒体能力。

## 参考依据

- [NapCat v4.18.38](https://github.com/NapNeko/NapCatQQ/tree/bbd0d2aca3d470c20b33b1d4f95123335633bf26)：读取登录 API、配置、进程与 wrapper 代码，不复制或修改实现。
- [NapCat Termux 安装器](https://github.com/NapNeko/NapCat-Installer/blob/main/script/install.termux.sh)：证明 PRoot / Linux QQ 路线存在，不直接证明本 App 可用。
- [Linux QQ](https://im.qq.com/linuxqq/download.html)：官方存在 Linux ARM64 客户端，无需 Windows/Wine。
- [Lagrange 当前主线](https://github.com/LagrangeDev/Lagrange.Core)：V2 使用 Milky，旧版 OneBot/AOT 建议不能直接套用。本版未集成。
- [Android-DIY-Sandbox](https://github.com/zz6zz666/Android-DIY-Sandbox)：参考容器管理方式，不将其当作 QQ 已通过的证据，未复制代码。

先用测试账号验证。第三方客户端可能触发账号风控；不声称不同实现的风险相同，不提供设备指纹伪造。
