# 角色卡、世界书与 HDS 映射规范

此规范定义移动端新增能力，不能据此声称 HDS 上游已经支持这些格式。兼容目标为“读取并保留格式数据，在 HDS 中有明确映射”；HDS 不是 SillyTavern，不能承诺两者输出或全部扩展行为一致。

## 1. 首版格式矩阵

| 格式 | 首版要求 | 导出 |
|---|---|---|
| Tavern V1 JSON | 支持常用六字段，识别缺失字段并警告 | 保留原件；提供规范化 JSON |
| Character Card V2 JSON | 解析完整数据与 extensions | V2 JSON、PNG |
| V2 PNG `chara` | 读取 PNG 内元数据；UTF-8/base64 正确 | 写入对应元数据，保留必要图片信息 |
| Character Card V3 JSON / PNG `ccv3` | 解析、保留新增字段；列出尚未生效的能力 | V3 JSON、PNG，保持未知字段 |
| `.charx` | 首版后半阶段实现 ZIP 的 `card.json` 与可支持资源；不执行附带代码 | 原件保留；完整重打包导出作为 P1 |
| HDS 原生角色档案/预设 JSON | 自定义带版本的封装；映射 StorySetting 和允许的配置分区 | 自定义 `.hdscharacter.json` |
| HDS 分享码 | 独立在线导入，沿用分享预览/清洗/回滚语义 | 不把分享码假装为离线角色文件 |
| 世界书 | V2 内嵌、V3 `lorebook_v3`，以及固定样本验证过的 SillyTavern world-info JSON 变体 | 原格式元数据保留 |

普通 JPG/WEBP/PNG 没有卡数据时只能作为头像，不能显示“角色导入成功”。未来版本的未知 schema 显示版本提示；能安全保留的数据不擅自丢弃。

依据：[V2 规范](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md)、[V3 规范](https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md)。实现前固定规范提交并建立格式样本。

## 2. 导入流程

1. Android SAF 选取用户指定文档；支持 `content://` 流、取消、未知大小、中文文件名及云文档下载失败。
2. 流式复制到 app 私有 staging，累计大小并计算哈希；根据文件签名和 schema 判型，不只信扩展名/MIME。
3. 解析元数据、资源和原始对象，生成 `ImportReport`；这一步不创建故事、不调用 LLM、不连接卡内 URL。
4. 预览角色名、头像、字段、世界书数量、开场白、来源、版本与兼容差异。用户可以修正名字、时区和映射。
5. 选择“导入新角色 / 更新指定角色 / 另存副本”。相同内容可提示重复，名称相同不等于同一角色。
6. 提交带 previewId、源哈希、选择方案与 expectedRevision；事务保存角色和资产，完成后清理 staging。
7. 用户选择是否创建/绑定运行档案。更新角色库不自动覆盖运行中故事；应用到现有故事需预览 Canon 差异并保留可恢复快照。

`ImportReport` 至少含 detectedFormat、formatVersion、sourceHash、normalizedCard、assetManifest、mapping、warnings、unsupportedFeatures、removedConnectionFields。warning 要具体到字段路径；不能只有“有兼容问题”。

## 3. 数据保存约定

独立保存以下内容：原始文件字节、原始 JSON（或对应元数据对象）、规范化角色、显式映射配置、兼容报告、资源清单、来源与修改时间。应用专有字段放命名空间 `extensions.hdsMobile` 或独立侧表；不要挤占他人扩展字段。

数据模型关系：

```text
CharacterAsset(id, sourceHash, rawFile, rawJson, normalized, revision)
  ├─ CardAsset(hash, mime, originalPath, privateStorageId)
  ├─ Lorebook(id, raw, normalizedEntries)
  └─ MappingProfile(version, fieldMappings, promptOptions)
RuntimeProfile(id, characterAssetId, appliedRevision, dataDir)
  └─ HDS 的 Canon、Overlay、事实、意图、剧情与参与者
```

导入/导出往返保留未知字段及 extensions；编辑已知字段只修改对应路径。对同一 PNG 中多个候选块、冲突的元数据记录来源及选择结果。不得经 canvas 重新编码图片后才提取卡信息，否则可能先丢失元数据。

## 4. 字段映射

