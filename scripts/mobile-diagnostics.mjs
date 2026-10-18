// Host overlay: observability and non-retryable rejection handling.
// No upstream source files or narrative decisions are changed.
export function withMessageDiagnostics(source, kind) {
  source = source.replace(/\r\n/g, '\n')
  const edit = (before, after) => {
    if (source.split(before).length !== 2) throw new Error(`Message diagnostics overlay anchor drift (${kind}): ${before.slice(0, 100)}`)
    source = source.replace(before, () => after)
  }
  const imports = "import { diagnosticEvent, diagnosticCall, diagnosticError, runMessageDiagnostics } from '../../../runtime/message-diagnostics'\n"
  if (kind === 'turn-engine') {
    edit('  content: string\n  occurredAt: Date', '  mobileMessageId?: string\n  content: string\n  occurredAt: Date')
    edit('turn.messages.push({ content, occurredAt: now,', "turn.messages.push({ mobileMessageId: session.platform === 'mobile-local' ? session.messageId : undefined, content, occurredAt: now,")
    return source
  }
  if (kind === 'service') {
    edit("await session.send(outgoingContent, { mobileVoice: message.voice } as any)", "await session.send(outgoingContent, { mobileVoice: message.voice, mobileTraceEntry: message.scriptEvent?.scriptEntryId } as any)")
    edit("await bot.sendMessage(privateChannelId, outgoingContent, undefined, { mobileVoice: message.voice } as any)", "await bot.sendMessage(privateChannelId, outgoingContent, undefined, { mobileVoice: message.voice, mobileTraceEntry: message.scriptEvent?.scriptEntryId } as any)")
    edit('  private async flushBufferedNarrative(key: string, revision: number) {', `  private async flushBufferedNarrative(key: string, revision: number) {
    const ids = (this.turnEngine.getTurn(key)?.messages ?? []).flatMap(message => message.mobileMessageId ? [message.mobileMessageId] : [])
    return runMessageDiagnostics((this.config.model as any).mobileDiagnostics, ids, () => this.mobileFlushWithDiagnostics(key, revision))
  }
  private async mobileFlushWithDiagnostics(key: string, revision: number) {`)
    edit('    if (!batch.length) return', "    if (!batch.length) return\n    diagnosticEvent('processing', 'started', { count: batch.length })")
    edit('        : narrative.decision\n      const sticker = this.resolveSticker(decision.localMedia, stickerCatalog)', `        : narrative.decision
      const sticker = this.resolveSticker(decision.localMedia, stickerCatalog)
      diagnosticEvent('sticker', sticker ? 'selected' : 'skipped', { count: stickerCatalog.length })`)
    edit('        const persisted = await this.persistDecision(current, currentParticipant, {', `        diagnosticEvent('decision', succeeded ? (sticker ? 'sticker_reply' : decision.interaction?.reply?.mode ?? 'unknown') : 'failed', {
          reason: succeeded && !sticker && !decision.interaction?.reply?.mode ? 'unavailable_structure' : undefined,
          willingness: decision.voice?.willingness,
        })
        const persisted = await this.persistDecision(current, currentParticipant, {`)
    edit('          await this.scheduleNarrativeRetry(current.id, currentParticipant.id, now)', "          diagnosticEvent('processing', 'retry')\n          await this.scheduleNarrativeRetry(current.id, currentParticipant.id, now)")
    edit("        this.reportStandalone('warn', '合并写作任务失败：参与者=%s 错误=%s', turn.participantId, error)", "        diagnosticEvent('processing', 'failed', { reason: diagnosticError(error) })\n        this.reportStandalone('warn', '合并写作任务失败：参与者=%s 错误=%s', turn.participantId, error)")
    edit('      this.turnEngine.endFlush(key, requestId)', "      diagnosticEvent('processing', turn.obsoleteRequestIds.has(requestId) ? 'requeued' : 'settled')\n      this.turnEngine.endFlush(key, requestId)")
    edit('      this.health?.recordNarrativeFailed(story.id)', "      diagnosticEvent('model', 'failed', { reason: diagnosticError(error) })\n      this.health?.recordNarrativeFailed(story.id)")
    edit('        return { obsolete: false, requeue: false, messages: persisted.messages, commit: persisted.commit, scriptEntry: persisted.scriptEntry }', "        diagnosticEvent('commit', 'succeeded', { entryId: persisted.scriptEntry?.id })\n        return { obsolete: false, requeue: false, messages: persisted.messages, commit: persisted.commit, scriptEntry: persisted.scriptEntry }")
  }
  if (kind === 'narrator') {
    const signature = "  private async requestProvider(provider: ProviderConfig, request: NarrativeRequest, overrides: ChatRequestOverrides = {}, usages: TokenUsageRecord[] = [], task = '主叙事'): Promise<NarrativeDecision> {"
    edit(signature, `${signature}
    return diagnosticCall('model', () => this.mobileRequestProvider(provider, request, overrides, usages, task), { providerSlot: Math.max(0, this.config.providers.findIndex(row => row.id === provider.id) + 1) })
  }
  private async mobileRequestProvider(provider: ProviderConfig, request: NarrativeRequest, overrides: ChatRequestOverrides = {}, usages: TokenUsageRecord[] = [], task = '主叙事'): Promise<NarrativeDecision> {`)
    // Repeating an explicitly rejected credential/quota request cannot repair it.
    // Keep the existing candidate order and configured fallback behavior.
    const rejected = "            failures.push(`${provider.label || provider.id} (attempt ${attempt}): ${detail}`)\n            this.logger?.debug(\n              '叙事模型服务商失败"
    edit(rejected, rejected.replace('            this.logger?.debug(', "            if (['provider_quota', 'authentication', 'permission'].includes(diagnosticError(error))) break\n            this.logger?.debug("))
  }
  return imports + source
}
