# 9.6.1 生图修复交接

基线：`origin/main`（包含 `v0.1.0-preview.9.6.1`）。工作分支：`codex/fix-image-generation-diagnostics`。本交接的修复纳入 **9.6.2**，最新发布与验证范围见 [PREVIEW9.6.2.md](PREVIEW9.6.2.md)。下文保留交接时的检查记录。

## 修复内容

- Imagefree 查询成功使用 `image` 字段，旧解析器漏读，导致已完成任务继续轮询。现在识别该字段及字符串、数组、嵌套结果，终态无图会显示错误。免费队列等待上限调整为 15 分钟。
- 自定义渠道增加 `imageApi`：`auto`、`images`、`chat`、`gemini`，Android 加密配置存储保留该选项。原配置自动使用 `auto`。
- 自动模式优先识别完整端点；Gemini image / Nano Banana 模型名使用聊天式生图，Google 原生地址使用 generateContent，其他模型使用 OpenAI Images。网关差异可手动指定，不会失败后自动切换协议重复发起计费请求。
- 兼容 Images URL / b64_json、Data URI、Markdown 图片、Chat Completions 图片数组和内容段、Gemini inlineData / inline_data、常见嵌套结果，以及忽略 stream:false 返回 SSE 的聊天网关。多段响应不再只检查第一段。
- DALL·E 2/3 和 GPT Image 使用相应尺寸；参考图按所选协议分别发送 multipart、image_url 或 inlineData。
- 生图诊断记录准备、提交、查询、下载、保存、投递，包含任务编号、用途、接口格式、渠道类别、HTTP 状态、耗时和分类原因。请求正文、参考图、密钥、原始服务响应及下载链接不写入诊断。
- 异步任务在创建时保存消息关联；诊断可以按原消息或生图任务筛选。无聊天消息的头像/动态任务也会显示。失败筛选包含生图失败。
- 自主生图被配置、意愿、冷却间隔阻止，或创建任务失败时也记录诊断；聊天和动态页面显示任务失败入口。
- 明确被服务拒绝后可修正配置重试。网络断开等提交结果不明的请求仍禁止重复生成；已保存图片的投递失败只重试投递。

## 已做的有限确认

- `npm run build`：通过（含前端 TypeScript 检查）。
- `npm run build:host`：通过。
- 生图与诊断运行时模块单独执行严格 TypeScript 检查：通过。
- 离线小范围确认：Imagefree URL、OpenAI URL/Base64、聊天 Markdown/图片数组、Gemini 多段图片、SSE、完成响应编号不会误当任务编号，以及生图失败筛选和任务关联：通过。
- 对用户渠道只读取 `/v1/models`：`gemini-3.1-flash-image` 存在，声明 `supported_endpoint_types: ["openai"]`。没有执行真实生图或消耗生成额度，也没有把用户密钥写入项目。
- 未执行完整回归、Android 编译、真机/UI 测试或发布流程；按用户要求交给后续模型。

## 后续建议验证

1. 用户渠道：自动/聊天式格式生成一张图，确认 Base64 或 Markdown 结果入库并出现在聊天；再验证有参考图的请求。
2. Imagefree：覆盖 queued → completed/image 和站点验证拒绝；确认不会生成成功后继续轮询。站点强制验证时应用会明确报错，无法保证免费站点始终可用。
3. OpenAI Images、Gemini 原生分别验证生成、参考图和各自请求参数；不同厂商的自有异步任务协议未统一接入，现会明确提示不支持。
4. 覆盖 HTTP 401/402/403/404/405/429/5xx、HTTP 200 内嵌 error、空图、坏 JSON、超时、下载失败、保存失败及投递失败。
5. 验证重试不重复生成、重启恢复只查询已提交任务、诊断清空后在途结果不重新写入，以及诊断导出无密钥或提示词。
6. 自主发图、动态配图和头像生成，分别检查诊断关联、失败入口及设置持久化。旧版已处于 unknown 的任务不能安全重放，需先在服务端核实。

协议核对来源：[Imagefree 当前网页](https://imagefree.net/)、[Gemini 图片生成文档](https://ai.google.dev/gemini-api/docs/image-generation)、[Gemini OpenAI 兼容文档](https://ai.google.dev/gemini-api/docs/openai)。Imagefree 的当前前端查询逻辑读取 `status === "completed"` 与 `image`。
