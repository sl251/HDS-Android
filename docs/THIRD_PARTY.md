# 第三方来源

本仓库提交计划、基线脚本、Android 宿主和固定 HDS 1.0.1-rc56 源码。参考仓库检出、node_modules、生成 bundle、运行时二进制与签名材料在忽略目录中。APK 构建时内置 Ubuntu ARM64、Node、HDS 和 PRoot/loader。未包含 SnowLuma 代码/原生组件或 Linux QQ。

`tools/hds-baseline/package.json` 保留初始 rc51 基线清单，用于复现历史依赖；本次 rc56 的依赖声明与 rc51 相同，仅上游包版本变化。`feature-parity.csv` 的功能名称和说明来自相同 HDS 源码，由 TypeScript AST 机械盘点生成；其 `mobile_status` 默认值为盘点基线而非移动端支持声明，口径见 [feature-parity.md](feature-parity.md)。保留其上游归属和 AGPL 声明。

| 来源 | 固定提交 | 声明/记录位置 |
| --- | --- | --- |
| ISEKAI-MomoiCore/HDS-Interlude | b683bafcac42c99a45929e0516195f033f969665 | AGPL-3.0；原文在 legal/HDS-Interlude-AGPL-3.0.txt |
| dphmoblie/deepseek-harness-android | 14a21621fa25e204d7218d37e193d9b861b837a8 | MIT；其 THIRD_PARTY_NOTICES.md 分别记录附带运行时来源 |
| MuFengDR/AstrBot-Bubble-Android-App | f54ed74930683ac9f8ef76390f53980e2d537cb5 | BSD-3-Clause；本次未复用代码 |
| zz6zz666/AstrBot-Android-App | 7ea03f0be5e3d780394f35959aac23ad13a772ee | 固定树只含 README，未据此复制历史代码 |
| SnowLuma/SnowLuma | 87527cb7641a5a42f8f0efb73cb066102e004dee | Source-Available Non-Commercial License；仅阅读，不构建或打包 |

实际运行时固定来源在 `runtime/sources.lock.json`。PRoot 为 GPL-2.0-or-later，其 Android 构建来自 Operit2（AGPL-3.0）固定提交 `dc4c3a9405dc7ed3ef69b2ac9a6ace65374d77cf` 的 `tools/android-runtime/`，包含 Termux PRoot 5.1.107.78 与 Android 补丁。两个导入 ELF 均验证 SHA-256；本仓库不宣称逐字节重建这些 ELF。

参考 APK 整体哈希通过后，实际解出的 PRoot 哈希为 `07ef0b01a1506a364c9db3e5fe6ac9a530974371f9838bc7a5c6abb5097b4c78`；其内置说明仍列出另一个构建输入哈希。清单保留两者，不宣称二进制相同。PRoot/talloc 源码、固定 Operit 补丁与构建脚本由 `scripts/prepare-runner-source.mjs` 单独归档为发布附件。

构建脚本将参考运行器的法律材料、Ubuntu copyright、Node LICENSE、HDS AGPL 和实际 guest npm 许可证加入 APK `assets/legal/`。Capacitor/React 是 MIT；Kotlin/AndroidX/Commons Compress/IO 为 Apache-2.0。npm 精确依赖见两个 package-lock.json。

分发时应同时保留完整对应源码及构建材料；仅提供上游链接或提交号不等于完整对应源码。当前版本是用户私有仓库内的测试预览，不声明公开分发的合规审查已完成。

preview.4 新增 YAML 解析依赖 `yaml@2.9.1`（ISC，作者 Eemeli Aro），锁定在 package-lock.json；其许可证随前端依赖打包到 APK legal/npm/yaml。RikkaHub、ChatterUI 与 typ0 仅作为行为和格式参考，未复制其实现。

preview.5 新增 `koishi-plugin-adapter-onebot@6.9.5`（MIT）与 `qrcode@1.5.4`（MIT），许可证随 guest npm 包收录。Ubuntu ELF 链接依赖固定在 `runtime/qq-libs.lock.json`，各自 copyright 随 APK 收录。

QQ 组件由用户点击后从官方来源下载，不随 APK 内置：Linux QQ 3.2.34-53644（腾讯专有软件）；NapCat.Shell v4.18.38（Copyright © 2024 Mlikiowa，[Limited Redistribution License](https://github.com/NapNeko/NapCatQQ/blob/bbd0d2aca3d470c20b33b1d4f95123335633bf26/LICENSE)，含非商业限制）。包保留原样，不修改、公开发布其修改版或混同为 AGPL/MIT。版本、官方 URL 与 SHA-256 见 `runtime/qq-components.ts`；本项目不授予这些组件额外使用权。

Preview 9.1 M3 新增 `silk-wasm@3.7.1`（[idranme/silk-wasm](https://github.com/idranme/silk-wasm)，npm 包许可证为 MIT，Copyright © 2024 idranme），锁定于宿主与 guest 两份 package-lock.json。发布包中的 `lib/silk.wasm` 随依赖保留，guest 构建现有许可证收集步骤将包内 LICENSE 纳入 APK legal/npm/silk-wasm。该依赖不需要 ffmpeg 或特定 CPU 架构的 Node 原生插件。
