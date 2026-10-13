# preview.2 输入基线

日期：2026-10-13（Asia/Shanghai）。开始修复时本地与远端 HEAD 均为 `e15efdf322b8bd6ca0c641c2fbed5eaf705497b7`；原工作区只有未跟踪的下一阶段任务包，本轮保留它们。

- 输入 APK：`artifacts/HDS-Android-0.1.0-preview.1-arm64.apk`；95531456 字节；SHA-256 `d6b70ce404c5fa38870434c64759a542994c7e7f113163978b11b2f4cce5ba46`。
- 原构建提交：`f8ab4ee0b848a3d7e0cb50ef73850a6c6e6b9a88`。
- 用户已确认：iQOO 15 / OriginOS 6 / preview.1；Android API、WebView、页大小等仍待新诊断采集。
- 已有问题：环境安装报 `link failed: EACCES`；顶部与系统状态栏重叠。
- 旧归档两条硬链接：`usr/bin/perl5.38.2 → usr/bin/perl`、`usr/bin/uncompress → usr/bin/gunzip`；物化字节为 3944586；旧 manifest 的 expandedBytes 318195691 已包含这些副本。
- 构建工具链沿用：Ubuntu 24.04 / Python 3.12 / Node 24.11.1 / Java 21 / Android SDK 35 / Gradle 8.11.1；包名、签名不变；API 26、ARM64 目标不变。
- 本轮只交付阶段 A 修复候选。N07—N11 人设互通和原计划 QQ/空间尚未实施。

手机证据不能以 Linux 解包或桌面截图替代。设备报告见 `device-report.json`；新 App 可在准备环境前查看、复制或保存诊断。
