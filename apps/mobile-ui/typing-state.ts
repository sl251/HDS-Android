import type { DiagnosticEvent } from '../../packages/contracts/diagnostics'

/** Receipts and queued work do not mean a reply is being written. */
export function characterIsTyping(events: DiagnosticEvent[], now = Date.now(), deadlineMs = 240000): boolean {
  const active = new Map<string, number>()
  const ttl = Math.max(60000, Math.min(600000, deadlineMs))
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    const starts = (event.stage === 'processing' || event.stage === 'model') && event.outcome === 'started'
    const ends = (event.stage === 'processing' && ['settled', 'failed', 'requeued', 'retry'].includes(event.outcome))
      || (event.stage === 'model' && event.outcome === 'failed')
      || (event.stage === 'decision' && ['none', 'delayed', 'failed', 'unknown'].includes(event.outcome))
      || (event.stage === 'delivery' && ['delivered', 'failed'].includes(event.outcome))
      || (event.stage === 'lifecycle' && event.outcome === 'interrupted')
    for (const id of event.requestIds) {
      if (starts) active.set(id, event.at)
      else if (ends) active.delete(id)
    }
  }
  return [...active.values()].some(at => at <= now && now - at < ttl)
}
