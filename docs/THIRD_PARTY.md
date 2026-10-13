# 第三方来源

本仓库当前提交计划、基线脚本、依赖清单和验证证据。参考仓库检出、HDS 工作副本、node_modules 和生成 bundle 在忽略目录中。未包含 SnowLuma 代码/原生组件、Linux QQ 或 PRoot 二进制。

`tools/hds-baseline/package.json` 原样取自 HDS 固定提交，用于复现依赖。`feature-parity.csv` 的功能名称和说明来自相同 HDS 源码；保留其上游归属和 AGPL 声明。

| 来源 | 固定提交 | 声明/记录位置 |
| --- | --- | --- |
| ISEKAI-MomoiCore/HDS-Interlude | 9a77fadb88c6e57914ebac8ca75cf54a27354d01 | AGPL-3.0；原文在 legal/HDS-Interlude-AGPL-3.0.txt |
| dphmoblie/deepseek-harness-android | 14a21621fa25e204d7218d37e193d9b861b837a8 | MIT；其 THIRD_PARTY_NOTICES.md 分别记录附带运行时来源 |
| MuFengDR/AstrBot-Bubble-Android-App | f54ed74930683ac9f8ef76390f53980e2d537cb5 | BSD-3-Clause；本次未复用代码 |
| zz6zz666/AstrBot-Android-App | 7ea03f0be5e3d780394f35959aac23ad13a772ee | 固定树只含 README，未据此复制历史代码 |
| SnowLuma/SnowLuma | 87527cb7641a5a42f8f0efb73cb066102e004dee | Source-Available Non-Commercial License；仅阅读，不构建或打包 |

完整源地址在 `HDS-Mobile-Plan/sources.lock.json`。当前清单是实施前的调查记录，不是发布合规结论；各 npm、Ubuntu、原生运行时和 QQ 组件须在实际选用后补齐对应来源、许可证文本与构建方式。
