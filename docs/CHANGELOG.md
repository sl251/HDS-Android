# 0.1.0-preview.6.2 测试版

- 设置分层折叠，模型连接与任务/生成参数独立收纳。
- 全局自定义字体、字号、背景图片、透明度、模糊与主题，单独持久化。
- App 内故事聊天支持图片、历史预览与主模型视觉输入；QQ 发图后续补。
- 长期事实补充/停用/来源查询、手动整理、完整存档导出恢复、最近本机备份恢复和当前角色重开。
- 存档操作等待正常停机，替换前备份，使用日志和原子卡文件恢复；恢复后默认暂停。
- 版本代码 12，保留包名和预览签名。详细说明及真机验收见 [PREVIEW6-2.md](PREVIEW6-2.md)。

# 模型中心与主分支合并

- 加入供应商预设、模型列表、三类 HDS 模型分工、流式首条回复与 typ0 人设编辑/删除。
- 合并启动修复时保留 main 的宿主 cwd、直接 Node 启动、设备绑定和 OpenSSL 环境；不恢复旧候选的 env 中转启动方式。
- 主分支和模型候选都曾使用 preview.4 标识，历史 APK 请以构建提交和 SHA-256 区分；下方为各阶段修复记录。

# 0.1.0-preview.4 修复候选

- 修复真机启动失败：preview.3 在 PRoot 内启动 Node 时报 `ENOSYS: function not implemented, uv_cwd`。对照同源 proot 二进制的 Operit2 启动配置，宿主侧 cwd 被设在 rootfs 内是根因——Node 在 guest 内 getcwd() 无法解析，返回 ENOSYS。
- 启动侧将 proot 宿主进程 cwd 移出 rootfs（应用 filesDir），guest 内 `-w /opt/hds` 语义不变。
- 去掉 `/usr/bin/env -i` 中转层，直接 exec `/opt/node/bin/node`；环境变量（HOME/PATH/LANG/OPENSSL_CONF 等）改由 ProcessBuilder 宿主环境传递，proot 转发给 guest。
- 补绑 `/dev/pts` 与 `/sys`（Operit2 同款配置）；去掉 `/system`、`/apex`、`/linkerconfig` 绑定，消除 `can't sanitize binding` 警告。
- 不再向 guest 传宿主 TMPDIR（Android 路径在 guest 内不存在），node 回退用 rootfs 自带的 /tmp；PROOT_TMP_DIR 继续服务 proot 自身。
- 版本代码升为 4，保持包名和签名证书。

# 0.1.0-preview.3 修复候选

- 修复真机启动失败：preview.2 在 PRoot 内启动 Node 时，OpenSSL 因 ubuntu-base 根环境缺少 /etc/ssl/openssl.cnf 且 PRoot 无法模拟该文件的打开，报 `BIO_new_file:Function not implemented`，核心进程随即崩溃并触发 90 秒健康检查超时。
- 构建侧在 guest 内固定创建最小合法 /etc/ssl/openssl.cnf（显式激活 default provider），环境归档随之重新打包并更新 manifest 校验和。
- 启动侧为 PRoot 子进程显式设置 `OPENSSL_CONF=/etc/ssl/openssl.cnf` 与 `OPENSSL_MODULES=/usr/lib/aarch64-linux-gnu/ossl-modules`，指向 rootfs 内真实文件，作为双保险。
- 版本代码升为 3，保持包名和签名证书。

# 0.1.0-preview.2 修复候选

- 环境归档将共享 inode 写为独立普通文件；安装器兼容 preview.1 的硬链接，先验证完整条目与链接链，再复制内容、最后创建符号链接。
- 保留执行位；拒绝越界、重复名、符号链接父路径、链接环、缺失目标、特殊文件、超额和截断内容。
- 安装标记与环境文件按同一代目录切换；中断后恢复旧环境，清理不跟随符号链接，清理失败保留已提交的新环境。
- 新增环境更新/修复、取消准备、结构化安装诊断、同 UID 文件能力探针、复制与系统保存诊断。报告不含模型密钥、人设和聊天。
- 原生容器统一处理系统栏、挖孔与键盘空间；关闭 Capacitor 自动边距，网页安全区避免重复留白；底栏高度统一测量。
- 版本代码升为 2，保持包名和签名证书。

本版为阶段 A 候选；iQOO 15 覆盖升级、顶部安全区、键盘、SAF、16 KB 页、后台等尚未实测。现已支持 typ0/HDS 人设导入、编辑和删除；人设导出、QQ/空间及其他未完成目标继续保留。
