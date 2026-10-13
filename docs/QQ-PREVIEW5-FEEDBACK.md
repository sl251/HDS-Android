# preview.5.1 手机反馈修复与参考实现

记录日期：2026-10-13。此次为本地源码修改，尚未生成或发布新版 APK。

## QQ 启动超时

用户截图的具体失败是 `xauth: timeout in locking authority file /qq-data/display.auth`，发生在 Xvfb 和 Linux QQ 启动前。上层 20 秒 RPC 超时会使界面同时出现笼统的 `timeout`。单纯延长扫码等待时间不能解决该错误。

旧实现调用 xauth 写入认证 cookie。残留锁或 Android/PRoot 的硬链接锁语义可能导致失败；截图无法区分两者，未声称已经在用户手机复现。

新实现直接按 Xauthority 二进制格式写入记录（CARD16 大端、长度前缀字段、FamilyWild、本次显示编号、MIT-MAGIC-COOKIE-1、16 字节随机 cookie），原子替换私有认证文件，不再调用 xauth，也不使用其 `-c` / `-l` 锁。Xvfb 继续使用 `-auth` 与 `-nolisten tcp`，QQ 继续设置 XAUTHORITY。每次启动重新生成 cookie；没有关闭显示认证或清空 QQ 登录数据。

## 模型连接

- 删除入口移至当前连接编辑区顶部，保存全部设置后生效。
- 保存与启动读取时过滤完全空白的自定义草稿，误点“添加连接”不再因空 URL 阻止已有连接工作。
- 有模型名、地址、列表地址、密钥输入或已保存凭证的连接仍须显式修正/删除；不静默丢弃这些配置。
- 仍要求至少一条完整连接，且主叙事、记忆压缩、Alter 都有启用的连接。一条连接可同时承担三种任务。
- 停用连接不传入运行时；删除后的缺失任务分配不会偷偷转移给其他模型。

## 下载与信箱

QQ / NapCat 下载状态通过 RPC 提供当前组件、已收字节、Content-Length（若有）及平均速度。界面显示进度条、MiB、百分比、MiB/s；未知长度、连接、校验、解包阶段显示不定进度，不伪造完成百分比。本机环境从 APK 解包，也增加活动进度条，沿用原有解包字节提示。

“下载网络设置”支持用户填写 HTTPS GitHub 加速前缀（格式：`加速地址/https://github.com/...`），默认直连，只作用于 NapCat 的固定 GitHub 下载地址。QQ 保持腾讯官方源；所有文件继续校验固定 SHA-256 和大小上限。没有内置未经验证的公共代理名单，代理不保证可用，取消或失败后可重新下载。

信箱的自动回复入口、登录卡片、头像、消息气泡改用主题变量，修复深色主题下浅色背景与浅色文字混用。二维码保留白色底以便扫描，错误文字提高深色模式下的可读性。

## 手机直接运行 QQ 后端的参考

