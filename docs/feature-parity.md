> preview.8 更新：配置分区行已按实际代码更新为 PARTIAL / UPSTREAM_DEFAULT / DISABLED 等状态，证据指向具体实现与测试。命令行清单仍是初始盘点，不能把 NOT_IMPLEMENTED 一概理解为相应产品能力不存在。详情见 [PREVIEW8.md](PREVIEW8.md)。

# feature-parity.csv 说明

`docs/feature-parity.csv` 由 `scripts/inventory-hds.mjs` 从上游 HDS-Interlude 固定提交
`9a77fadb88c6e57914ebac8ca75cf54a27354d01` 的 `src/index.ts` 用 TypeScript AST 机械盘点生成，
列出**上游已有的全部 23 个顶层配置分区和 46 个 `ctx.command` 命令**。

因此：

- 表中 `mobile_status` 列的默认值 `NOT_IMPLEMENTED` 是**盘点基线，不是"本移动端没做"的结论**。
  脚本只做盘点，不判断实现状态；只有人工确认后才改写该列。
- 本仓库用**不同的产品形态**承接上游能力：上游靠 Koishi Console 配置区和聊天命令驱动，
  移动端把这些能力重组为「故事 / 见闻 / 信箱 / 空间」四个页面和原生交互。
  同一能力两边的入口不同，不能按命令名逐条比对。
- `docs/evidence/T01/baseline.md` 记录的同一结论：这不是移动端支持声明，
  也不代表已盘点每个嵌套配置字段。

判断某能力是否可用，请看对应版本的说明文档（`docs/PREVIEW7.md`、`docs/QQ-ROADMAP.md` 等）
和 `mobile_status` 为 `EXPERIMENTAL` 的行，而不是这张表。

## 与上游的对应关系（示例）

| 上游能力 | 移动端入口 | 说明 |
| --- | --- | --- |
| `storyDefaults` | 空间 → 故事与身份 | 称呼、人设、持续生活开关 |
| `model` | 空间 → 模型与识图 | 主叙事/记忆/Alter/识图分工 |
| `memory` / `overlay` | 见闻 → 长期记忆 | 整理、补充、停用、清理演化 |
| `interlude.reset` | 空间 → 存档与故事管理 → 从当前人设重新开始 | 目录替换实现，保留本机备份 |
| `onebot` | 信箱 | 扫码登录、白名单、私聊与 @ 群聊 |
