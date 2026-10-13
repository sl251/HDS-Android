# 0.1.0-preview.1 交付证据

- 2026-10-13：私有仓库预览 Release 已发布，非草稿：https://github.com/sl251/HDS-Android/releases/tag/v0.1.0-preview.1
- 构建提交 f8ab4ee0b848a3d7e0cb50ef73850a6c6e6b9a88，GitHub author/committer 均确认 sl251；Git 身份 sunny / 197351806+sl251@users.noreply.github.com。
- Actions 38344319730 全部成功：https://github.com/sl251/HDS-Android/actions/runs/38344319730
- 实际 HDS/Koishi/SQLite 宿主与卡格式测试：5 PASS、0 FAIL。固定模型响应验证实际模型请求、卡上下文、回执、去重及重启持久化；未调用用户付费 API。
- TypeScript/Vite、Capacitor 同步、Kotlin 编译、lintRelease、assembleRelease：通过。testReleaseUnitTest 无产品测试，模板测试已删除；未执行仪器测试。
- APK 95531456 bytes；SHA-256 d6b70ce404c5fa38870434c64759a542994c7e7f113163978b11b2f4cce5ba46。下载后独立复核 APK/源码哈希、ZIP CRC、APK 内 rootfs.bundle 哈希、两份 ARM64 ELF 哈希全部匹配。
- apksigner：APK v2 签名有效，RSA 4096；证书 SHA-256 2adf611b828fdbbf530a5a7617a053014b9ec1115e26aac98397fb3037b5709e。签名材料在本机忽略目录与已授权的私有 Actions secrets，未提交到 Git。
- UI 浏览器检查：独立 Edge/390×844 视口，无横向溢出，导航可打开设置页。只验证 Web 布局，不是 Android WebView 或真机结论。
- Release API 确认 APK 与源码等九份附件 state=uploaded，远端 APK digest 与本机 SHA-256 相同。合成中文角色卡在 GitHub 上传后文件名变为 character.json，内容未变。

这是可安装的本地 HDS 开发预览；T04 的手机运行、后台、故障恢复尚待真机验证，完整首版验收没有通过。QQ 私聊/群聊/空间、完整角色卡编排、备份恢复与媒体等仍未完成。不要将本报告视作完整功能一致性或真机 PASS。
