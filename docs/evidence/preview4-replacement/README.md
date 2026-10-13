# HDS Android 0.1.0-preview.4 候选版（替换版）

**原 preview.4 已废弃，请重新下载本页 APK。** 本页现使用 PR #2 合并候选，包含模型中心、人设管理及主分支的启动/OpenSSL 修复。开发候选仍需真机验证，不代表完整稳定移植或 QQ 已接入。

## 新增功能

- 供应商预设、获取/搜索模型列表、手动填写模型及当前连接测试。
- 原 HDS 主叙事、记忆压缩、Alter 模型分工；备用切换和流式首条完整回复。
- typ0 下载的 koishi.yml / HDS JSON 导入，人设编辑与删除；编辑保留历史，删除为移出角色库。
- 保留 main 的环境外宿主 cwd、直接启动 Node、设备绑定及 OpenSSL 配置。

## 下载与覆盖安装

安装 `HDS-Android-0.1.0-preview.4-arm64.apk`（ARM64，Android 8+）。同一包名、versionCode 4、同一签名，可走覆盖安装路径；不要先卸载，以免丢失故事。相同版本号下请按校验值区分文件，手机端覆盖安装仍需验证。

**新 APK SHA-256：**
`30de39b1333d813f4c15d02e3a681ba52cfd717246fa3e5cdd92005b5cb9217d`

已废弃的旧 Release APK：`73ceba45b126969058643c83fcfc9f06b390ee0acc5f9c89c3e8d30c321f8944`。
此前未合并的模型候选 APK `c3d97565d7bce10603b17ff66d5006f422335f877499b34e06fa752956910238` 也由本页替代。旧附件不再作为本版本下载。

## 构建与验证

- 构建源码与本版本标签：`68306e175d3d060b663e06d3ad53f610128e4d0d`；与 main 合并提交 `55e134e9574dc96699f5a5fb86bda0332835c590` 的文件树相同。
- [完整 Actions 构建](https://github.com/sl251/HDS-Android/actions/runs/38389544575)：成功。
- 13 项宿主/格式测试、40 项 JVM 测试，以及归档/OpenSSL 检查、Android lint 与签名打包通过。固定模型测试不代表真实供应商和真机均已通过。
- 本地复核 APK CRC、运行时哈希、原生库、OpenSSL 配置和签名证书通过。证书与旧版一致。
- 附件提供应用源码、PRoot/talloc 来源与构建材料、校验表、运行时清单和测试说明。

QQ 登录/扫码、群聊和空间仍未接入，计划见仓库 QQ-ROADMAP。导入 YAML 仅采用人设字段，不导入其中的模型密钥或 QQ 配置。

原 tag 曾指向 `8ab53cd2e360a6d16e254fa2c1b3bb6417eb83bb`，本次按仓库所有者要求替换为上述合并候选；旧提交仍保留在仓库历史中。

[当前 Release 下载](https://github.com/sl251/HDS-Android/releases/tag/v0.1.0-preview.4)
