# 移动宿主与上游边界

HDS 原始版本为 1.0.1-rc51，固定提交 9a77fadb88c6e57914ebac8ca75cf54a27354d01。原始 AGPL LICENSE 和文档保留；宿主不重写叙事协议、事实提交或记忆层。

- endpoints.ts、types.ts、service.ts：增加 local 通道类型，mobile-local 端点不冒用 QQ 身份。
- narrator.ts：增加可选角色卡上下文钩子。原始引擎系统指令保持第一条，角色/示例/世界书与引擎契约分开，creator_notes 不注入。
- service.ts：开场白以幂等 character-message 进入真实剧情；关停前暂停调度并等待进行中的流式叙事、串行任务与端点/数据库写队列，避免数据库卸载后仍写快照。
- runtime/host.ts：创建真实 Koishi、SQLite WASM 与 HDS 插件，提供限于本机的令牌鉴权 RPC、本地消息投递回执、持久入站 requestId。API 密钥通过 stdin 传入，不放进命令行参数。

`scripts/vendor-hds.mjs` 重新导入会覆盖补丁，请先保留 Git 差异。JSON/PNG 卡的原始文件与未知字段保留；世界书当前支持常量/关键词/次级关键词、顺序与预算，不执行正则或扩展脚本，完整递归规则、CHARX、压缩 PNG 元数据尚未实现。

自动测试使用固定模型响应验证真实引擎，不等同于付费模型服务实测或 Android 真机验收。原始 HDS 基线的已知失败见 docs/evidence/T01/baseline.md；没有为获得通过而改写原始断言。

preview.4 的模型分工直接使用原 HDS provider flags / failover / SSE 路由。typ0 人设使用原生 storyDefaults 和 updateSetting，Tavern 继续使用上下文钩子；不整体升级 rc51。

Preview7：复用原版 sidecar/native 识图路由，原生桥接新增图片压缩、外观文件与故事存档事务。见闻管理复用原版事实、待办、overlay 和 compact API；`mobileManageFact` 在修改前失效旧叙事工作并刷新连续性缓存。详见 `docs/PREVIEW7.md`。


## preview.8 model request budget

`src/narrator.ts` adds an optional mobileBeforeRequest hook before embedding, plain/proxy JSON and streaming model transports. The Android host installs a persistent rolling 24-hour limiter; ordinary upstream use leaves the hook unset. Direct user-message narrative requests pass foreground=true. Manual compaction uses a scoped asynchronous exemption that expires on completion. Budget errors abort provider retries without changing model credentials or the HDS output contract. Evidence: `tests/preview8.test.ts`, upstream suite baseline comparison in `docs/PREVIEW8.md`.

Preview 9 M4：`src/service.ts` 的 `stickerCatalogForSession` 在原 OneBot 门禁之外增加 `mobile-local`，仍受 `stickers.enabled` 控制；QQ/桌面动作与扫描、描述、决策、阈值、发送逻辑不变。`src/narrator.ts` 导出既有 `stickerInstruction` 以锁定空清单返回空字符串的契约，并新增默认未设置的 `mobileSystemPrompt` 钩子。宿主在当前请求无 catalog 时用它移除通用 prompt 中的三句 sticker 举例及一处平台动作示例；QQ 保持原始 prompt。App 启动前同步用户当前包清单，原生将原件复制到当前 profile 的 `stickers/<包名>/`，宿主仅在导出非空时启用上游贴纸功能，沿用视觉描述及无视觉模型告警。LocalBot 将已登记资产 URL/库内文件注册为持久 media ID，角色纯图片无气泡展示；不再依赖用户已发送贴纸映射。用户历史原件及已注册 media 不随包删除。角色专属包过滤留待后续：当前 App 库为全局库，上游 group 保留包名，未新增分组授权或改变 QQ 策略。回归见 `tests/m4.test.ts`、`tests/story-ui.mjs`、`StickerStoreTest.kt`。
