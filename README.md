# HDS Android

将 HDS-Interlude Koishi 插件移植到 Android，在手机本地运行核心与 QQ 通道，通过用户配置的模型 API 推进叙事。

## 当前状态

正在构建 `0.1.0-preview.1` ARM64 开发预览版（Android 8 / API 26 起）。已实现 Kotlin/Capacitor 管理界面、手机内 Ubuntu/Node/Koishi/HDS rc51 宿主、JSON/PNG 角色卡导入、本地聊天与剧情查看。模型 API 由用户配置；运行环境随 APK 内置。

QQ 私聊、群聊、QQ 空间尚未接入；这次交付不代表完整首版验收通过。Android 真机、后台存活和 16 KiB 页面设备仍需测试。测试步骤与已知边界见 [真机测试清单](docs/TEST-ON-PHONE.md)。

首版目标包括 QQ 私聊、群聊、QQ 空间动态，以及实际进入 HDS 叙事的角色卡导入。优先保留原版 HDS 核心，采用 Kotlin、Capacitor/React、PRoot/Ubuntu ARM64 与 Node/Koishi 的方案。

## 开始实施

先阅读 [任务总览](HDS-Mobile-Plan/00-START-HERE.md) 与 [交接提示词](HDS-Mobile-Plan/06-HANDOFF-PROMPTS.md)，按 T01—T03 推进源码基线、工具链、手机运行和 QQ/空间验证。

- [源码调查](HDS-Mobile-Plan/01-RESEARCH.md)
- [架构与接口边界](HDS-Mobile-Plan/02-ARCHITECTURE.md)
- [角色卡导入](HDS-Mobile-Plan/03-CARD-IMPORT.md)
- [实施任务](HDS-Mobile-Plan/04-TASKS.md)
- [验收标准](HDS-Mobile-Plan/05-ACCEPTANCE.md)
- [固定来源](HDS-Mobile-Plan/sources.lock.json)

上游源代码与运行时分别遵守其各自许可证。HDS 固定源码及窄范围补丁位于 `upstream/hds-interlude`，运行时来源和校验值在 `runtime/sources.lock.json`；未复制或打包 SnowLuma、Linux QQ。

## 构建预览版

```sh
npm ci --ignore-scripts
npm test
npm run build
npx cap sync android
python3 scripts/build-runtime.py
cd android
./gradlew lintRelease testReleaseUnitTest assembleRelease
```

Android 打包需 Linux、Python 3.12、Node 24.11.1、Java 21、Android SDK 35。签名配置通过 `HDS_SIGNING_STORE` 和 `HDS_SIGNING_PASSWORD` 提供，私钥不提交到 Git。私有仓库 Actions 可复现完整流程并保存测试日志、签名验证、运行时清单和 APK。已授权的本机签名材料在忽略目录 `.tools`，升级时需复用并自行备份。

## 复现 HDS 基线

需要 Git、Node.js 24.11.1 和 npm 11.6.2；在仓库根目录执行：

```powershell
node scripts/prepare-hds-baseline.mjs
npm ci --ignore-scripts --prefix tools/hds-baseline
node scripts/inventory-hds.mjs
node scripts/verify-hds-baseline.mjs
node scripts/build-hds-baseline.mjs
```

原始检查存在已记录的失败，因此 `verify-hds-baseline.mjs` 当前返回非零；原因与测试数量见 [基线报告](docs/evidence/T01/baseline.md)。`build-hds-baseline.mjs` 直接从源码打包并检查插件导出，尚不包含声明文件或 Android 宿主。

[功能盘点](docs/feature-parity.csv) 保留完整产品目标的基线，当前预览版仅覆盖上述本地链路。HDS 来源和许可证见 [第三方说明](docs/THIRD_PARTY.md)，源码修改见 [移动补丁说明](docs/MOBILE-PATCHES.md)。
