# 0.1.0-preview.2 阶段 A 候选证据

日期：2026-10-13（Asia/Shanghai）。源代码构建提交 `6d7f2d4f90b39319850941d560d14bc05561da1e`；[Actions 38351683644](https://github.com/sl251/HDS-Android/actions/runs/38351683644) 全部通过。最终文档提交可晚于该源码提交；APK 与源码附件固定在该构建 SHA，不将工作区 HEAD 混作构建 SHA。

## 验证结果

- 实际 Koishi/HDS/SQLite 宿主与酒馆卡：5 PASS，0 FAIL；合成角色与固定模型响应，无用户付费 API 请求。
- Linux 归档构建测试：4 PASS，0 FAIL（本地 Windows 不具备符号链接创建条件，3 项仅在 CI 执行）。
- Android JVM 安装/恢复回归：24 PASS，0 FAIL，0 IGNORED。包含 preview.1 原 APK 哈希锁定、真实 rootfs 解包、两条旧硬链接文件内容/执行位、前向链、环、缺失、越界、重复、symlink 父路径和链穿越、配额、截断、取消、模拟进程死亡窗口、激活失败回滚、只读清理与清理失败保持新代。
- TypeScript/Vite、Capacitor 同步、Kotlin/Java 编译、lintRelease、assembleRelease：PASS。
- 应用的 debug 仪器测试 APK 编译：PASS；两项应用 UID 测试**未执行**。全局 assembleAndroidTest 会触发依赖库模板测试的 Kotlin 冲突，工作流使用 `:app:assembleDebugAndroidTest`，只打包应用测试。
- 本地再次复核：APK ZIP CRC、manifest 压缩/展开长度、rootfs SHA-256、两份 ARM64 ELF SHA-256、原生 Insets 配置与新 CSS 均 PASS。

## 候选包

- 文件：`artifacts/HDS-Android-0.1.0-preview.2-arm64.apk`，96302928 bytes（约 91.8 MiB）。
- APK SHA-256：`2b38754fe62bec298ec7127148eb088a5f1ddcdb234901eab34f8e38c8885aaf`。
- APK v2 签名：CI apksigner 验证 PASS；本地独立解析签名块证书 SHA-256 为 `2adf611b828fdbbf530a5a7617a053014b9ec1115e26aac98397fb3037b5709e`，与 preview.1 交付证书一致。包名保持 `io.hdsinterlude.android`，versionCode=2，versionName=0.1.0-preview.2；具备覆盖升级条件，实际手机覆盖升级仍 NOT RUN。
- rootfs 共 12961 条：10463 普通文件、2298 目录、200 符号链接、**0 硬链接**；没有通过展开所有符号链接来移除硬链接。
- 同构建源码：`artifacts/HDS-Android-0.1.0-preview.2-source.tar.gz`；摘要清单：`artifacts/SHA256SUMS-preview.2.txt`。
- 完整静态审计：[apk-audit.json](apk-audit.json)；原始日志/签名/测试报告可从上述 Actions artifact 下载。

## 手机与剩余范围

iQOO 15 / OriginOS 6 未连接。本次不能确认 Android UID 内实际安装、PRoot/Node、SQLite、HDS 健康、既有剧情升级、Insets/IME、大字体、SAF、后台与 16 KB 页。详见 [device-gates.json](device-gates.json) 和 [TEST-UPGRADE.md](TEST-UPGRADE.md)。环境文件就绪与 HDS 健康为不同状态。

N01 已固定输入，N02—N05 为实现及构建/回归通过、手机门槛待验收；N06 交付候选，未标整阶段真机 PASS。N07—N11（typ0/HDS 双格式导入、映射、导出、旧库迁移）未实施；原计划 QQ 私聊/群聊/空间和完整首版要求仍未完成。逐项状态见 [task-status.csv](task-status.csv)。

候选沿用原签名，测试时保留旧 App 与数据，按覆盖升级步骤操作。运行环境、角色/剧情和密钥目录分离，修复逻辑不清用户资料。未合并主分支，未发布新 Release。
