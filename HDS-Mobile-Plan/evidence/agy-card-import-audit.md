已对 `HDS-Android` 角色卡导入全链路（UI `apps/mobile-ui/main.tsx`、安卓桥接 `HdsRuntimePlugin.kt`/`HdsStore.kt`、核心解析器 `persona-format` 与 `card-format`）完成只读盘点，核实结果如下：

---

### 1. 5 MiB 文本上限（persona-format:45）
- **结论**：**部分成立**（需严格区分文件格式：对 `.json` 卡**完全成立**；对 `.png` 卡由下游解析层接力拦截）。
- **代码证据**：
  - [packages/persona-format/index.ts:44-45](file:///root/hermes-workspace/hds-android/packages/persona-format/index.ts#L44-L45)：
    ```ts
    if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return [parseCard(bytes)]
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('JSON / YAML 配置超过 5 MiB')
    ```
  - [packages/card-format/index.ts:9, 74, 90](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L74-L90)：
    ```ts
    const MAX_JSON = 5 * 1024 * 1024
    if (body.length > MAX_JSON * 1.4) throw new Error('PNG 卡元数据超过限制')
    if (decoded.length > MAX_JSON) throw new Error('PNG 解码元数据超过 5 MiB')
    ```
- **实际报错推演**：
  - **JSON 角色卡**（嵌图 Base64 或长世界书易超 5 MiB）：在 `persona-format:45` 直接拦截，用户报错：`"JSON / YAML 配置超过 5 MiB"`。
  - **PNG 角色卡**：PNG 文件本体因行 44 分支绕过了 `persona-format:45`（PNG 本体受安卓层与 `card-format:56` 的 32 MiB 约束）；**但若其内部 tEXt 的 JSON 超过 5 MiB**，会被下游行 74 或行 90 拦截，用户报错：`"PNG 解码元数据超过 5 MiB"` 或 `"PNG 卡元数据超过限制"`。

---

### 2. PNG 卡元数据只认 tEXt 块（card-format:70-77）
- **结论**：**成立**。
- **代码证据**：
  - [packages/card-format/index.ts:70-78](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L70-L78)：
    ```ts
    if (type === 'tEXt') {
      const separator = body.indexOf(0)
      const key = decoder.decode(body.subarray(0, separator))
      if (separator >= 0 && (key === 'chara' || key === 'ccv3')) {
        ...
        candidates.set(key, decoder.decode(body.subarray(separator + 1)))
      }
    }
    ```
  - [packages/card-format/index.ts:86-87](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L86-L87)：
    ```ts
    const selected = candidates.get('ccv3') ?? candidates.get('chara')
    if (!selected) throw new Error('这张 PNG 没有标准角色卡元数据；本版支持 JSON 与 tEXt PNG')
    ```
- **实际报错推演**：
  新版 Chub/SillyTavern 或经过图片工具（TinyPNG/Pillow/Sharp 等）优化处理的卡，常使用 `zTXt`（Deflate 压缩块）或 `iTXt`（国际 UTF-8 文本块）。当前解析器完全忽略 `zTXt`/`iTXt`，循环结束 `candidates` 为空，在行 87 触发异常。
  用户报错：`"这张 PNG 没有标准角色卡元数据；本版支持 JSON 与 tEXt PNG"`（**不会**报 `"base64 数据损坏"`，因为根本进不到行 89 的解码）。

---

### 3. tEXt 值必须 base64（card-format:89 fromBase64）
- **结论**：**成立**（且存在比假设更严重的**换行/空白误杀**问题）。
- **代码证据**：
  - [packages/card-format/index.ts:50-54](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L50-L54)：
    ```ts
    export function fromBase64(text: string): Uint8Array {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('角色卡 base64 数据损坏')
      const binary = atob(text)
      return Uint8Array.from(binary, char => char.charCodeAt(0))
    }
    ```
- **实际报错推演**：
  1. 社区非官方工具确实存在把原始明文 UTF-8 JSON（以 `{` 开头）直接塞入 `tEXt` 的情况，字符 `{`、`"`、`:` 会直接触发正则校验失败。
  2. 哪怕是标准 Base64，只要导出工具遵循 MIME 标准（每 76 字符插入 `\r\n` 或 `\n`）或末尾附带空格/换行，该严格正则会立刻判定损坏。
  用户报错：`"角色卡 base64 数据损坏"`。

---

### 4. 世界书只取 character_book / lorebook_v3（card-format:39）
- **结论**：**成立**（但表现为**静默丢失/失效**，不会引起导入阻断报错）。
- **代码证据**：
  - [packages/card-format/index.ts:39](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L39)：
    ```ts
    const book = record(data.character_book) ? data.character_book : record(data.lorebook_v3) ? data.lorebook_v3 : null
    ```
  - [packages/card-format/index.ts:98](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L98)：
    ```ts
    const entries = Array.isArray(card.lorebook?.entries) ? card.lorebook.entries : []
    ```
- **实际报错推演**：
  早期酒馆卡或部分前端分支将世界书存放在 `data.extensions.world` 或 `data.extensions.character_book` 中。此时 `card.lorebook` 被设为 `null`。
  导入流程能正常完成（`raw` 会保留该扩展字段），**不报导入错误**；但在进入故事生成 Prompt（[`cardPrompt`](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L96-L119)）时，这些条目完全不会被检索或注入。常见度较高。

---

### 5. name 校验（card-format:37）
- **结论**：**成立**（社区卡中很常见）。
- **代码证据**：
  - [packages/card-format/index.ts:31-37](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L31-L37)：
    ```ts
    const textField = (key: string) => {
      if (data[key] === undefined || data[key] === null) return ''
      if (typeof data[key] !== 'string') throw new Error(`data.${key} 必须是文本`)
      return data[key] as string
    }
    const name = textField('name').trim()
    if (!name || name.length > 128) throw new Error('角色名称不能为空，最多 128 字符')
    ```
- **实际报错推演**：
  Chub 等共享平台上创作者极常在 `name` 中堆叠长标题、版本说明、差分标签或作者署名（例如：`【原神/长篇RP/5套差分】雷电将军 Raiden Shogun (Euthymia Ver.) - 追求永恒的鸣神 | 包含完整前置背景与专属世界书`），极易突破 128 字符限制。
  用户报错：`"角色名称不能为空，最多 128 字符"`（若为非字符串类型则报 `"data.name 必须是文本"`）。

---

### 6. YAML 严格解析跑所有文本（persona-format:49）
- **结论**：**成立**（普通 JSON 卡存在极其严重的**结构误伤**）。
- **代码证据**：
  - [packages/persona-format/index.ts:48-53](file:///root/hermes-workspace/hds-android/packages/persona-format/index.ts#L48-L53)：
    ```ts
    try {
      const document = parseDocument(text, { schema: 'core', uniqueKeys: true, prettyErrors: false, strict: true, stringKeys: true })
      if (document.errors.length || document.warnings.length) throw new Error('parse')
      visit(document, (_key, node) => { if (isAlias(node)) throw new Error('alias') })
      value = document.toJS({ maxAliasCount: 0 })
    } catch { throw new Error('JSON / YAML 无法解析：请检查语法；重复键、自定义标签、锚点引用和多文档暂不支持') }
    ```
- **实际报错推演**：
  所有非 PNG 文本卡在判断是否为酒馆卡之前，强制先经过 `parseDocument`。
  1. **重复键（Duplicate Keys）**：很多经过复杂扩展合并或多次保存的 JSON 角色卡在深层字典存在重复 key，标准 `JSON.parse` 可正常覆盖解析，但 `uniqueKeys: true` 会判定语法错误；
  2. **严格告警（warnings）**：只要 `document.warnings.length > 0` 立即直接 throw。
  用户报错：`"JSON / YAML 无法解析：请检查语法；重复键、自定义标签、锚点引用和多文档暂不支持"`。

---

### 7. V1 卡（无 spec 的裸 JSON，name 在根）
- **结论**：**成立**（代码逻辑能跑通，标准 V1 卡能正常解析入库；但容错容水率极低）。
- **代码证据**：
  - [packages/persona-format/index.ts:55](file:///root/hermes-workspace/hds-android/packages/persona-format/index.ts#L55)：
    ```ts
    if ('spec' in value || typeof value.name === 'string') return [parseJsonCard(JSON.stringify(value))]
    ```
  - [packages/card-format/index.ts:24-30](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L24-L30)：
    ```ts
    let data = raw
    let format: Card['format'] = 'v1'
    if ('spec' in raw) { ... }
    ```
  - [packages/persona-format/index.ts:81-84](file:///root/hermes-workspace/hds-android/packages/persona-format/index.ts#L81-L84)：
    ```ts
    const target = card.format === 'v1' ? raw : raw.data as Record<string, unknown>
    ```
- **实际报错推演**：
  - **标准 V1 卡**：完全正常通过并保存，无报错。
  - **变体情况**：若 V1 卡使用了 `char_name` 或缺少根 `name` 字符串，在 `persona-format:55` 会直接穿透到 HDS 模式扫描，最终在行 70 报错：`"未找到 HDS 人设块，支持 typ0 下载的 koishi.yml、HDS JSON 或酒馆角色卡"`；若卡片标记了 `spec: "chara_card_v1"`，则在 `card-format:26` 报 `"暂不支持角色卡版本：chara_card_v1"`。

---

### 8. 其他未提及的“太大/结构问题”核心根因
盘点全链路发现以下 5 个关键爆点：
1. **单字段超 256 Ki 字符硬限制**（[packages/card-format/index.ts:14](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L14) 与 [packages/persona-format/index.ts:8](file:///root/hermes-workspace/hds-android/packages/persona-format/index.ts#L8)）：
   - `typeof value === 'string' && value.length > 262144`。
   - 酒馆卡内嵌表情差分（Sprites）通常以单条 Base64 存储在 `data.extensions` 中，一张差分通常在 300 KB~2 MB 之间，直接导致整卡被毙。
   - 用户报错：`"角色卡单字段超过 256 Ki 字符"`（或 `"配置文本字段过长"`）。
2. **PNG 图片像素超 1600 万限制**（[packages/card-format/index.ts:80](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L80)）：
   - `width * height > 16000000`。
   - 现今 AI 绘图生成的 4096×4096（16,777,216 像素）或 3000×6000 高清立绘卡直接撞线。
   - 用户报错：`"PNG 图片尺寸超过限制"`。
3. **PNG IEND 块后的尾随填充字节**（[packages/card-format/index.ts:83](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L83)）：
   - `if (length !== 0 || offset !== bytes.length) throw new Error('PNG 结束块损坏')`。
   - 网络传输、网盘下载经常会在文件末尾追加微量 padding，导致 `offset !== bytes.length`。
   - 用户报错：`"PNG 结束块损坏"`。
4. **Android 原生保存层 6 MiB 与 32 卡容量上限**（[android/app/.../HdsStore.kt:124, 132](file:///root/hermes-workspace/hds-android/android/app/src/main/java/io/hdsinterlude/android/HdsStore.kt#L124)）：
   - 安卓端保存卡时若序列化后的卡元数据超 6 MiB 会被拦截；角色库满 32 张也会拒存。
   - 用户报错：`"卡元数据超过限制"` 或 `"预览版角色库上限为 32 个"`。
5. **字段非 string 类型的强校验**（[packages/card-format/index.ts:33](file:///root/hermes-workspace/hds-android/packages/card-format/index.ts#L33)）：
   - 若第三方工具将 `mes_example` 导出为数组，或 `creator_notes` 导出为对象，直接抛出 `"data.xxx 必须是文本"`。

---

## 根因排序（按影响面由高到低，3-5 行）

1. **PNG 格式解析盲区与 Base64 严苛正则**（影响面极广）：漏判 `zTXt`/`iTXt` 块导致现代卡直接被当成“无元数据”；Base64 正则禁止换行导致只要带 `\r\n` 就报“损坏”。
2. **体积与单字段限制过严**（大卡主要死因）：单字段 256 Ki 拦截所有含差分立绘的卡；5 MiB 拦截大 JSON 卡；1600 万像素拦截 4K 高清卡。
3. **非 PNG 文件强制走严格 YAML 解析**（普通 JSON 误伤大）：未优先用轻量 `JSON.parse`，`uniqueKeys: true` 导致含重复 key 或 YAML 警告的合法 JSON 卡报语法错误。
4. **名称长度超 128 与 extensions 世界书静默丢失**（体验缺陷）：社区长标题角色卡被拒；非标准根字段的世界书在对话时不被加载。

*(详细的技术设计方案与修改规划已写入实施计划 Artifact：[card_import_repair_plan.md](file:///root/.gemini/antigravity-cli/brain/04ef0ddf-bc83-45b0-9456-cf0237302066/card_import_repair_plan.md)）*
