# 自动验证与人工验收边界

最后代码提交：`7a032ed6f6151a1d0258ec7a8cfa15e097f101f5`，版本 `0.1.0-preview.9.2.2` / versionCode `23`，核心保持 `1.0.1-rc57`。

用户提供 ZIP 中 README、审计结论、执行任务书及交接说明均已与现有解压文件逐文件 SHA256 比对，一致。输入 ZIP 摘要见 baseline.json；用户的原始 ZIP 与其他未提交计划资料未改动、未上传。

| 自动检查 | 结果 | 证据 |
| --- | --- | --- |
| Linux 宿主完整回归 | 121/121 PASS，0 跳过 | [最终回归 CI](https://github.com/sl251/HDS-Android/actions/runs/39060701389) 的 audit-regression-evidence |
| 前端类型检查与生产构建 | PASS | 同上 |
| 浏览器完整回归 | PASS；导入、故事编辑、群设置、语音播放器与工作台均通过 | 同上 audit-ui-tests.log；Android SAF/录音/Provider 部分为服务桩 |
| 原生 lint 与单元测试 | 完整构建中 95/95 PASS，0 跳过 | 独立 CI 为 94 PASS、1 SKIP；完整构建提供实际 preview1 rootfs，补齐该项并全部通过 |
| 原生桥许可 | PASS | NativeRpcContractTest 经原生受控 RPC 实际 HTTP 调用服务桩；未知方法/错误字段拒绝。真实 APK UI→插件→PRoot host 仍为 NOT RUN |
| 语音并发与预算 | PASS | VoiceBridgeQueueTest、VoiceStoreTest：并发、排队溢出、同请求回放、明确拒绝释放额度、超时用量未知、设置读取不持网络锁 |
| 参考 WAV 与备份恢复 | PASS | AuditWavTest、AuditArchiveTest、VoiceStorageTest；合成 WAV、独立空目录恢复及中断恢复；真实格式/设备矩阵仍待验收 |
| ARM64 Linux 运行环境与 QQ 无账号启动 | PASS | [完整构建](https://github.com/sl251/HDS-Android/actions/runs/39060702957) 的 qq-linux-arm64 作业；没有登录账号、发送真实消息 |
| 完整签名候选 APK | PASS | 同一完整构建；[候选产物](https://github.com/sl251/HDS-Android/actions/runs/39060702957/artifacts/12111950411)，已下载并本地复算 SHA256 |
| APK/rootfs 静态检查 | PASS | apk-audit.json：runtime 摘要、压缩/展开大小一致，27,933 条目；未执行其中内容 |

候选包 `HDS-Android-0.1.0-preview.9.2.2-arm64.apk` 为 187,237,662 字节，SHA256=`bb63af7be1a1025b3321c0e7ff6c6f37609af2998313c36a61bd1fc25f6acafc`。

APK v2 签名校验通过，证书 SHA256=`2adf611b828fdbbf530a5a7617a053014b9ec1115e26aac98397fb3037b5709e`，与已有 preview8 签名证据一致。runtime manifest 的 sourceSha 与上述最后代码提交一致。签名连续性不代替真实覆盖升级验收。源码归档及其摘要见 SHA256SUMS.txt；完整 manifest 与签名输出一并保存。

群语音自动回归使用真实 HDS、SQLite、Koishi OneBot 编码/套接字及 SILK WASM，Provider 与 QQ 收件端为服务桩。覆盖直接 @、规则允许的非 @、引用、分段、无 session 的主动群目标、意愿/禁用/冷却/额度护栏、语音失败时文字只确认一次。生产代码没有固定高意愿、强制群发或放宽群白名单。

## 发布前仍需人工完成

- 目标手机覆盖安装、冷启动，确认角色/故事/QQ 缓存/音色保留，核对安装包 SHA256。
- 导入有效码、错误码、人设编辑、切角色与应用中断恢复；重启后验证持久化。
- 用户主动完成内置、描述设计、参考克隆三模式真实试听，并确认可播放与用量。
- 仅在用户选定的测试私聊和测试群，验证直接 @、允许的非 @、引用及主动群发言；检查自主选择、时长、播放和重复消息。
- 目标手机息屏 5/30/120 分钟、8 小时过夜、Wi-Fi/蜂窝切换、Doze 与各层进程死亡；明确停止后不得复活。
- 干净应用数据或第二设备恢复备份，播放历史语音并验证有效音色。

以上真实验收全部为 **NOT RUN**。MuMu 仅有 mumu-probe.json 的只读环境与旧安装包摘要；未运行普通应用 UID 下的 PRoot→Node→SQLite→HDS→QQ 全链路，未声明兼容。当前为草稿修复候选，未发布正式 Release。