| 项目 | 核实到的实现 | 对 HDS 的意义与边界 |
| --- | --- | --- |
| [NapCat 官方 Termux 安装器](https://github.com/NapNeko/NapCat-Installer/blob/aa5a6c7e27d943c20ef140cea5b0065a509cb9fc/script/install.termux.sh) | 使用 proot-distro 创建 Debian，安装 Linux QQ / NapCat，以 xvfb-run 启动；支持 GitHub 加速地址和保留容器继续安装 | 直接支持现有 PRoot＋Linux QQ 路线；用户免装 Termux 的宿主 App 仍需自行处理启动、文件系统与生命周期兼容 |
| [NapCatHost / napcatqq_android](https://github.com/sky6776/napcatqq_android/tree/7e6dff5f1b62194e2e40674320ea28e2444a813c) | 独立 Android 前台宿主，打包 Debian、PRoot、Xvfb、Linux QQ、NapCat；README 针对 vivo V1911A、Android 10，target API 28；代码含进程监管与 WebUI 健康检查 | 是更接近 HDS 产品形态的实现。作者的目标机说明不等于本次独立真机验证，也不证明 OriginOS 6 兼容。可参考进程恢复、健康检查与登录阶段划分，不直接复制其整套二进制或权限策略 |
| [Shamrock](https://github.com/XiaoMiku01/Shamrock) | README 明确是基于 Xposed 的 OneBot 11/12 框架 | 属于 Hook Android QQ 的另一条路线，需要额外运行条件，不能直接满足 HDS 当前免 Root、独立沙箱的交付方式 |
| [Lagrange.Core](https://github.com/LagrangeDev/Lagrange.Core) | 当前主分支为 V2；提供 .NET、NativeAPI 与 Milky 服务；V1 已 sunset | 可以评估协议实现路线，但不是现有 OneBot 接口的直接替换，也没有在本次调研中获得 HDS 所需的现代 Android 真机验证证据 |

结论：手机本地运行 QQ 后端有现成工程实现，现有路线值得继续修复验证；这不是读取或复用 Android 官方 QQ 的登录态，而是在手机内运行独立 Linux QQ 会话。此次未复制上述项目代码，未更换 QQ / NapCat 固定版本。

## 验证记录

- `npm run build`：通过（TypeScript + Vite）。
- `npm test`：20 项通过，包含真实 Koishi/HDS/SQLite/OneBot 夹具、Xauthority 记录/随机性/残留锁、下载字节进度/未知长度/哈希失败/大小上限/取消。
- `ModelEndpointTest` + `ModelSettingsCodecTest`：本机 Kotlin 编译后 JUnit 11 项通过，包含误加空连接、保留密钥与角色校验；这是纯 JVM 测试，未运行完整 Android Gradle 构建。
- Headless Edge：深浅色信箱、删除连接、已知 25% 进度、未知长度不定进度、320px 无横向溢出，无页面异常。QQ 数据来自 UI 夹具。
- 初次沙箱执行因 Vite realpath / 临时数据库 rename 权限失败；获得自动审批后在沙箱外重跑通过。
- **尚未运行**：新版本 APK 构建、真实 ARM64 Xvfb/QQ 启动、用户 OriginOS 6 扫码登录与私聊/群聊收发。原有 `scripts/qq-linux-smoke.ts` 会覆盖新认证文件路径，但本次没有远程触发 CI，不能沿用旧候选结果声称此修改已通过。

真机复测顺序：覆盖安装同签名新 APK → 更新本机环境 → 原模型启动 → 信箱启动 QQ → 出二维码 → 扫码确认 → 等消息通道在线 → 测试私聊与群聊。出二维码仅证明启动链路可用，不等于成功登录或消息接入完成。

## 2026-10-14：preview.5.3 的 Xvfb 锁修复

preview.5.2 已成功构建，并通过 ARM64 Linux QQ 获取未扫描二维码验证；随后手机反馈 Xvfb 自身报 `Linking lock file (/tmp/.X8974-lock) in place failed: Permission denied`。这是 Xserver 的 PID 锁，和之前 xauth 的认证文件锁不同。说明此前 chroot 冒烟检查未覆盖 Android 的硬链接权限限制。

[上游 Xserver 源码](https://github.com/mirror/xserver/blob/master/os/utils.c) 中，`LockServer` 使用 link 建立 PID 锁；`-nolock` 在 guest root 下跳过此步骤。HDS 已使用 PRoot `-0` 提供 guest root 身份，无需手机 Root。此次改用 `-nolock`，继续设置 `-auth` 和 `-nolisten tcp`，随机选择未发现现存 socket 或锁文件的显示编号；不删除其他显示进程的 socket/锁文件，也不关闭认证。

新增 `scripts/xvfb-lock-smoke.ts`：在实际打包的 ARM64 Xvfb 子进程中用 CI 专用 LD_PRELOAD 夹具强制 link/linkat 返回 EACCES；要求原参数复现同样错误，再要求新参数能接受正确 cookie 并拒绝错误和空 cookie。故障注入库只在独立测试任务中编译，不打入 APK。之后继续检查实际 Linux QQ 出二维码。真机扫码、收发和后台存活仍由手机复测确认。
