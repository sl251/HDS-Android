# Preview 9.5.2 检索修复

应用版本 `0.1.0-preview.9.5.2` / Android versionCode 30。上游仍固定 **1.0.1-rc57 @ ab512ec6b9dc00b9f738c062fe576e711a739151**，仅移植 **#10/#14**，来源快照 **9bdd5ac776dd682911edb9b48d1e7eaedd720dbe**。没有刷新 vendor 基线，也没有伪造官方版本。外部 rerank 是 **Android 扩展**。

向量设置放行 enabled/liveQuery/providerId/endpoint/model/dimensions/timeout 七字段。显式连接优先于向量任务分工；显式模型名优先于连接模型；显式完整端点优先于安全派生。不会借用主聊天线路。历史 modelId 仍保留上游兼容，移动 UI 不开放。根路径派生 `/v1/embeddings`，版本根保留版本与前缀，chat/completions 仅替换末尾，现成 embeddings 路径保留；其它路径要求显式完整端点。合法 query 保留，拒绝凭据、fragment、非 HTTP(S)、跨源覆盖和重定向。独立服务请新建连接，再选择它。

向量 enabled/liveQuery 默认 false，dimensions=0（不发送 dimensions）、timeout=10000ms。maxInputCharacters=4000、backfillBatchSize=5、semanticHistory=false、semanticStickerFilter=true 显式物化且不进入 UI。Alter 输出默认恢复上游 2000 tokens。保存、待重启、当前生效与测试草稿分别展示。`models.test` 仍只测聊天；`models.testRetrieval` 在独立 guest Node 进程以同一 HTTP 客户端测试固定中性文本，不启动故事、数据库或调度器。测试可能产生少量模型费用。

重排序默认关闭，providerId 直选，模型名必填；不增加用途 flag、不进入聊天任务或 failover。topN=20（1–20）、scoreThreshold=0（关闭过滤，范围0–1）、timeout=5000ms（500–15000）。只在主叙事事实检索调用；后台、管理读事实入口保持本地处理。先保存完整本地混合排序基线，保留近期事件与未决承诺通道，再对最多30个普通候选精排。query最多4000字符、文档最多2000字符、请求体最多256KiB。回合内相同候选查询复用 Promise，失败、超时、预算拒绝完整回退原基线；阈值过滤全空是成功，只保留保护通道。

Android 宿主启用 `mobileEmbeddingIdentity`，为事实、贴纸表增加可空身份列；首次建表和已有注册表补列均覆盖。向量绑定请求时模型身份，旧身份、未知身份、非法维度不参与 cosine。按原批量预算渐进回填，不清空事实、不启动全量付费重建。贴纸身份不全时回退完整目录。旧库迁移自动由 SQLite WASM 执行，发布前用临时备份副本验证。独立上游注册默认不启用此 Android 索引迁移。降级旧应用前先关闭向量与重排序；直接降级兼容性未作设备承诺，保留升级前备份。

#10 包含 proactive-check 缺候选但已有 immediate 回复时的候选合成；合法 let-go/recheck-later 不覆盖，容量、间距、日限、参与者、端点和总开关仍有效。撤回仅给同故事、同参与者、同轮新建 pending 意图增加幂等“从未发出”注记，不删除、不改 status、不回写剧本。dropped-only 路径继续保持来源快照范围，不扩大中和集合。#14 持久化观察由数据库生成主键；内存预览才返回 id=0，历史 id=0 不删除。

检索诊断可关联前台消息或作为 requestIds=[] 后台事件；同任务、连接、原因60秒合并，恢复记录成功。沿用7天/2000条/1MiB容量和清空 epoch 保护；只保存稳定原因码、状态码、维度、结果数量、耗时，无密钥、URL、正文和原始错误。检索降级不改变聊天投递状态。前台查询不消耗后台预算，后台补齐照常计数。

| 信号 | 分类与处理 |
| --- | --- |
| 缺连接/模型/可派生地址 | provider_required / model_required / endpoint_required，effective关闭，desired保留，聊天继续 |
| 跨源覆盖或重定向 | endpoint_origin / redirect_rejected，填写同源最终端点 |
| 401 / 403 | authentication / permission |
| 404 / 405 | route_not_found |
| 400 / 422 | invalid_request；核对模型、协议、dimensions |
| 500+convert_request_failed | gateway_convert_request；核对渠道类型与转换器 |
| 明确 model ratio not found | gateway_model_ratio；配置模型倍率 |
| 其它5xx | provider_error，不能凭500推定倍率错误 |
| 402/明确余额不足 | provider_quota |
| 429无更多证据 | throttled_or_quota |
| 超时 / 取消 / DNS或连接TLS | timeout / cancelled / network |
| 2xx结构无效、全零或非法向量 | invalid_response |
| 本机后台预算 | background_budget |

网关前置检查：

- 确认 embedding 模型支持 embeddings，不能靠聊天模型列表推断。
- rerank 必须有支持 relay 的渠道，例如 Cohere=35、Jina AI=38、Xinference=42，且协议匹配；普通 OpenAI 渠道加模型重定向不保证可用。
- 核对精确模型标识、渠道列表、别名最终目标、模型倍率和令牌分组授权。
- 确认额度、反向代理 POST 路由、服务端超时以及网关到上游的连通性。
- 分别测试聊天、向量与重排序，再通过业务诊断确认实际召回。测试成功不等于运行中的故事已重载配置。

分享码与角色导出仍排除模型连接与检索路由；外部预设不能替换本机 endpoint/providerId/model。

本地验证使用 mock HTTP 与临时数据库，不接触用户故事数据。Android APK 构建交 GitHub Actions，触发由主控验收后进行。真机、真实网关、付费模型、PRoot设备取消与升级/降级均 **NOT RUN，交用户**。实际命令、退出码、基线失败比较、提交与限制记录在本次实施报告中。

本地验收记录：移动端全量 195/195、检索等专项 45/45、上游 914 PASS / 4 SKIP / 0 FAIL；两项检索/诊断浏览器测试、host/probe 构建、生产前端构建、typecheck、Python 打包/证书配置检查与 Android 资源同步通过。Kotlin 只做字段、边界与输出白名单的静态一致性检查，未运行 Gradle；以上不能代替设备或实际 ARM64 guest/APK 验收。
