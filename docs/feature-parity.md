> Preview 9.5.2 当前执行基线：rc57 @ `ab512ec6b9dc00b9f738c062fe576e711a739151`，#10/#14 从 `9bdd5ac776dd682911edb9b48d1e7eaedd720dbe` 最小移植。向量配置、同栈 probe、索引身份与降级诊断已接入；**外部 rerank 是 Android 扩展，不属于上游 parity**，默认关闭，仅用于主叙事 durable facts。旧 CSV 的 rc56 AST 盘点是历史记录，不能当作嵌套字段支持清单。配置与验收边界见 [PREVIEW9.5.2.md](PREVIEW9.5.2.md)。

> preview.8 更新：配置分区行已按实际代码更新为 PARTIAL / UPSTREAM_DEFAULT / DISABLED 等状态，证据指向具体实现与测试。命令行清单仍是初始盘点，不能把 NOT_IMPLEMENTED 一概理解为相应产品能力不存在。详情见 [PREVIEW8.md](PREVIEW8.md)。

# feature-parity.csv 说明

`docs/feature-parity.csv` 由 `scripts/inventory-hds.mjs` 从上游 HDS-Interlude `1.0.1-rc56` 固定提交
`b683bafcac42c99a45929e0516195f033f969665` 的 `src/index.ts` 用 TypeScript AST 机械盘点生成，
列出**上游已有的全部 23 个顶层配置分区和 46 个 `ctx.command` 命令**。

Preview 9.1 M0 已对 rc56 重新运行 AST 盘点，仍为 23 个顶层分区、46 个命令；按 `(kind, feature)` 保留已有人工 `mobile_status` / `evidence`，只刷新上游描述及位置。上游预设同步允许的分区新增 `weather`，它已存在于顶层配置，故数量不变；移动端仍由 `supportedFields` 筛选。

复现：先用固定提交的 `git archive` 解出原始树，再执行 `node scripts/inventory-hds.mjs /path/to/rc56/src/index.ts`。无参数时读取 vendored 源码（其中移动补丁会使部分行号偏移）；脚本输出默认状态，覆盖 CSV 前须保存并按上述键回填人工状态及证据。

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
| `storyDefaults` | 空间 → 生活与世界 → 修改故事设定（聊天主角菜单也可进入） | 当前故事主角、人设、世界、关系、视角、时区与补充事实；`story.applySetting` |
| `model` | 空间 → 模型与系统 → 任务分工 / 图片理解 | 主叙事、记忆压缩、Alter、向量、世界播种与识图分工 |
| `memory` / `overlay` | 见闻 → 长期记忆 | 整理、补充、停用、清理演化 |
| `interlude.reset` | 空间 → 生活与世界 → 故事管理 → 从当前人设重新开始 | 目录替换实现，保留本机备份 |
| `onebot` | 信箱 | 扫码登录、白名单、私聊与 @ 群聊 |

Preview 9.1 M4：空间首屏只保留运行卡片和「日常与表达 / 生活与世界 / 模型与系统」三个二级入口。六个生活与世界配置分区直接使用 schema 生成两层折叠；`schedulePreplan` / `timelineDirector` 默认开启，`worldSeeder` / `longHorizon` / `weather` 默认关闭。记忆上下文和事实均默认 20 条、最高 20 条；向量检索开关在记忆高级组，与模型分工联动。完整命令、测试与环境限制见 [M4 验收记录](../artifacts/preview9.1-m4/ACCEPTANCE.md)。
