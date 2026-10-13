# HDS Android

在 Android 手机上运行 [HDS-Interlude](https://github.com/ISEKAI-MomoiCore/HDS-Interlude) 的叙事、记忆和持续生活核心。模型通过你配置的 API 调用，故事与人设保存在手机里。

**本分支候选：0.1.0-preview.5.2 · ARM64 · Android 8+。** 新增手机本地 QQ 实验接入，无需另装 Termux。二维码启动、消息协议与 Android 真机结果分别记录；QQ 空间尚未接入。

## 这一版能做什么

- **preview.5.2 手机反馈修复**：绕开 QQ 启动时 xauth 文件锁超时；模型连接删除按钮外置，误加的完全空白连接不再阻止启动；增加下载进度与可选 GitHub 加速地址；修正信箱深色主题白块。覆盖安装后须更新本机环境。详见 [修复记录](docs/QQ-PREVIEW5-FEEDBACK.md)。

- **启动兼容性候选修复**：preview.5 在 OriginOS 6 收到 `uv_cwd / ENOSYS` 反馈。preview.5.1 启动前实际检查 Node 工作目录、HDS 模块加载、文件读写和子进程，原追踪模式失败时尝试 PRoot seccomp 加速；两种都失败会显示具体探测阶段，不会伪报运行成功。仍待该手机验证。

- **QQ 信箱**：一键准备组件、扫码与快捷登录、连接状态、私聊/群聊文本、未读、手动发送。自动回复默认关闭，按角色设置白名单，群内只回应 @。详见 [QQ 使用与验证边界](docs/QQ-ROADMAP.md)。
- **操作界面**：底部改为“对话 / 信箱 / 角色 / 设置”，剧情与记忆移入对话页内，保留纸墨风。

- **模型中心**：供应商预设、自定义 Base URL、获取并搜索模型列表、手动填模型、测试当前连接。兼容 Chat Completions 与 Anthropic Messages。
- **HDS 模型分工**：主叙事、记忆压缩、Alter 分析可分别指定连接；时间导演跟随记忆压缩。支持主叙事备用连接、优先级与轮询。
- **流式首条回复**：沿用 HDS 的 SSE 实现，先显示首条完整回复，再完成剧本。需要供应商支持 SSE 和 JSON 模式，默认关闭。
- **人设管理**：导入、创建、修改、从角色库删除。支持 Tavern JSON/标准 PNG，以及 [typ0](https://typ0.space/#browse) 下载的 `koishi.yml` 和 HDS 人设 JSON。
- **本地聊天与剧情**：真实 Koishi/HDS/SQLite 运行；不同角色各有独立故事。可查看剧情、事实、记忆，按需开启持续生活。

模型密钥通过 Android Keystore 加密保存，旧版单模型设置可继续使用。typ0 导入只接收 `storyDefaults` 人设字段；模型密钥、QQ 配置和其他运行分区不导入，预览会列出未应用内容。纯状态机预设暂不支持。

## 安装与使用

本分支的 preview.5.2 APK 由 [候选分支 Actions](https://github.com/sl251/HDS-Android/actions?query=branch%3Acodex%2Fqq-integration) 提供，下载成功构建的 `HDS-Android-preview-<提交号>` 附件。它不是正式发行版。已有的 [preview.4 Release](https://github.com/sl251/HDS-Android/releases/tag/v0.1.0-preview.4) 继续保留；旧同名 preview.4 的替换记录见 [构建验证](docs/evidence/preview4-replacement/README.md)。

1. 覆盖安装同签名 APK，保留本机数据；不要先卸载。
2. 在“角色”导入人设，检查预览并选中。typ0 文件直接选下载的 YAML，无需改扩展名。
3. 在“设置”准备本机环境。模型中心填写地址、密钥，获取模型列表或手动输入模型名。
4. 分配模型任务，测试当前连接，再保存全部设置。连接测试会产生少量 API 费用。
5. 启动 HDS，在“对话”发送消息。“流式首条回复”可在模型中心开启。
6. 要接 QQ，打开“信箱”下载组件、启动并扫码。看到消息通道在线后，再设置回复白名单。组件约 235 MiB，安装时至少留出 1.6 GiB；手机端登录待实测。

修改运行中角色会先停止 HDS，重新启动后应用新设定，并保留历史。删除是从角色库移除，保留故事和原文件；重新导入原文件可恢复。模型设置的修改在下次启动生效。

## 开发与文档

```sh
npm ci --ignore-scripts
npm test
npm run android:sync
python3 scripts/build-runtime.py
cd android
./gradlew lintRelease testReleaseUnitTest assembleRelease
```

完整 APK 构建使用 Linux、Node 24.11.1、Python 3.12、Java 21、Android SDK 35。运行时来源由 `runtime/sources.lock.json` 固定；签名通过 `HDS_SIGNING_STORE`、`HDS_SIGNING_PASSWORD` 提供，私钥不进仓库。推荐复用 Actions 工作流，它会保留测试报告、校验值和对应源码包。

- [手机测试与已知限制](docs/TEST-ON-PHONE.md)
- [模型中心、人设兼容与参考设计](docs/MODEL-CENTER-AND-PERSONAS.md)
- [手机本地 QQ 接入路线](docs/QQ-ROADMAP.md)
- [与 HDS 上游的补丁边界](docs/MOBILE-PATCHES.md)
- [第三方来源与许可](docs/THIRD_PARTY.md)
- [早期实施记录](HDS-Mobile-Plan/00-START-HERE.md) · [原始基线结果](docs/evidence/T01/baseline.md)

HDS 固定在 rc51，保留其 AGPL-3.0 许可证与来源。APK 包含 Ubuntu/Node/PRoot 等各自许可的组件；QQ / NapCat 在用户点击后从官方来源校验下载，APK 不内置它们；不包含 SnowLuma。后台存活、16 KiB 页面设备与真实 QQ 登录投递仍需手机验证。
