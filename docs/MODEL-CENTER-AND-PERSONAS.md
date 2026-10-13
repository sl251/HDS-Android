# preview.4：模型中心与人设管理

## 模型连接

一条连接包含供应商、协议、地址、密钥、模型及任务勾选。最多 12 条。主叙事、记忆压缩、Alter 各需至少一条启用的连接；时间导演沿用原 HDS 的压缩模型路由。主叙事的备用切换默认关闭，启用后可选择优先级或轮询。

预设包括 DeepSeek、OpenAI、Moonshot、百炼北京、硅基流动、OpenRouter、智谱、Gemini 的 OpenAI 兼容接口、Anthropic。使用代理或其他地域时选自定义。`/v1` 自动补成完整请求地址，自定义完整路径保留；Anthropic 使用 `/messages`、`x-api-key` 和版本头。

“获取模型列表”读取当前填写的连接，调用原生 HTTP `/models`，不要求先保存或启动核心；结果可筛选、下拉选择。接口不支持列表时可手动输入。分页列表会提示只获取了部分结果。不同模型未逐个实测，列表存在也不保证支持聊天。

“测试当前连接”发一次非流式短请求并检查可见文本，显示延迟；它不证明 SSE 或 HDS 结构化剧情已兼容。实际聊天需要相应模型支持原 HDS 的输出契约。高级选项包括输出上限、超时、温度、JSON/仅提示词约束、缓存友好的提示排列，以及 DeepSeek 兼容 thinking 参数。

旧密钥只在同源且同协议的连接中保留。更换预设清除待保存的旧密钥；自定义地址变更到其他服务需要新密钥或明确清除。持久化使用 Keystore；日志不输出密钥或完整服务商响应，列表请求不跟随重定向。

## 流式语义

沿用 rc51 的 `mainStreamingMode=experimental`。主叙事私聊通过 SSE 接收模型文本，只有完整且通过原 HDS 解析的首条回复才提前投递，其余剧本继续生成。界面每秒同步已投递消息，不展示原始 JSON 碎片。该功能不是逐字打字动画。

默认关闭；开启时要求 JSON 模式。首条回复已投递后的失败处理沿用原 HDS，避免备用模型重发可见回复。移动宿主停止前会等待进行中的叙事退出，再卸载 Koishi/SQLite，避免流式任务最后阶段访问已关闭的上下文。Android 停止超时仍会终止本应用运行器，强停边界需真机测试。

## 人设格式与操作

| 输入 | 处理方式 |
| --- | --- |
| Tavern V1/V2/V3 JSON、标准 tEXt PNG | 保留原始文件、未知扩展、世界书；编辑对应提示字段 |
| typ0 下载的 koishi.yml | 定位 plugins/group 下的 hds-interlude 实例，预览后导入 |
| HDS JSON / payload / preset.payload | 提取 storyDefaults，多实例时让用户选择 |

HDS 原生字段：characterName、characterProfile、userProfile、relationship、world、location、perspective、perspectives、supportingCast、supplementaryFacts、style、timezone。导入的用户档案在本机故事人设留空时使用。模型、账号、插件、runtime 等非人设配置剔除，不保存原始敏感 YAML。纯状态机预设不视为人设。

YAML 不执行标签、脚本或合并引用；拒绝重复键、别名引用、多文档、危险对象键及超限字段。合成样例在 `fixtures/cards/typ0-example.koishi.yml`，不是复制他人作品。

修改保留角色 ID 和数据库；下次启动调用 HDS 原生 updateSetting 应用新设定，明确清空的字段也生效。原有剧情、记忆和演化状态保留，所以修改并不重写已经发生的故事。删除需在界面确认，是从角色库移除；原文件与剧情保留，重导原文件恢复。尚未提供彻底清空历史、导出或整机备份功能。

## 参考与实现边界

- [HDS-Interlude 配置](https://github.com/ISEKAI-MomoiCore/HDS-Interlude/blob/master/CONFIGURATION_GUIDE.md)：复用固定 rc51 的模型路由、备用切换、首条完整流式回复和原生故事设定。
- [RikkaHub OpenAI provider](https://github.com/rikkahub/rikkahub/blob/master/ai/src/main/java/me/rerere/ai/provider/providers/openai/OpenAIProvider.kt)：参考真实 /models 拉取与服务商连接分离。未复制代码。
- [ChatterUI 自定义模板](https://github.com/Vali-98/ChatterUI/blob/master/docs/CustomTemplates.md)：参考协议、地址与模型独立配置。未复制代码。
- [typ0](https://typ0.space/#browse)：根据站点实际下载结构和原 HDS 分享格式独立实现解析，未复制站点源码。

## 验证

Node 测试覆盖原 HDS/Koishi/SQLite 的实际运行、模型分工、格式导入、敏感字段丢弃、流式提前投递、编辑后保留历史；模型网络响应由本地固定 HTTP/SSE 服务提供，不使用用户密钥。JVM 测试覆盖模型列表、协议、404 诊断、加密字段迁移边界及原有运行时回归。Actions 另执行 Kotlin 编译、Android lint、APK 签名验证和打包。

真机覆盖升级、Keystore、文件选择器、商业模型服务与后台运行需要手机验证。具体构建证据随候选完成后记录在 `docs/evidence/preview4/`。
