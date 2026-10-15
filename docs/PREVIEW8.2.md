# Preview 8.2 · 修复 preview.8.1 的图片发送回归

版本：0.1.0-preview.8.2，versionCode 18。基于 main 修复提交。

## 背景

preview.8.1 引入了"图片输入能力"字段 `imageInput`，用于在发送图片前提示模型是否支持图片。该字段默认值为 `unknown`（未声明），但门禁逻辑把 `unknown` 与 `unsupported`（明确不支持）同等对待并拦截发送。

从 8.0 及更早版本覆盖升级上来的用户，配置中不存在该字段，一律被判为"识图候选不支持图片"——即使已在「模型与识图」开启图片理解，发送图片仍被拦截并提示"识图模型未配置"。这是升级回归：preview.8 可以正常发送图片。

## 修复

- `visionRouteReason` 不再拦截 `unknown`：**只有明确声明 `unsupported` 的模型才提示改用独立识图模型**；未声明的模型按可发送处理，恢复 preview.8 的行为。
- 同步更新测试基线（原基线刻意断言 unknown 必拦），全量测试 46/46 通过，typecheck 0 错误。

## 验证

- 本机全量测试 `npm test` 46/46 通过（含 unknown 放行、unsupported 拦截、识图关闭拦截、暂停拦截等图片发送全分支）。
- `npm run typecheck` 0 错误。
- 真机图片发送待用户在 8.2 上确认。

## 已知问题

- 与 preview.8.1 相同：`.charx` 与 `zTXt` 压缩块的角色卡导入仍不支持。
- 保活自愈与长时（Doze / 厂商后台）验收仍待完成，见 PREVIEW8.md。
