# Preview 9.1 M0 验证记录

日期：2026-10-17；分支 main；未 commit，未暂存。本次完成 rc56 导入、移动补丁重放、20/10 安全默认、runtime 重新构建和可运行测试。Android 单元测试因本机缺少 Java/JDK 未启动，不能据此声明全仓所有平台验收均已完成。

固定 tag `1.0.1-rc56` 解引用提交：`b683bafcac42c99a45929e0516195f033f969665`。vendor 从 Git archive 导入全部 288 个文件，保留原包、文档、测试和 LICENSE。53 个 src 文件中，48 个与原始 rc56 逐字节相同，仅 endpoints.ts、index.ts、narrator.ts、service.ts、types.ts 叠加移动补丁；另有一处测试时钟适配。全部差异均可从纯 rc56 用两个补丁文件精确重放，重复应用保持幂等。

补丁明细、落点、冲突取舍及对 MOBILE-PATCHES.md 的增补见 [M0 完整重放记录](../MOBILE-PATCHES.md#preview-91-m0--rc56-基线与完整重放)。完整来源哈希、生成产物哈希及白名单/根依赖不变断言在 [provenance.json](../../artifacts/preview9.1-m0/provenance.json)。根 package.json、package-lock.json 未变化；上游 package.json 仅版本 rc51→rc56，依赖声明相同。

安全默认的全部业务代码差异：

```diff
 runtime: { ...sections.runtime, autoCreate: true, autoAdvanceEnabled: autoAdvance, allowProactiveMessages: autoAdvance,
   userMessageDebounceSeconds: 1, typingMaxDelaySeconds: 12,
+  contextEntryLimit: 20, contextTimeWindowMinutes: 10,
```

`runtime/generated/host.cjs:21791` / `21792` 同样显式写入 20/10。真实 startHost 实例的 config.runtime 已有断言；设置 schema 不包含两字段，直接注入拒绝，预设同步剔除，原 supportedFields 字段列表逐字不变。上游 schema 的 35/45 和内部 `?? 60` 保留原样，实际宿主配置有明确值，故不取其 fallback。host.cjs / qq.cjs 已生成，沿用原 .gitignore，不会出现在默认 git status。

三处版本引用更新：

```diff
# docs/MOBILE-PATCHES.md
-HDS 原始版本为 1.0.1-rc51，固定提交 9a77fadb88c6e57914ebac8ca75cf54a27354d01。
+HDS 原始版本为 1.0.1-rc56，固定提交 b683bafcac42c99a45929e0516195f033f969665。
# docs/THIRD_PARTY.md（来源表）
-| ISEKAI-MomoiCore/HDS-Interlude | 9a77fadb88c6e57914ebac8ca75cf54a27354d01 |
+| ISEKAI-MomoiCore/HDS-Interlude | b683bafcac42c99a45929e0516195f033f969665 |
# docs/feature-parity.md（AST 来源）
-9a77fadb88c6e57914ebac8ca75cf54a27354d01
+b683bafcac42c99a45929e0516195f033f969665
```

原始完整 diff 见 [versions.diff](../../artifacts/preview9.1-m0/versions.diff)。AST 机械盘点命令为 `node scripts/inventory-hds.mjs /tmp/hds-m0-rc56/src/index.ts`，输出仍为 23 个分区、46 个命令；按 kind/feature 回填原人工状态/证据，仅更新版本标注、上游描述及位置。weather 是新增预设同步允许项，原本已是顶层配置，因此盘点总数不变。

| 命令（根目录执行，除特别标注） | 最终结果 | 日志 |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=1 test/*.test.ts`（cwd: upstream/hds-interlude） | 907 项：903 pass、0 fail、4 skip，exit 0 | [上游全量](../../artifacts/preview9.1-m0/hds-m0-upstream-final.log) |
| `npm test` | build:host 成功；73 pass、0 fail、0 skip，exit 0 | [移动端全量](../../artifacts/preview9.1-m0/hds-m0-mobile-final.log) |
| `HDS_BROWSER_LOW_RESOURCES=1 HDS_BROWSER=/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome npm run test:ui`（预先启动 npm run dev） | story-ui.mjs、m5-ui.mjs 均 PASS，exit 0；浏览器和本次 Vite 已关闭 | [浏览器回归](../../artifacts/preview9.1-m0/hds-m0-ui-final.log) |
| `npm run build` | 前端 tsc、Vite PASS | [构建](../../artifacts/preview9.1-m0/hds-m0-build.log) |
| `python3 tests/runtime-pack.test.py` | 5/5 PASS | [打包测试](../../artifacts/preview9.1-m0/hds-m0-runtime-pack.log) |
| `python3 tests/guest-openssl-config.test.py` | 4/4 PASS | [OpenSSL 测试](../../artifacts/preview9.1-m0/hds-m0-openssl.log) |
| `timeout 90s node --max-old-space-size=512 node_modules/typescript/bin/tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --noUnusedLocals --noUnusedParameters upstream/hds-interlude/src/index.ts` | 源码类型检查 PASS，exit 0（绕过未随包提供的 Koishi monorepo tsconfig） | [类型检查](../../artifacts/preview9.1-m0/hds-m0-engine-typecheck-final.log) |
| `./gradlew --no-daemon testReleaseUnitTest`（cwd: android） | 未启动测试，exit 1：JAVA_HOME 未设置且 PATH 无 java | [Android 环境失败](../../artifacts/preview9.1-m0/hds-m0-android-tests.log) |

4 项 skip 是上游 model-behavior 的真实模型测试，未设置所需凭据；没有改跳过规则或使用付费模型。此前并行尝试受单 CPU、默认约 256 MB Node 堆限制，出现 SSE/定时/浏览器超时和额外 tsc OOM；这些尝试日志保留在 artifacts/preview9.1-m0，最终以表中串行结果为准。实际兼容问题通过原函数体内的关停追踪、可选配置默认回退和测试时钟适配修复；全部上游断言保留。

风险/范围：Urge 五档节奏及密度乘法会改变后台推进频率；群聊 auto 的三态映射、天气幻想世界门禁、QQ 传输超时语义沿用 rc56；Alter maxTokens 默认 400→2000、上限 2000→16000，需关注分析开销。预设中的 weather 和两个上下文字段仍过不了移动白名单。QQ 主动好友初始化、贴纸 HTTP 回源、QQ 出站语音属于后续里程碑，M0 没有把它们声明为可用。Android/真实 QQ/真实模型表现仍待对应环境验证。

工作区概览（`git status --short`，完整清单见 [git-status.txt](../../artifacts/preview9.1-m0/git-status.txt)）：{' M': 84, ' D': 71, '??': 26}；其中 vendor 路径 158 行，其余为宿主/脚本/文档/测试及 7 个任务开始前已有的未跟踪文件。两份 .cjs 为忽略产物；未暂存、未提交。
