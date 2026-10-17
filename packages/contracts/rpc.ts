/** Public native-to-host RPC surface. Plugin-only model methods stay explicit. */
export const hostMethods = [
  'config.status', 'preset.sync', 'preset.syncStatus', 'images.upload', 'images.get',
  'memory.facts', 'memory.factSources', 'maintenance.start', 'maintenance.status',
  'health', 'messages.history', 'messages.since', 'messages.sendLocal', 'story.snapshot',
  'story.applySetting', 'story.pause', 'story.resume', 'qq.status', 'qq.install',
  'qq.start', 'qq.stop', 'qq.refreshQr', 'qq.accounts', 'qq.quickLogin', 'qq.policy',
  'qq.conversations', 'qq.history', 'qq.send', 'voice.status', 'network.update',
] as const
export type RpcMethod = typeof hostMethods[number] | 'models.test' | 'models.list' | 'preset.commit' | 'preset.commitStatus'
