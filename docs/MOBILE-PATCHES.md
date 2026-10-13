# 移动宿主与上游边界

HDS 原始版本为 1.0.1-rc51，固定提交 9a77fadb88c6e57914ebac8ca75cf54a27354d01。原始 AGPL LICENSE 和文档保留；宿主不重写叙事协议、事实提交或记忆层。

- endpoints.ts、types.ts、service.ts：增加 local 通道类型，mobile-local 端点不冒用 QQ 身份。
- narrator.ts：增加可选角色卡上下文钩子。原始引擎系统指令保持第一条，角色/示例/世界书与引擎契约分开，creator_notes 不注入。
- service.ts：开场白以幂等 character-message 进入真实剧情；关停前暂停调度并等待进行中的流式叙事、串行任务与端点/数据库写队列，避免数据库卸载后仍写快照。
- runtime/host.ts：创建真实 Koishi、SQLite WASM 与 HDS 插件，提供限于本机的令牌鉴权 RPC、本地消息投递回执、持久入站 requestId。API 密钥通过 stdin 传入，不放进命令行参数。

`scripts/vendor-hds.mjs` 重新导入会覆盖补丁，请先保留 Git 差异。JSON/PNG 卡的原始文件与未知字段保留；世界书当前支持常量/关键词/次级关键词、顺序与预算，不执行正则或扩展脚本，完整递归规则、CHARX、压缩 PNG 元数据尚未实现。

自动测试使用固定模型响应验证真实引擎，不等同于付费模型服务实测或 Android 真机验收。原始 HDS 基线的已知失败见 docs/evidence/T01/baseline.md；没有为获得通过而改写原始断言。

preview.4 的模型分工直接使用原 HDS provider flags / failover / SSE 路由。typ0 人设使用原生 storyDefaults 和 updateSetting，Tavern 继续使用上下文钩子；不整体升级 rc51。
