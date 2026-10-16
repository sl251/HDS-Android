# HDS-Android Preview 9 方案（2026-10-16 定稿，已获用户批准）

**核心原则：停新功能、停 QQ，只做 App 端体验收敛。执行人 Codex（gpt-6.1-sol + high），agy 干粗活/前端碎片。**

## 执行流程
1. 方案 → Codex 执行改造（按 M1/M2/M3 批次，主代理审 diff）
2. 每批次推分支 → CI（TS 单测 + gradle 单测 + Playwright UI + Robolectric）→ 据测试结果决定迭代，迭代同流程
3. 稳定后合并 main、构建稳定版推 GitHub

## M1（P0，前端/原生可并行）
- **P0-a 状态文案沉浸化**（纯前端，2–3 天）：
  - 用户消息「核心已接收，角色尚未必回复」→ 双勾已送达；角色回复后转已读
  - 角色消息「已显示」删除，只留时间戳；开场白改居中分隔线
  - 失败 → 「未送达·点击重试」；新增「正在输入…」三点气泡
  - **已读为派生视图**：仅存每会话 `lastCharacterReplyTs`（前端本地，按 cardId 分键），`已读 = lastCharacterReplyTs > msg.ts`，不落库回写（避免与 PRoot 双写冲突）
- **P0-b 后台角色消息通知**（动原生，3–4 天）：
  - 新通道 `character-messages`（IMPORTANCE_HIGH），常驻通知 ID 42 严禁复用；消息 ID = BASE + msgId.hashCode()
  - 通知由原生发（WebView 后台冻结）：标题=角色名、正文首行、BigTextStyle、大头像、点击带 cardId 跳会话
  - **反向唤醒**：Koishi 落库时经 bridge/本地 socket 主动推事件给宿主，60s health 轮询降级为兜底（Doze 会把轮询对齐到维护窗口）
  - health RPC 改拉增量（watermark 之后未读列表）
  - POST_NOTIFICATIONS 运行时权限（33+），被拒后提供「去系统设置」深链；发前查 areNotificationsEnabled
  - 免打扰 23:00–08:00 用 setSilent(true)，不动渠道
  - **dataSync 6h 上限**：Android 14+ 到期回调 onTimeout，需优雅保存状态；考虑 specialUse 申报
  - 别用 setFullScreenIntent

## M2（P1）
- **设置页重构**（3 天）：三层重组 A 个性化（外观+陪伴节奏）/ B 智能（模型/记忆/故事，改 LLM 类弹「下次回复生效」）/ C 数据；**角色卡移出设置升为顶栏入口**（内容资产非配置）；每项配置声明 affects: render|llm|schedule
- **P1-a 主动联系**（4 天）：三档节奏（偶尔关怀/贴近日常/频繁热络）+ 免打扰 + 状态透视（当前状态/预计下次/今日消耗）+「立即测试一次」端到端验证按钮；调度迁 Koishi 侧 + WorkManager 兜底
- **P1-b 人设导出**（3 天）：HDS 原生 JSON（无损默认）/ 酒馆 V2V3 PNG（card-format 已内置 CRC32，零依赖写 tEXt）/ 标准 JSON；Android 侧 MediaStore

## M3（P2）输入框、渲染与用户侧表情包
- **输入框与渲染**（5 天）：CJK 防误发（[\u4e00-\u9fa5\u3040-\u30ff] 组合键监听）、草稿保留、粘贴图片、思考折叠、图片灯箱（CSS dialog+pinch-zoom）、贴纸不套气泡
- **用户侧贴纸面板**（2026-10-16 用户确认加入）：输入框表情入口 → 贴纸抽屉 → 点击即发；建包支持多选导入与整文件夹 SAF 导入（文件夹名=包名，gif/png/webp 去重）；包管理（重命名/删除/排序）。库空时隐藏表情入口。
- **动效系统**（3 天，只做三处）：页面转场 / 消息 stagger 入场 / 勾选状态 morph
  - CSS 为主 90%，WAAPI 仅下拉面板手势；不引 framer-motion/GSAP
  - 只动 transform+opacity；token：--fast:120ms/--base:200ms/--slow:320ms + cubic-bezier(.2,0,0,1)
  - 禁：height/margin 动画、backdrop-filter 动画、transition:all、无限循环、shimmer、will-change 常驻
  - 长列表 content-visibility:auto + contain-intrinsic-size；prefers-reduced-motion 熔断
  - stagger 上限 6 条 animation-delay:calc(var(--i)*30ms)；双勾→已读用两 SVG 叠放只动 opacity

