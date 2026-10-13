# 源码调查与参考选择

调查日期：2026-10-13。下列结论来自固定提交的文件阅读，未执行仓库脚本、未构建参考应用、未登录 QQ、未操作真实账号。

## 1. 固定基线

| 仓库 | 提交 / 版本 | 结论 |
|---|---|---|
| [HDS-Interlude](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/tree/9a77fadb88c6e57914ebac8ca75cf54a27354d01) | `9a77fadb88c6e57914ebac8ca75cf54a27354d01` / `1.0.1-rc51` | 移植的行为基线 |
| [deepseek-harness-android](https://github.com/dphmoblie/deepseek-harness-android/tree/14a21621fa25e204d7218d37e193d9b861b837a8) | `14a21621fa25e204d7218d37e193d9b861b837a8` / `0.2.13` | Kotlin/Capacitor、运行时安装监管和原生桥接参考 |
| [AstrBot-Android-App](https://github.com/zz6zz666/AstrBot-Android-App/tree/7ea03f0be5e3d780394f35959aac23ad13a772ee) | `7ea03f0be5e3d780394f35959aac23ad13a772ee` | 当前检出的代码树只有 README；不能当作完整源码模板 |
| [AstrBot-Bubble-Android-App](https://github.com/MuFengDR/AstrBot-Bubble-Android-App/tree/f54ed74930683ac9f8ef76390f53980e2d537cb5) | `f54ed74930683ac9f8ef76390f53980e2d537cb5` / pubspec `0.1.0-beta5.5+5` | Flutter 壳、Linux QQ/NapCat、多账号和安装流程参考 |
| [SnowLuma](https://github.com/SnowLuma/SnowLuma/tree/87527cb7641a5a42f8f0efb73cb066102e004dee) | `87527cb7641a5a42f8f0efb73cb066102e004dee` / release `v1.14.22` | HDS 空间接口所依赖的候选后端；ARM64 有发行包，但安卓未验证 |

后续可以升级基线，但必须先记录差异、重新跑回归，不要实现期间自动跟随 master/main/latest。

## 2. HDS 中已经存在什么

源码路径均相对于上表 HDS 提交。

| 文件 | 已核实职责 | 移植处理 |
|---|---|---|
| `package.json`, `src/index.ts` | TypeScript Koishi 插件；运行所需 `database`、`http` 服务；puppeteer/server 可选 | 构建真实 Koishi 宿主，不能用浏览器 JS 直接加载 |
| `src/service.ts` | 故事生命周期、消息受理、Koishi 数据库与任务调度密切耦合 | 首版保持主体，通过窄接口扩展 |
| `src/narrator.ts`, `src/model-routing.ts` | 模型调用、上下文与任务模型路由 | 复用并保留主模型/压缩/视觉等配置 |
| `src/turn-engine.ts`, `src/delivery.ts`, `src/turn-persistence.ts` | 回合取代、提交边界、投递账本 | 做差分回归，禁止在 UI 层绕开 |
| `src/scheduler.ts`, `src/time.ts` | 到期唤醒、互斥、退避、时间处理 | 测量后台与重启语义 |
| `src/database.ts`, `src/story-state.ts` | Minato 表结构与版本化状态 | HDS 数据库由宿主独占写入 |
| `src/agency.ts`, `src/urge.ts`, `src/alter.ts` | 主动行为和设定演化相关策略 | 保留并提供设置/状态入口 |
| `src/schedule-preplan.ts`, `src/world-seeder.ts`, `src/long-arc.ts` | 日程、世界事件与长期叙事指导 | 纳入首版功能盘点 |
| `src/endpoints.ts`, `src/group-willingness.ts` | 端点身份、多通道与群回复门控 | 对账号、参与者和渠道分别建模 |
| `src/qzone.ts` | SnowLuma 扩展动作、限流、审计、未知结果处理 | 必须验证真后端，不能使用普通 QQ 聊天测试替代 |
| `src/share-sync.ts` | HDS 分享码和预设分区清洗、应用与回滚 | 与 Tavern 角色卡导入分开实现 |
| `src/desktop-bridge.ts` | typ-0 worker 的 Node IPC 桥接 | 可借鉴 DTO/事件；不是现成 REST 服务 |
| `src/health.ts`, `src/logging.ts` | 健康度与日志 | 手机 UI 提供脱敏、有限长度的诊断 |

`src/types.ts` 中 StorySetting 将角色、用户、关系、世界、价值观、配角、地点、文风和时区分开。角色卡不能只把所有字段拼成一个 system prompt。

在已检索 `src` 中没有发现 Tavern V2/V3 PNG 解析和 `character_book` 导入实现。因此卡格式兼容是新增工作；已有分享码不等于已经支持角色卡。

`getCanonicalStory()` 会保留一个活动故事并归档其他活动故事；多角色并行不能假设现成支持。首版使用角色库 + 活动故事选择，角色的历史状态分开存放。

## 3. 三个容易误判的边界

**桌面桥接。** `installDesktopBridge()` 要求环境变量 `HDSI_DESKTOP_BRIDGE=1` 且存在 `process.send`。它使用 Node IPC，具有 phase/inbound/snapshot/timeline 等能力。后台投递包装中存在 `onebot:<selfId>`、`onebot-external` 假设。首版 QQ 模式应优先使用普通 Koishi OneBot adapter；手机管理 API另做受控 façade，不能把桌面桥直接当通用手机通道。

**语音。** rc51 README 描述的是接收 QQ 语音、由后端转码并交给支持原生音频的模型，不是一个现成 TTS 播放系统。保留这一功能需要验证 QQ 语音下载、SILK 转码与模型能力；不支持时必须按基线记录占位/错误状态。

**构建。** HDS 没有可直接假设存在的 `npm run build` 脚本。`scripts/ensure-fresh-bundle.mjs` 检查生成 bundle，提示 Yakumo 工作区构建。实施时需建立可复现的构建入口并确认产物实际包含修改；不得只跑类型检查后包装旧的 `lib/index.js`。

## 4. QQ 空间的确切依赖

HDS 调用的关键动作包括 `get_qzone_msg_list`、`get_qzone_feeds`、`send_qzone_msg`、`comment_qzone`、`like_qzone`。它还将好友动态、自己的评论数变化等材料加入剧情；单有“发一条说说”不满足保真目标。[HDS 设计](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/blob/9a77fadb88c6e57914ebac8ca75cf54a27354d01/docs/QZONE_FEED_DESIGN.md)

上游文档本身也列有未实测范围，不能将这些描述算成本项目测试结果。适配器要分别报告各动作的“已验证/未验证/不支持”，而非一个笼统的 `connected=true`。

SnowLuma 的 Android 文档明确指出 PRoot 与 ptrace 注入可能冲突。Android 上的 PRoot root 身份不等于主机 Root；不能把 guest 中执行 setcap 成功当作拿到了主机注入能力。[安卓说明](https://snowluma.github.io/en/docs/guide/deploy/mobile)、[Linux 部署说明](https://snowluma.github.io/en/docs/guide/deploy/linux-manual)

候选路线：先在用户设备验证未修改的 SnowLuma ARM64 正式包；若失败，调查具备同等动作的本地 OneBot 实现或有权使用的兼容扩展。NapCat 的私聊/群聊成功只算部分验证。不得把远程 SnowLuma 作为满足“手机独立”的默认解法。

## 5. 参考仓库怎样使用

### DeepSeek 安卓仓库

采用 Capacitor 7、React 18、Kotlin；参考提交 minSdk 26、target/compile 35，仅 ARM64。参考目录：

- `android/app/src/main/java/io/deepseekharness/mobile/runtime/RuntimeStore.kt`、`RuntimeHost.kt`、`MobileRuntimeController.kt`：安装状态和生命周期。
- 同目录 `RootfsIntegrity.kt`、`ArchivePathPolicy.kt`、`RuntimeCredentialCipher.kt`：资源校验、路径边界、凭据存储。
- `HarnessActivity.kt`、`HarnessKeepAliveService.kt`、`MobileRuntimePlugin.kt`：WebView、前台服务与 JS 桥。
- `scripts/build-embedded-runtime.py`、`scripts/prepare-runner.mjs`：运行时与原生 runner 的构建来源。
- `THIRD_PARTY_NOTICES.md`、`android/app/build.gradle`：不能忽略的组件来源与打包要求。

该项目的原生 runner/rootfs 产物和 Gradle wrapper JAR 并非都已提交；构建还硬性依赖其团队签名。新项目必须有自己的包名、debug/release 签名及 wrapper，不应照抄后向原作者索要私钥。README 与 Android README 的 JDK 描述也不完全一致，T01 必须根据实际 Gradle/AGP 锁定可用工具链。

保留运行管理的思路与适用代码；去掉 dsh 业务、Shizuku、无障碍、设备 Shell、应用清单读取等非需求模块。不要直接把 dsh 目录更名为 HDS 后宣称完成移植。

### AstrBot Bubble

参考 `pubspec.yaml`、`lib/core/constants/scripts.dart`、`lib/core/config/service_ports.dart`、`lib/core/services/foreground_service.dart`、`assets/astrbot-startup.sh` 与 `assets/astrbot-installer-bootstrap.sh`。

它补充了 Linux QQ ARM64、NapCat、分步安装与多账号配置的工程样例。Bootstrap 会取外部安装脚本，因此仓库当前文件并不等于最终运行的所有脚本。新项目应锁定自己的安装资源与签名，不执行未经核实的 latest 安装链。Flutter 实现只作流程/逻辑参考，不与 Capacitor 同时堆叠两套产品 UI。

## 6. 依赖与分发记录

| 组件 | 本次查到的声明 | 实施要求 |
|---|---|---|
| HDS | AGPL-3.0 | 保留来源、修改与对应源码交付安排 |
| DeepSeek 安卓应用代码 | MIT | 保留适用声明，区分其运行时附带组件 |
| Bubble | BSD-3-Clause | 保留声明，逐项核对 git/native 依赖 |
| 原 AstrBot README | 声称 BSD-3-Clause；当前树无独立 LICENSE | 不据此替历史代码作完整授权判断 |
| PRoot/参考 runner | 多种 GPL/AGPL/LGPL 来源记录 | 按实际采用的构建产物收集来源、许可证与构建方法 |
| SnowLuma | 源码可见、非商业许可；原生附加组件另有限制 | 分发与派生项目用法单独核清；不复制其受限代码作为默认计划 |
| Linux QQ | 独立第三方客户端 | 核对下载和随包分发条件，不能假定能随意重分发 |

这里只记录原文和工程待办，不将不同许可证“合并宣布为 MIT/AGPL”。SnowLuma 相关疑点优先在 T01 查清，不能拖到打包完成后才发现不可分发。

## 7. 外部规范来源

- [Character Card V2 规范](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md)
- [Character Card V3 规范](https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md)
- [Android 文件选择与 SAF](https://developer.android.com/training/data-storage/shared/documents-files)
- [Android 前台服务类型](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [WorkManager 周期任务](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)
- [Android 16KB 内存页变化](https://developer.android.com/about/versions/15/behavior-changes-all#16-kb)
- [NapCat Shell 部署](https://napneko.github.io/guide/boot/Shell)

T01 应为卡格式规范再固定提交。官方在线文档属于滚动资料，实施时检查变更。本计划不以社区转载替代上游源码和官方说明。
