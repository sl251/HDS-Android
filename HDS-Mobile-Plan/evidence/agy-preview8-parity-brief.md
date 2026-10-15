# agy 派活：HDS 移动端"还原度"缺口盘点核对（preview.8 任务书素材）

工作目录：/root/hermes-workspace/hds-android

## 交付方式（先看）

1. 只读：不要修改/新建/删除任何文件，不要 git 操作，不要跑构建。
2. 禁止写脚本自查字符串，直接用读文件工具；步骤上限 20，读文件优先并行。
3. 结果用中文 markdown 输出到 stdout，不要写成文件。

## 背景

上游电脑版源码在 `upstream/hds-interlude/`（HDS-Interlude 1.0.1-rc51）。
移动端下发给上游的配置只有一个小对象：`runtime/host.ts:49-57`。
我需要一份"移动端相对电脑版缺失能力"的准确盘点，用于写 preview.8 任务书。

## 要产出

**表 1 — 上游配置分区全量**
遍历 `upstream/hds-interlude/src/index.ts` 里所有顶层 `Schema.object({...})` 配置分区，逐行给出：
分区名 | 定义起始行号 | enabled 默认值（该分区若有 enabled 字段） | 电脑版作用（引 description 原文要点，一句话）

**表 2 — 移动端下发现状**
以 `runtime/host.ts:49-57` 为准，逐项标注每个分区是「已下发」「缺失」还是「显式关闭」，缺失/关闭的写出上游默认值。

**表 3 — 无入口模块的接入代价**
针对这些移动端完全没入口的模块，各给一行：源文件 | 入口 API/导出名 | 是否依赖模型连接 | 是否依赖外部网络 | 是否需要新增 dispatch method（对照 `runtime/host.ts` 现有 dispatch 白名单）：
urge、agency、schedulePreplan、presetSync（share-sync）、chatActions+stickers、works、worldSeeder、weather、longHorizon（long-arc）。

**最后**
列出你核对中发现与下面这份清单冲突的地方（这份清单可能不准，发现错误要明确指出）：
- 上列九个模块默认关闭
- 移动端"主动"只有 autoAdvance 一个布尔 + 写死的 [10,20] 分钟补写
- 上游 `runAutoSync` / `interlude.preset.sync` 已实现
- 预设同步分区不含 model（API Key 不会被预设带走）

## 已知事实（不必重复验证，可直接采用）

- `host.ts:49-57` 下发了 storyDefaults / model / runtime / logging / timelineDirector / onebot，并显式 `qzone: {enabled:false}`、`browser: {enabled:false}`
- `host.ts:52` 的 runtime 里 `conversationFollowUpMinutes: input.autoAdvance ? [10, 20] : []`
- `upstream/hds-interlude/src/index.ts:577` 的 `presetSync.sections` 可选值共 18 个分区，不含 model
