# Preview 8.1 主代理决定记录（追加）

## 决定 1：点「＋」跳转设置页 —— **保留跳转，只补提示**（用户 2026-10-16 明确）

- 用户原话：「ui文字就提示用户开启识图模型吧，其实跳转了也没事，现在这版就是缺了提示而已」
- 结论：**不要**移除 `main.tsx` 中 `if (!settingsRef.current.modelOptions.visionEnabled) setPage('settings')` 的跳转；识图未开启时「提示 + 跳去设置」是期望行为。
- 因此取消我此前提出的"补刀：去掉强制 setPage('settings')"计划 —— 不要执行。
- Sol 当前实现（`main.tsx` `imageEntryReason` + `attachmentReason`）已满足：五种不可用原因均有文案，识图未开启时提示后跳设置页。
- 可选微调（非必须）：文案更直白，例如「请到模型设置开启图片理解（识图模型）」。改动时保持提示 + 跳转行为不变。

## 决定 2：真正要修的识图问题是这条

- 「已勾选图片理解但保存未生效/未重启」→ 点「＋」不提示、选图上传都成功、发送时才报「重启后生效」。
- 由 P1 的 `syncStatus` 扩充（`visionRestartRequired`）解决，与决定 1 无关，继续按 PLAN 执行。