## Preview 9.1 待办（2026-10-17 定，用户确认）
- **贴纸包可见范围**：给包加「仅角色可用 / 仅我使用 / 双方共用」标记；注入角色目录时按标记过滤，用户侧抽屉同步过滤。实现量小（库结构加一个字段 + 两处过滤）。
- README FAQ 补一句贴纸导入入口（设置 → 表情包，空库时输入框笑脸入口隐藏是正常现象）。

## M4（P2）角色自主表达（2026-10-16 用户确认新增）
- **角色主动发表情包**：Koishi 侧把贴纸清单（编号+情绪标签）注入 prompt，回复携带贴纸标记，前端无气泡渲染；角色库=用户维护的库+可指定角色专属包
- **空库兜底（用户明确要求）**：表情包库为空时 prompt 不注入任何贴纸概念/标记语法（模型无从吐）；前端解析层剥离未知标记防乱码降级为纯文字；用户侧空库隐藏表情入口

## M5（P2）语音（2026-10-16 用户确认新增，原 P3 升格）
- 实测结论与请求示例：/root/hermes-workspace/xiaoyu-voice/mimo-tts-api-notes.md（三模型 2026-10-16 全跑通）
- **角色自主发语音**：回复可带语音，走 mimo-v2.5-tts（/v1/chat/completions，user 消息=风格指令，assistant 消息=正文）
- **音色自定义**：上传参考音频（mp3/wav ≤30s）存本地，base64 直填 audio.voice，无需注册训练；每角色可绑独立音色
- **音色工作台**：录音/导入 → 试听 → 命名保存；voicedesign 描述作为音色定义存本地
- **成本护栏**：TTS 按 token 计费走 Mimo key，用量上限做成设置项
- 消息流语音气泡可播放

## 测试策略（替代人工/模拟器）
- 所有自建 VPS 内存 <2G，**跑不了 Android 模拟器**（sydney 939M 无 KVM）
- **(a) Playwright UI 进 CI**（已有 tests/story-ui.mjs，mock bridge）+ **(c) Robolectric**（验证通道/ID/BigText/PendingIntent/6h 超时/反向唤醒）→ 覆盖 ~90%，增量 <半天
- **(b) 模拟器推迟**：P0-b 完成后用 Firebase Test Lab 免费额度补通知点击 E2E
- 真机验证（小米/OPPO/华为保活矩阵）仍需用户偶尔配合

## P3（已并入 M5，2026-10-16）

## 已归档调研
- docs/agy-ui-research.md（17KB：chatbox/rikkahub/lobe-chat/NativeTavern/SillyTavern/character-card-spec-v3，链接已核验）
- /tmp/glm-r1.txt、/tmp/glm-q1..q3.out（glm-5.3 三轮讨论原文；/tmp 会丢，需要时从本文档取结论）

## 环境事实
- 主模型已切 glm-5.3（config.yaml），兜底链 deepseek-v4.1-flash → deepseek-v4-pro
- 网关长请求会 relay_first_byte_timeout，讨论用短问短答（≤1700 字输入）
- Codex 委派：codex exec -C /root/hermes-workspace/hds-android --sandbox workspace-write -m gpt-6.1-sol -c model_reasoning_effort=high --json -o result.txt - < task.md
