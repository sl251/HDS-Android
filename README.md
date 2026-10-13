# HDS Android

在 Android 手机上运行 [HDS-Interlude](https://github.com/ISEKAI-MomoiCore/HDS-Interlude) 的叙事、记忆和持续生活核心。模型通过你配置的 API 调用，故事与人设保存在手机里。

**当前候选：0.1.0-preview.4 · ARM64 · Android 8+。** 无需另装 Termux。preview.3 已收到用户“成功运行”的反馈；preview.4 的自动检查与真机结果分开记录。QQ 登录、私聊、群聊和空间是下一阶段目标，目前尚未接入。

## 这一版能做什么

- **模型中心**：供应商预设、自定义 Base URL、获取并搜索模型列表、手动填模型、测试当前连接。兼容 Chat Completions 与 Anthropic Messages。
- **HDS 模型分工**：主叙事、记忆压缩、Alter 分析可分别指定连接；时间导演跟随记忆压缩。支持主叙事备用连接、优先级与轮询。
- **流式首条回复**：沿用 HDS 的 SSE 实现，先显示首条完整回复，再完成剧本。需要供应商支持 SSE 和 JSON 模式，默认关闭。
- **人设管理**：导入、创建、修改、从角色库删除。支持 Tavern JSON/标准 PNG，以及 [typ0](https://typ0.space/#browse) 下载的 `koishi.yml` 和 HDS 人设 JSON。
- **本地聊天与剧情**：真实 Koishi/HDS/SQLite 运行；不同角色各有独立故事。可查看剧情、事实、记忆，按需开启持续生活。

模型密钥通过 Android Keystore 加密保存，旧版单模型设置可继续使用。typ0 导入只接收 `storyDefaults` 人设字段；模型密钥、QQ 配置和其他运行分区不导入，预览会列出未应用内容。纯状态机预设暂不支持。

## 安装与使用

从 [Actions 候选构建](https://github.com/sl251/HDS-Android/actions/workflows/android-preview.yml) 下载成功任务的 APK 附件。候选分支不代表已发布正式版本；构建附件有保存期限。完整检查结果见 [preview.4 说明](docs/MODEL-CENTER-AND-PERSONAS.md)。

1. 覆盖安装同签名 APK，保留本机数据；不要先卸载。
2. 在“角色”导入人设，检查预览并选中。typ0 文件直接选下载的 YAML，无需改扩展名。
3. 在“设置”准备本机环境。模型中心填写地址、密钥，获取模型列表或手动输入模型名。
4. 分配模型任务，测试当前连接，再保存全部设置。连接测试会产生少量 API 费用。
5. 启动 HDS，在“对话”发送消息。“流式首条回复”可在模型中心开启。

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

HDS 固定在 rc51，保留其 AGPL-3.0 许可证与来源。APK 包含 Ubuntu/Node/PRoot 等各自许可的组件；目前未包含 Linux QQ 或 SnowLuma。后台存活、16 KiB 页面设备与 QQ 功能仍需真实设备验证。
