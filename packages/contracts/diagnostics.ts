export type DiagnosticEvent = {
  id: string; at: number; requestIds: string[]; stage: string; outcome: string;
  messageId?: string; reason?: string; elapsedMs?: number; attempt?: number;
  count?: number; willingness?: number; mode?: string; entryId?: number; providerSlot?: number;
}
export const diagnosticLabels: Record<string, string> = {
  submission: '消息提交', processing: '回合处理', model: '模型调用', decision: '角色决策',
  sticker: '表情选择', voice: '语音处理', delivery: '最终投递', lifecycle: '运行状态', commit: '故事记录',
  queued: '等待处理', accepted: '核心已接收', started: '开始', succeeded: '成功',
  failed: '失败', unknown: '结果未确认', skipped: '跳过', delivered: '已投递',
  selected: '已选择', sticker_reply: '以表情回复', none: '本轮不回复', delayed: '计划稍后回复', immediate: '立即回复',
  interrupted: '运行已中断', requeued: '等待合并处理', settled: '本轮处理结束',
  generated: '语音已生成', retry: '核心安排重试',
}
export const diagnosticReasons: Record<string, string> = {
  provider_quota: '供应商报告余额或配额不足，请检查对应账户与 Key 的限额。',
  authentication: '供应商拒绝密钥，请检查密钥是否有效。',
  permission: '供应商拒绝访问，请检查模型权限。',
  rate_limit: '供应商限流；这不等于账户余额用尽。',
  throttled_or_quota: '供应商返回 429，未提供足够信息区分限流和配额。',
  background_budget: '达到本机后台模型预算；直接聊天不占该预算。',
  timeout: '请求超时，远端是否完成及计费情况未确认。',
  network: '连接失败，请检查网络和模型地址。',
  provider_error: '供应商服务异常。', invalid_request: '请求参数被拒绝。',
  unknown_error: '处理失败，未获得可安全分类的错误信息。',
  not_accepted: '故事未接收消息，请检查故事是否暂停。',
  unavailable_structure: '模型未返回明确的回复决策，不能据此认定角色选择沉默。',
  restart: '核心已重启；此前未完成步骤的最终结果未确认。',
  no_bridge: '本地语音服务未配置。', no_text: '本条没有可朗读文字。',
  invalid_bridge: '本地语音服务地址无效。',
  duplicate: '相同请求已接收，未重复提交模型。',
}
