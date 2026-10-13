> 此处记录的是已被替代的早期模型候选。当前下载与校验值见 [preview.4 替换记录](../preview4-replacement/README.md)。

# preview.4 候选构建证据

- 构建源码：`3606b68d7c9e5b120d98b5c3958d2e96d8c09999`。
- [Actions 38388070666](https://github.com/sl251/HDS-Android/actions/runs/38388070666)：成功。
- APK：`HDS-Android-0.1.0-preview.4-arm64.apk`，96,354,506 字节（约 91.9 MiB）。
- SHA-256：`c3d97565d7bce10603b17ff66d5006f422335f877499b34e06fa752956910238`。
- 签名证书 SHA-256：`2adf611b828fdbbf530a5a7617a053014b9ec1115e26aac98397fb3037b5709e`，与 preview.1 / .2 / .3 相同，可采用覆盖安装路径。手机升级验收仍待执行。

## 已执行

- 13 项 Node 宿主/角色格式测试通过：真实 Koishi/HDS/SQLite；固定 HTTP 与 SSE 响应；模型分工、原生人设进入请求、提前显示回复、停止与修改后历史保留。
- 40 项 Android JVM 测试通过，0 失败、0 跳过：含模型列表、两种认证协议、404 提示、旧配置迁移与原有 rootfs 安装回归。
- 4 项运行时归档策略测试、TypeScript 检查、前端构建、Capacitor 同步、Kotlin 编译、Android lint、签名打包通过。设备 instrumentation APK 仅编译，未连接手机执行。
- 390px 浏览器布局和交互检查通过，见 [本地检查记录](local-checks.json)。
- APK CRC、运行时 manifest 的 SHA/大小、解包总量、ARM64 运行器哈希、无硬链接依赖、模型预设、YAML ISC 许可材料检查通过，见 [APK 审计](apk-audit.json)。CI apksigner 完整验证 v2 签名；本地再次读取签名块比对证书。

## 未冒充通过的项目

preview.4 Android 真机安装、文件选择器、Keystore 覆盖升级、真实供应商/模型兼容性、后台与 16 KiB 页设备尚未实测。用户反馈 preview.3 可以成功运行，不扩展解释为 preview.4 全功能验收。

QQ 登录、私聊、群聊与空间未接入。构建包来自候选分支，没有自动合并主分支或创建公开 Release。源码归档、SHA256SUMS、测试报告与 APK 在同一 Actions 附件中。
