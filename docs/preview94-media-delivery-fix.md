# Preview 9.4 表情、文字与语音投递修复

基于 Android `031f2e5`。对照上游 HDS-Interlude `master` 的
[`ed8432d648d56033ed95e33971caf9286761b8fb`](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/tree/ed8432d648d56033ed95e33971caf9286761b8fb/src)
中 `narrator.ts` / `service.ts` 的表情机制；继续使用仓库内固定的 rc57 引擎，没有升级或改写 vendored 源码。

## 已确认的问题与修复

| 问题 | 修复后的行为 |
| --- | --- |
| 移动覆盖层把选中的表情一律改为 standalone，清空文字和 voice | 恢复上游 standalone / after-text 协议、目录匹配、意愿过滤及投递流程；语音可替代回复文字，独立表情动作继续执行 |
| 覆盖提示丢掉实际语音阈值，并宣称存在已取消的每日限额 | 仅替换移动语音扩展，明确顶层 `voice.willingness`、正文位置、实际阈值和失败回退；原样保留上游表情提示 |
| 本地聊天未提供配置中的表情阈值 | 把实际 expressionThreshold 传给模型，与发送门槛一致 |
| 后续分段只保存正文，没有保存语音决策 | split-message 保存并在定时投递、advanceStory 两条恢复路径中还原语音意愿 |
| outbox 恢复重建消息时没有语音决策 | 在 outgoing-message / group-message 事件元数据中保存语音意愿，恢复时严格校验并还原 |
| 本地表情文件不可用时仍产生空白成功消息 | 在落库和推送前失败，不再写虚假的发送成功记录 |
| QQ 语音的部分空回执仍被当作成功 | undefined、null、空字符串、空数组或无效 ID 数组均按结果未知处理，不追加重复文字 |

没有把“缺少 voice 决策”推断成必须发送语音，也没有绕过用户设置的阈值、冷却、服务退避和长度限制。多段回复仍逐段经过现有语音策略；开启冷却时，后续段落可能按策略保留文字。旧版本已写入且没有保存语音意愿的记录无法凭空补回决策。

## 定向验证与交接

```powershell
npm run typecheck
npm run build:host
node --import tsx --test --test-concurrency=1 tests/media-controls.test.ts tests/m4.test.ts tests/m5.test.ts tests/preview91-m3.test.ts
git diff --check
```

2026-10-19：上述类型检查、Host 构建及 diff 检查通过；18 项定向测试全部通过（0 失败、0 跳过）。

回归覆盖：上游文字后附表情、单独表情、语音后附表情（仅正文合成一次）、空表情库、缺失文件、真实 Host/SQLite 分段语音、持久事件与 outbox 恢复、关闭语音、合成失败回退，以及真实 Koishi/OneBot 编码器与本地 WebSocket 上的私聊/群聊语音、SILK 编解码和不确定回执。

模型、TTS 和 OneBot 服务端使用本地 fixture。完整测试、Android 真机、真实 MiMo 与 QQ 账号的端到端验收及合并交由后续评审执行。本次不发布 APK、不合并 PR。
