你是 HDS-Android 的实现负责人。项目根目录：/root/hermes-workspace/hds-android（main 分支，0.1.0-preview.8）。

## 输入（先完整读这两份）

- `HDS-Mobile-Plan/PREVIEW8.1-SPEC.md` —— 需求与缺陷原文（D1–D13，含源码证据）
- `HDS-Mobile-Plan/PREVIEW8.1-PLAN.md` —— 已审阅通过的实施方案，按它的 Phase 顺序执行

## 任务

按 PLAN 的 Phase 顺序逐阶段实现 Preview 8.1，每阶段完成后立刻运行该阶段验收命令并记录真实输出。

## 硬性要求

1. 严格按 PLAN 的改动文件清单与实现要点执行；实践发现 PLAN 与源码不符时以源码为准，并在验证记录里写明偏差与理由，不擅自扩大改动范围。
2. 每阶段验收：`npm run typecheck`，再跑该阶段相关单测（`node --import tsx --test tests/<name>.test.ts`）。
3. 全部阶段完成后跑 `npm test`（= build:host + 全量 node --test）必须全绿。
4. 新增测试放 `tests/` 下，命名 `<feature>.test.ts`；不修改既有测试断言，除非 PLAN 明确要求。
5. 若改动涉及 `upstream/hds-interlude/`：按 PLAN 说明同步 `scripts/patch-mobile-hds.mjs`，确保移动端打包能带上补丁；只改必要行。
6. 前端改动保持现有代码风格（React 18 + TS，无新依赖）。
7. 不提交 git。`package.json` version 与 `android/app/build.gradle` 版本元数据**仅在 P1–P4 全部验收通过后**按 PLAN Phase 4 第 5 点更新为 `0.1.0-preview.8.1`（versionCode 递增）；若任一步骤未通过则保持原值并说明。不动与任务无关的 android/ 与 upstream/ 文件。
8. 本机是 Linux：`npm run test:ui`（需 vite/浏览器）、`./gradlew ...`（需 Android SDK）、真机项若环境不具备**不要伪造**，在验证记录里标为「环境不具备/未验证」，并写清需要的环境。

## 交付

- 实际代码改动（工作区，不 commit）。
- `HDS-Mobile-Plan/evidence/sol-8.1-validation.md`：每阶段的真实命令、退出码、输出摘要、未通过项与原因、Android 真机必验清单。
- 最终回复用中文总结：各阶段状态、验证命令结果、遗留问题、真机必验项。

## 禁止

- 不输出任何密钥、token、凭据。
- 不用「已完成」等结论替代真实命令输出；无法验证的项如实标为未验证。