import type { ScriptCommitDraft } from '../upstream/hds-interlude/src/script/contract'

/** A missing decision is text, never an implicit grant to synthesize speech. */
export function normalizeVoiceDecision(value: unknown): { willingness: number } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const willingness = (value as { willingness?: unknown }).willingness
  return typeof willingness === 'number' && Number.isFinite(willingness) && willingness >= 0 && willingness <= 1
    ? { willingness } : undefined
}

/** Keep the medium beside the durable outgoing action so outbox recovery does
 * not turn an already-authored voice reply into an undecided text reply. */
export function persistVoiceDecision(commit: ScriptCommitDraft, value: unknown) {
  const voice = normalizeVoiceDecision(value)
  if (!voice) return
  for (const event of commit.events) {
    if (event.kind === 'outgoing-message' || event.kind === 'group-message') {
      event.metadata = { ...event.metadata, mobileVoice: voice }
    }
  }
}

/** Only replace our voice extension; the upstream sticker contract stays intact. */
export function mobileVoicePrompt(prompt: string, voice?: { enabled: boolean; threshold?: number }) {
  if (!voice?.enabled) return prompt.replace(/CURRENT LOCAL VOICE OPTION:[^\n]*/g, '')
  const threshold = typeof voice.threshold === 'number' && Number.isFinite(voice.threshold) ? Math.max(0, Math.min(1, voice.threshold)) : .7
  return prompt.replace(/CURRENT LOCAL VOICE OPTION:[^\n]*/g,
    `CURRENT LOCAL VOICE OPTION: For a visible reply, evaluate whether speaking fits the protagonist, the conversation and the user's request. Return voice: {"willingness":0.0-1.0} at the TOP LEVEL of the same JSON object as script and interaction/groupReply, never inside reply or script. Use a low willingness for ordinary text; omit voice when no spoken reply is intended. Audio is chosen only when willingness reaches ${threshold}, subject to the configured cooldown and provider availability. Put the exact spoken words in interaction.reply.content (private) or groupReply.content (group), with mode="immediate" for a reply now. Example: {"interaction":{"reply":{"mode":"immediate","content":"你好。"}},"voice":{"willingness":0.9}}. Successful audio replaces that text bubble and preserves its transcript; failed synthesis keeps the original text. Voice changes only the delivery medium of authored reply content; keep other structured actions unchanged. Never write voice/audio markers or promise an unconfirmed audio send.`)
}
