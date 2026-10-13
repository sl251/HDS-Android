# preview.3 启动与模型地址修复候选

日期：2026-10-13。针对 preview.2 用户反馈的两个独立故障，保持现有架构，仅修复连接与启动链路。

## 模型 404

旧版把输入地址原样 POST，输入服务商 Base URL `https://example.com:9443/v1` 时并未调用 Chat Completions 接口。

原生设置保存、已保存连接测试及传给 HDS 的配置统一使用 `ModelEndpoint.resolve`：根地址补 `/v1/chat/completions`，以版本目录结尾的 Base URL 补 `/chat/completions`，完整接口及自定义路径保留。原有设置无需重新输入密钥；保存时显示补全后的地址。查询参数保留用于请求，但诊断不展示查询参数。

当前协议仍是 OpenAI 兼容 Chat Completions；没有声称支持 Anthropic Messages 或 OpenAI Responses。错误信息包含实际请求路径，区分 404、认证拒绝和限流；不再把 404 一律归因于模型或密钥错误。

参考 [ChatterUI 的自定义 API 配置](https://github.com/Vali-98/ChatterUI/blob/master/docs/CustomTemplates.md)，接口路径及协议需要明确处理。

## PRoot / Node uv_cwd

旧启动器强制设置 `PROOT_NO_SECCOMP=1`。参考 [rikkahub_mcp Android 兼容记录](https://github.com/topabomb/rikkahub_mcp/blob/master/docs/references/workspace-architecture.md) 及 [ProotLaunchSpec 源码](https://github.com/topabomb/rikkahub_mcp/blob/master/workspace/src/main/java/me/rerere/workspace/ProotLaunchSpec.kt)，Android 14+ 上关闭 PRoot seccomp trace 可能导致 getcwd、stat、chdir 返回 ENOSYS。

候选移除该强制设置及继承值，增加 `-k 4.14.0`，并使 `PWD=/opt/hds` 与 `-w` 一致。Node 启动入口直接验证 `process.cwd()`，未覆盖该函数或隐藏 syscall 错误。退出时优先显示退出码及 `HDS startup failed` 日志；只有进程仍存活且超时才报 90 秒未就绪。安装完成文案仅表示文件校验与解包完成。

这是有源码依据的兼容性修复候选，尚不能代替受影响手机的验证。

## 一次覆盖升级验收

1. 保留旧应用和数据，安装同签名 versionCode=3 APK。不要先卸载。
2. 设置页按提示更新内置环境，完成后启动 HDS。
3. 原 Base URL 和模型名可以保持不变，点击“测试已保存连接”。这会进行一次真实模型请求，可能产生少量费用。
4. 确认日志出现 `Node cwd OK`、`HDS_MOBILE_READY`，状态变为健康；再发送一条消息，检查真实回复与重启后的剧情保存。
5. 若仍失败，只需记录新的错误和启动日志。不要提交 API Key。若相同 ENOSYS 继续出现，应停止扩大功能范围，先评估该设备 PRoot 兼容性，不能把桌面或 CI 通过当作手机可用。

## 验证状态

- 本地真实 Koishi / HDS / SQLite 与角色卡回归：5 项通过。
- TypeScript 类型检查、Vite 构建、Capacitor Android 同步：通过。
- Android JVM 回归：31 项通过、0 失败、0 忽略；其中新增 7 项覆盖 Base URL、完整路径、查询参数、无效地址与 PRoot 参数。
- Kotlin 编译、Android lint、单元测试、release APK 和应用仪器测试 APK 编译：全部通过。仪器测试未在设备执行。
- 不带密钥的服务商路由对照：原 `/v1` POST 返回 404，补全后的 `/v1/chat/completions` POST 返回 401。仅验证路由差异，未验证授权模型生成。
- 目标手机启动与带密钥模型调用：未执行。没有使用用户 API 密钥。

## 可安装候选

- [Actions 构建 38380690563](https://github.com/sl251/HDS-Android/actions/runs/38380690563)：success。
- 构建源码：`1c4b341cfcec0df7010f25810ae3c34151f31d31`；后续文档提交不改变 APK 来源。
- 分支：`codex/fix-model-endpoint-proot-startup`。未合并 main，未创建 Release。
- 文件：`artifacts/HDS-Android-0.1.0-preview.3-arm64.apk`，96,304,032 bytes，约 91.8 MiB。
- SHA-256：`d710a7678ac2c3907efbe9bb678b15f187e05cc003372938b7cf414dae21a124`。
- versionCode=3；证书与 preview.1 / preview.2 相同，具备覆盖升级条件。CI apksigner 验证通过，本地再次核对 APK 签名块证书。
- APK CRC、rootfs 哈希/大小、原生 ELF 哈希通过；0 个硬链接。详见 [包审计](evidence/preview3/apk-audit.json)。
