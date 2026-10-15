# Preview8 发布验证

日期：2026-10-15（Asia/Shanghai）。开发预览，不是完整首版验收。

- 实际 APK 构建提交：`1e00f7a8615e0232e69107162bc15f9bfda0a159`。
- [GitHub Actions #38722802409](https://github.com/sl251/HDS-Android/actions/runs/38722802409)：build 与 qq-linux-arm64 均 success。
- Android 编译、lintRelease、51 项 JVM 单测、签名构建及测试 APK 编译通过。
- 移动端宿主 34 项测试通过；UI 自动化通过（320/390/740 px、浅深色、预设应用和自动保存，原生桥为 fixture）。
- Linux ARM64 包内 Node/文件/子进程 PRoot 验证通过；实际打包 QQ 用户空间检查通过，未登录真实账号。
- APK 文件：`HDS-Android-0.1.0-preview.8-arm64.apk`，187004153 bytes。
- SHA-256：`9aeb14798b93fd23dbb9bcd931bca6b007ef766d033d0e7fcf47fb9bcf80a55c`。
- AndroidManifest：`io.hdsinterlude.android` / `0.1.0-preview.8` / versionCode `16`。
- APK v2 签名：CI apksigner 验证通过。本地从签名块独立提取证书，SHA-256 `2adf611b828fdbbf530a5a7617a053014b9ec1115e26aac98397fb3037b5709e`，与 preview7.1 相同。
- 本地只读审计：ZIP 校验、rootfs SHA/字节数/解包容量、无 hardlink、PRoot/loader 哈希、包内 schema 与源码一致。host.cjs/UI/DEX 均包含 preview8 的配置、预设和预算代码。
- 上游 837 项：830 pass / 3 fail / 4 skip；原版 main narrator 下同样 3 项失败，分别为旧 rc50 断言、旧日志文档版本、旧假对象缺少 flushBufferedNarrativeBody。无新增上游回归。

发布标签相对上述构建提交只追加 README、任务状态和发布证据，不改变 Android、UI、宿主或依赖。Release 提供 APK、源代码、签名信息、审计报告及 SHA256SUMS。

NOT RUN：真机安装/升级、长时主动联系、Doze/厂商后台、真实分享站/QQ 账号。完整重启自愈、QQ 多账号/媒体/好友、works、QQ 空间仍未完成。详见 ../../PREVIEW8.md。