| 卡字段/内容 | HDS 目标 | 规则 |
|---|---|---|
| name | `StorySetting.character.name` | 导入时可修改，原字段保留 |
| description + personality | `character.profile` | 按有标签的段落组合，保留各字段原文 |
| scenario | world + 初始场景备注 | 不是永久事实；预览决定世界/地点/情境去向 |
| 用户人设 | user.displayName / user.profile | 由用户填写，不从角色卡推断成真实身份 |
| 关系设定 | relationship | 显式映射或手工输入 |
| 配角、地点、价值观 | supportingCast / location / perspective(s) | HDS 原生档案可直接给定；其他卡不擅自猜写 |
| mes_example | 专用角色对话示例上下文块 | 供模仿风格，不写成真实历史/记忆事实 |
| first_mes / alternate_greetings | 新故事开场选择 | 用户从中选择一个；同一故事只提交一次 |
| character_book | 世界书引擎 | 保留条目，按触发/预算选择，不整本塞进 world |
| system_prompt | 角色级提示槽 | 作用于角色行为；不能覆盖 HDS JSON 合约、存储/投递边界 |
| post_history_instructions | 角色后置提示槽 | 保留原文，使用显式编排位置 |
| creator_notes、tags、creator、版本 | 角色详情与检索信息 | 不默认当成剧情事实或提示词 |
| extensions | 原始扩展与支持子集 | 不认识的保留，不执行 JS/正则脚本插件 |

这里的“专用上下文块”需要在 HDS narrator/context compiler 增加小补丁并回归，不是已有配置字段。T08 必须指出实际注入位置和提交哈希。

**提示词兼容边界：** V2 定义了角色 system/post-history 字段的替换语义。移动端将“角色全局提示槽”与“HDS 引擎输出协议”分开，卡字段按规范替换角色槽，支持 `{{original}}` 指向替换前的角色槽；HDS 引擎协议始终保留。导入报告明确说明这不等于 SillyTavern 的全部提示编排。不能默默忽略字段后宣称完全兼容。

`{{char}}`、`{{user}}` 与 `{{original}}` 使用有范围的模板替换，禁止 eval。其他宏保留并警告，不在导入时调用网络/时钟/随机数来改变源卡。用户确定后的值在实际提示编译时解析。

开场白必须区分“卡中展示”与“已在会话中投递”：本地聊天显示并落盘后记已送达；QQ 仅在用户选择向该渠道发送且有成功回执时记已送达。仅导入角色不得自动向好友/群发开场白。

## 5. 世界书执行子集

首版至少实现 enabled、keys、secondary_keys/selective、constant、case_sensitive、insertion_order、priority、scan_depth、token_budget、before_char/after_char 和有界 recursive_scanning。普通匹配基于最近真实会话条目；默认不扫描未投递台词、模型推理或全部剧情库，避免自触发。

按以下顺序执行：选择绑定世界书 → 读取限定历史 → 匹配启用条目 → 有界递归 → 去重 → 优先级预算裁剪 → 按位置和 insertion_order 排序 → 生成专用 lorebook 上下文块。输出 trace，说明命中关键词、候选数量、裁剪原因和最终使用预算。

建议默认递归上限 3 层、命中条目上限 64；这些是手机工程防护值，可配置并写入兼容报告。多书冲突优先角色书，再全局世界书；保留稳定 tie-break，便于重放。

Token 预算用模型对应 tokenizer；无法获得时用保守估算并标记 estimated，不把“字符数=token 数”当精确计算。constant 也受总预算限制，裁剪时必须可见。

V3 的 use_regex 需要安全实现：隔离执行、限制输入/模式长度与运行时间；不支持的正则语法给出明确提示，不回退成任意 JS 执行。不支持的第三方世界书扩展原样保存并列入报告。世界书中的设置不是已发生剧情，不能全部转成 durable fact。

## 6. PNG/CHARX 解析要求

PNG 必须校验签名、chunk 长度和 CRC，并对元数据解码设置大小限制。识别 `chara` 与 `ccv3`；两者都有效时优先 V3，V3 损坏而 V2 可读时需明确提示后才采用回退。非标准 iTXt/zTXt 可作为兼容扩展，但要有独立测试和解压上限；标准路径首先实现规范规定的 tEXt。

CHARX 根目录需存在 card.json。V3 使用的资源 URI `embeded://` 拼写按规范处理；解析成资源 ID，不当成可随意访问的文件路径。拒绝路径穿越、绝对路径、符号/硬链接、重复归一化路径和压缩炸弹。音频/图片可预览，Live2D/模型/代码资源可保留但不代表可执行。

建议初始上限：JSON 5MiB；PNG 文件 32MiB、卡元数据解码后 5MiB、图片解码像素 1600 万；CHARX 压缩 100MiB、解压 250MiB、条目 2000 个；单文本字段 256Ki 字符、对象深度 64。T07 依据真实合法样本与手机测量调整并记录，不能无上限解析，也不能静默截断。

外链资源默认不自动下载；由用户单独发起，校验类型、大小与重定向。用户配置模型 API 可以使用其明确指定的局域网端点；这一设置与卡里不可信的资源 URL 分开，不能被通用 SSRF 规则误伤，也不能由卡更改。

## 7. HDS 分享与备份的区别

HDS 分享导入复用 `sanitizeSharePayload` 等白名单语义；模型连接、凭据、代理、OneBot 登录信息不可从分享覆盖。先展示分区差异，再应用，验证 revision 并创建快照。网络失败时原配置可继续使用。

