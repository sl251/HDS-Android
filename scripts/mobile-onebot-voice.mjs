import { readFile } from 'node:fs/promises'

// Host-owned build overlay against the already replayed rc56 mobile delta.
// Never writes upstream/. Each edit must match exactly once (or be applied).
export function withOneBotVoice(source) {
  source = source.replace(/\r\n/g, '\n')
  const edits = [
    ["const canEarlyReply = onEarlyReply && !chatCapabilities?.voice?.enabled", "const canEarlyReply = onEarlyReply && !stickerCatalog.length && !chatCapabilities?.voice?.enabled"],
    ["session.bot.sendMessage(channelId, h('img', { src: fileSrc }))", "((this.config.model as any).mobileStickerDelivery?.(session.bot, channelId, fileSrc, !!groupId, () => session.bot.sendMessage(channelId, h('img', { src: fileSrc }))) ?? session.bot.sendMessage(channelId, h('img', { src: fileSrc })))"],
    ["session.bot.sendMessage(channelId, h('img', { src }))", "((this.config.model as any).mobileStickerDelivery?.(session.bot, channelId, src, !!groupId, () => session.bot.sendMessage(channelId, h('img', { src }))) ?? session.bot.sendMessage(channelId, h('img', { src })))"],
    ["    let immediateObservations: WebObservation[] = []", `    // QQ voice reuses mobile capabilities before early-reply eligibility.
    if (!groupContext && (participant?.platform ?? story.platform) === 'onebot') {
      const voice = this.config.model.mobileVoiceCapabilities?.()
      if (voice?.enabled) chatCapabilities = { ...(chatCapabilities ?? { platform: 'qq', quoteReply: false, reactions: [] }), voice }
    }
    let immediateObservations: WebObservation[] = []`],
    ["      const chatCapabilities = this.groupChatCapabilities(session, groupContext.messages)", `      let chatCapabilities = this.groupChatCapabilities(session, groupContext.messages)
      if (session?.platform === 'onebot') {
        const voice = this.config.model.mobileVoiceCapabilities?.()
        if (voice?.enabled) chatCapabilities = { ...(chatCapabilities ?? { platform: 'qq', quoteReply: false, reactions: [] }), voice }
      }`],
    ["await withTransportTimeout(session.send(outgoingContent), 'private-session-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(session.bot, session.channelId, outgoingContent, message.voice?.willingness, () => withTransportTimeout(session.send(outgoingContent), 'private-session-send')) ?? withTransportTimeout(session.send(outgoingContent), 'private-session-send'))"],
    ["await withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(bot, privateChannelId, outgoingContent, message.voice?.willingness, () => withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send')) ?? withTransportTimeout(bot.sendMessage(privateChannelId, outgoingContent), 'private-bot-send'))"],
    ["onDelivered: (index: number, content: string) => void }) {", "onDelivered: (index: number, content: string) => void }, voice?: { willingness: number }) {"],
    ["this.sendGroupMessage(snapshot.story, channelId, result.content, result.chatActions.replyTo?.messageId, session)", "this.sendGroupMessage(snapshot.story, channelId, result.content, result.chatActions.replyTo?.messageId, session, undefined, undefined, undefined, decision.voice)"],
    ["      } })\n      : { deliveredSegments: [], complete: false, segmentOutcomes:", "      } }, message.voice)\n      : { deliveredSegments: [], complete: false, segmentOutcomes:"],
    ["await withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send')", "await ((this.config.model as any).mobileOneBotVoiceDelivery?.(bot, transportGroupId, outgoing, voice?.willingness, () => withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send')) ?? withTransportTimeout(bot.sendMessage(transportGroupId, outgoing), 'group-send'))"],
  ]
  for (const [index, [before, after]] of edits.entries()) {
    if (source.split(after).length === 2) continue
    if (source.split(before).length !== 2) throw new Error(`OneBot voice overlay unknown/ambiguous anchor #${index + 1}`)
    source = source.replace(before, () => after)
  }
  const before = '      const sticker = this.resolveSticker(decision.localMedia, stickerCatalog)'
  const after = before + `
      // A catalog-backed sticker is a complete reply, never a text/voice attachment.
      if (sticker) {
        decision.localMedia = { ...decision.localMedia!, placement: 'standalone' }
        if (decision.interaction) decision.interaction.reply = { mode: 'none' }
        if (decision.groupReply) decision.groupReply = { mode: 'none' }
        decision.voice = undefined
      }`
  if (source.split(after).length !== 3) {
    if (source.split(before).length !== 3) throw new Error('Media selection overlay unknown/ambiguous anchor')
    source = source.replaceAll(before, after)
  }
  return source
}

export const oneBotVoiceOverlay = {
  name: 'mobile-onebot-voice',
  setup(build) {
    build.onLoad({ filter: /[\\/]upstream[\\/]hds-interlude[\\/]src[\\/]service\.ts$/ }, async ({ path }) => ({ contents: withOneBotVoice(await readFile(path, 'utf8')), loader: 'ts' }))
  },
}
