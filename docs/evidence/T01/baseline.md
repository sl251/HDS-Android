# T01 首次基线证据

日期：2026-10-13（Asia/Shanghai）。状态：IN_PROGRESS，尚未通过 T01/G0 门槛。

## 已执行

- 五个计划来源均已在本地检出 `sources.lock.json` 中的固定提交；参考源码位于忽略目录 `.references/`。
- HDS `9a77fadb88c6e57914ebac8ca75cf54a27354d01`，版本 `1.0.1-rc51`；未改动其源码、测试或文档。基线工作副本包含全部 340 个受版本控制的文件。
- 使用 TypeScript AST 盘点全部 23 个顶层配置分区和 46 个 `ctx.command` 注册入口，输出 `docs/feature-parity.csv`。这不是移动端支持声明，也不代表已盘点每个嵌套配置字段；表中 `mobile_status` 默认值只是盘点基线，口径见 [feature-parity.md](../feature-parity.md)。
- 上游没有依赖锁文件；本次使用其原始 package.json 生成 `tools/hds-baseline/package-lock.json`。安装关闭生命周期脚本，无浏览器下载或真实模型/QQ 调用。
- 原始 `npm run typecheck` 对应命令：FAIL（exit 2）。`src/service.ts:17` 中 WeatherConfig、WeatherSnapshot 未使用；`src/service.ts:10171` 中 compactUnlocked 未使用。
- 原始 `npm test` 对应命令：FAIL（exit 1）。837 个测试，831 通过、2 失败、4 跳过，0 取消。失败：configuration.test.ts:68 仍断言 rc50；release-consistency.test.ts:21 发现日志设计文档仍写 rc50。这两项在未修改上游工作副本中复现。
- 全新源码 bundle：PASS。esbuild 直接编译 53 个 TypeScript 源文件，外部依赖保持 npm 依赖；实际加载生成 bundle 检查 name、version、Config 和 apply。来源内容哈希及产物哈希见 `bundle.json`。不将上游提交的旧 lib 当构建结果。

## 复现

```powershell
node scripts/prepare-hds-baseline.mjs
npm ci --ignore-scripts --prefix tools/hds-baseline
node scripts/inventory-hds.mjs
node scripts/verify-hds-baseline.mjs
node scripts/build-hds-baseline.mjs
```

运行记录：`results.json`、`typecheck.log`、`test.log`。验证脚本失败时仍完成其他检查并返回非零，不修改断言来制造通过。bundle 测试只证明可从源码编译和加载插件导出，不证明应用宿主、剧情行为、声明输出或手机兼容性。

## SQLite 与运行时发现

本次锁定 Koishi 4.18.11、@minatojs/driver-sqlite 4.7.0。该驱动依赖 @minatojs/sql.js 3.1.0，通过 WASM 加载 SQLite，并非需要 node-gyp 编译的 sqlite3 Node addon。上游测试中真实内存 SQLite 集成已执行。未来 Android rootfs 必须包含其 WASM 资源并验证磁盘持久化、重启和备份；不能据此取消 PRoot、Node、QQ 原生组件的 ABI/页大小验证。

## 未执行与剩余门槛

- 本机 JAVA_HOME 指向 JDK 11，未发现配置的 Android SDK 环境变量或可用 adb；目前不能据此声称已具备可构建 Android 工具链。参考 AGP/Gradle/Kotlin/SDK 版本见 toolchain.lock.json，全部仅作候选。
- APK、应用 UID/SELinux 下的 PRoot/Node/SQLite/HDS、iQOO 15 内存页大小、Linux QQ 注入与空间五类动作：NOT RUN。
- 未登录 QQ、未发送私聊/群消息、未发帖/评论/点赞；测试授权仍待具体账号、对象与内容确认。
- SnowLuma 只作源码阅读和许可证核对，未复制其业务代码、原生附件或发布包进入本仓库。许可证第 4(b) 条及原生附加组件第 5 条需在集成/分发方式确定前核清；当前不能把它作为可自由打包的依赖。
- PRoot/loader 来源已有参考记录，实际构建、资源哈希、Ubuntu/Node/QQ 安装清单、OneBot 与 HTTP 宿主固定依赖、卡规范提交锁定仍待补齐。

下一步：补齐 Android 工具链与二进制来源清单，制作最小 probe APK，再连接 iQOO 15 做 T02。T03 必须保留真实空间能力验证，G0 仍未通过。