角色卡保存人设和资源；HDS 预设还可能有运行配置；完整备份包含数据库与实际剧情。三者用不同入口和格式，不把分享卡导入误做“恢复整个数据库”。

## 8. 必须交付的样本与验收证据

使用合成角色或有权分发的样本，至少覆盖：V1/V2/V3 JSON、V2 PNG、双块 PNG、中文/emoji、无卡 PNG、损坏 CRC、非法 base64、超长字段、未知扩展、重复导入、CHARX 相对资源、路径穿越包、正则超时、世界书递归循环、备选开场、HDS 分享 revision 改变。

导入成功的验证不止数据库有记录：用固定模型 stub 断言实际 HDS 请求含期望的人设、选中的 lore 条目和示例；用真实 API 人工检查 5—10 轮角色连贯性。后者有随机性，报告模型/参数和观察结论，不能用一次回复作为完全一致证明。

## 9. 实现进展与修复记录（2026-10-15）

改动落在 `packages/card-format/index.ts`、`packages/persona-format/index.ts`、`android/app/src/main/java/io/hdsinterlude/android/HdsRuntimePlugin.kt`；已推送到 `docs/t13-background-keepalive`。

| 症状 | 原因 | 修复 |
|---|---|---|
| “这张 PNG 没有标准角色卡元数据” | 只遍历 `tEXt` 且强制 base64 | 增读 `iTXt`（UTF-8 布局），`tEXt` 内直接写 raw JSON 也接受；`zTXt` 给明确指引（改用同源 PNG/JSON 导入） |
| “角色卡 base64 数据损坏” | 严格正则不容空白、URL-safe、缺 padding | 去空白、`-_` 归一化、自动补 padding |
| JSON 卡报“无法解析” | 文本先过 strict YAML，`\/` 或重复键被判死 | `{`/`[` 开头直接 `JSON.parse`，YAML 只用于非 JSON 文本 |
| “暂不支持角色卡版本：xxx” | `spec` 白名单硬拒 | 接受 v2/v3 别名（`ccv3`、`chara_card_v2` 等）；未知版本降级按 V3 解析并记 warning |
| 无 `spec` 的 V2 卡被拒 | 只认根 `spec` | 无 spec 但 `data.name` 存在时按 V2 解析 |
| 旧 TavernAI 卡报“未找到人设块” | `char_name` 等未映射，且 `parsePersona` 路由不含它们 | 映射 `char_name`/`char_persona`/`char_greeting`/`world_scenario`/`example_dialogue`；路由补 `char_name`、`data.name` |
| “太大” | JSON 上限 5 MiB、单字段 256 Ki 字符 | 放宽到 16 MiB / 1 Mi 字符；角色名超 128 字符截断并警告，不再整卡拒绝 |
| 世界书静默丢失 | 只认 `character_book`、`lorebook_v3` | 补 `lorebook` |
| 部分文件选不中 | MIME 白名单缺 `application/x-json`、`text/json`、`application/zip` | 补齐；ZIP/`.charx` 给专门提示，而非“既不是 PNG 也不是文本” |
| 真卡报“结构有问题” | 同一 PNG 含**两个同名 `chara` 块**（被多个工具先后写过），原实现按规格直接拒绝 | 逐个解析全部卡数据块，保留信息最完整的一个（ccv3 优先 → 非 `none` avatar → 世界书条目数 → 描述长度），其余块记 warning；不再整卡拒绝 |

**上限口径**：JSON 与解码元数据 16 MiB、PNG 文件 32 MiB、单字段 1 Mi 字符、对象深度 64。这是按 §6 的“T07 依据真实合法样本与手机测量调整”做的临时放宽。**已有真卡定标样本**：一张 charhub 导出的 103 KB PNG（两个 8.1 KB `chara` 块、描述 4204 字符），远低于上限；“太大”一类真实样本仍未到手，上限继续待定标，拿到后要重新记录手机内存表现。

**明确未做**：`.charx`（ZIP + DEFLATE，需要异步解析路径）与 `zTXt` 解压仍不支持，只给清晰错误提示。官方 SillyTavern `src/character-card-parser.js` 只写只读 `tEXt` + base64，主流酒馆卡路径本已通畅；本轮增量在第三方工具产出的 `iTXt`/raw-text/旧字段变体。

**验证**：`node --import tsx --test tests/card-format.test.ts` 6/6 通过（新增 raw-text `tEXt`、76 列换行 base64、`zTXt` 压缩卡、未知 spec 宽容、legacy 映射、名称截断、重复块保留最完整）；并用用户实测失败的真卡实跑 `parseCard` 通过（Asuka / v2 / 选中带 charhub avatar 与世界书的块0）。真卡未入库，回归测试按同一结构合成。`tsc --noEmit` 干净。`tests/qq.test.ts` 的 1 项失败经 `git stash` 回退确认是改动前既有失败。agy 只读核对报告归档 `evidence/agy-card-import-audit.md`（其中行号为改动前）。
