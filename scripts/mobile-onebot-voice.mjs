import { readFile } from 'node:fs/promises'
import { withMessageDiagnostics } from './mobile-diagnostics.mjs'

// Host-owned build overlay against the already replayed rc57 mobile delta.
// Never writes upstream/. Each edit must match exactly once (or be applied).
export function withOneBotVoice(source) {
  source = source.replace(/\r\n/g, '\n')
  const edits = [
    ["      return voice?.enabled ? { platform: 'local', quoteReply: false, reactions: [], voice } : undefined", "      return { platform: 'local', quoteReply: false, reactions: [], expressionThreshold: this.expressionThreshold, ...(voice?.enabled ? { voice } : {}) }"],
    ["const canEarlyReply = onEarlyReply && !chatCapabilities?.voice?.enabled", "const canEarlyReply = onEarlyReply && !stickerCatalog.length && !chatCapabilities?.voice?.enabled"],
    ["session.bot.sendMessage(channelId, h('img', { src: fileSrc }))", "((this.config.model as any).mobileStickerDelivery?.(session.bot, channelId, fileSrc, !!groupId, () => session.bot.sendMessage(channelId, h('img', { src: fileSrc }))) ?? session.bot.sendMessage(channelId, h('img', { src: fileSrc })))"],
    ["session.bot.sendMessage(channelId, h('img', { src }))", "((this.config.model as any).mobileStickerDelivery?.(session.bot, channelId, src, !!groupId, () => session.bot.sendMessage(channelId, h('img', { src }))) ?? session.bot.sendMessage(channelId, h('img', { src })))"],
    ["    let immediateObservations: WebObservation[] = []", `    // QQ voice reuses mobile capabilities before early-reply eligibility.
    if (!groupContext && (participant?.platform ?? story.platform) === 'onebot') {
      const voice = this.config.model.mobileVoiceCapabilities?.()
      if (voice?.enabled) chatCapabilities = { ...(chatCapabilities ?? { platform: 'qq', quoteReply: false, reactions: [], expressionThreshold: this.expressionThreshold }), voice }
    }
    let immediateObservations: WebObservation[] = []`],
    ["      const chatCapabilities = this.groupChatCapabilities(session, groupContext.messages)", `      let chatCapabilities = this.groupChatCapabilities(session, groupContext.messages)
      if (session?.platform === 'onebot') {
        const voice = this.config.model.mobileVoiceCapabilities?.()
        if (voice?.enabled) chatCapabilities = { ...(chatCapabilities ?? { platform: 'qq', quoteReply: false, reactions: [], expressionThreshold: this.expressionThreshold }), voice }
      }`],
    ["await withTransportTimeout(session.send(outgoingContent), 'private-session-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(session.bot, session.channelId, outgoingContent, message.voice?.willingness, () => withTransportTimeout(session.send(outgoingContent), 'private-session-send')) ?? withTransportTimeout(session.send(outgoingContent), 'private-session-send'))"],
    ["await withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(bot, privateChannelId, outgoingContent, message.voice?.willingness, () => withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send')) ?? withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send'))"],
    ["onDelivered: (index: number, content: string) => void }) {", "onDelivered: (index: number, content: string) => void }, voice?: { willingness: number }) {"],
    ["this.sendGroupMessage(snapshot.story, channelId, result.content, result.chatActions.replyTo?.messageId, session)", "this.sendGroupMessage(snapshot.story, channelId, result.content, result.chatActions.replyTo?.messageId, session, undefined, undefined, undefined, decision.voice)"],
    ["      } })\n      : { deliveredSegments: [], complete: false, segmentOutcomes:", "      } }, message.voice)\n      : { deliveredSegments: [], complete: false, segmentOutcomes:"],
    ["await withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(bot, transportGroupId, outgoing, voice?.willingness, () => withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send')) ?? withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send'))"],
    ["    if (commit) {\n      const validation = validateScriptCommit", "    if (commit) {\n      persistVoiceDecision(commit, raw.voice)\n      const validation = validateScriptCommit"],
    ["      content: current.content,\n      ...(current.endpointId", "      content: current.content,\n      voice: normalizeVoiceDecision(current.event.metadata?.mobileVoice),\n      ...(current.endpointId"],
    ["              content: segment, visibleMessage: true, userInitiated: message.userInitiated === true,", "              content: segment, visibleMessage: true, userInitiated: message.userInitiated === true,\n              ...(normalizeVoiceDecision(message.voice) ? { mobileVoice: normalizeVoiceDecision(message.voice) } : {}),"],
  ]
  for (const [index, [before, after]] of edits.entries()) {
    if (source.split(after).length === 2) continue
    if (source.split(before).length !== 2) throw new Error(`OneBot voice overlay unknown/ambiguous anchor #${index + 1}`)
    source = source.replace(before, () => after)
  }
  // Both timer delivery and advanceStory's due-intent path restore the same hint.
  const before = '...restoreDesktopContext(intent.payload),'
  const after = before + '\n            voice: normalizeVoiceDecision(intent.payload?.mobileVoice),'
  if (source.split(after).length !== 3) {
    if (source.split(before).length !== 3) throw new Error('Voice split delivery overlay unknown/ambiguous anchor')
    source = source.replaceAll(before, after)
  }
  const imports = "import { normalizeVoiceDecision, persistVoiceDecision } from '../../../runtime/voice-decision'\n"
  return source.startsWith(imports) ? source : imports + source
}

export const oneBotVoiceOverlay = {
  name: 'mobile-onebot-voice',
  setup(build) {
    build.onLoad({ filter: /[\\/]upstream[\\/]hds-interlude[\\/]src[\\/](service|narrator|turn-engine)\.ts$/ }, async ({ path }) => {
      const kind = path.split(/[\\/]/).at(-1).replace('.ts', '')
      const source = await readFile(path, 'utf8')
      return { contents: withMessageDiagnostics(kind === 'service' ? withOneBotVoice(source) : source, kind), loader: 'ts' }
    })
  },
}
