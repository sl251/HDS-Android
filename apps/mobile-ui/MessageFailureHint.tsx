import React, { useEffect, useState } from 'react'
import { diagnosticsMessageFocus, type DiagnosticMessagesResult, type DiagnosticsMessageFocus, type NativeBridge } from '../../packages/contracts'
import { aggregateDiagnosticMessages, diagnosticReasonLabel } from './message-diagnostics'

/** Only actual model events can mark a narrative failure; receipts are unrelated. */
export function useMessageFailures(bridge: NativeBridge, healthy: boolean, cardId: string) {
  const [snapshot, setSnapshot] = useState<{ cardId: string; failures: Map<string, string> }>({ cardId: '', failures: new Map() })
  useEffect(() => {
    if (!healthy || !cardId) return
    let alive = true, running = false
    const read = async () => {
      if (running) return
      running = true
      try {
        const result = (await bridge.rpc({ method: 'diagnostics.messages' })).data as DiagnosticMessagesResult
        const failures = new Map<string, string>()
        for (const message of aggregateDiagnosticMessages(result?.events ?? [])) if (message.modelFailure) failures.set(message.id, message.modelFailure.reason ?? 'unknown_error')
        if (alive) setSnapshot({ cardId, failures })
      } catch { /* Missing diagnostics must not invent a failed model call. */ }
      finally { running = false }
    }
    void read(); const timer = setInterval(() => void read(), 3000)
    return () => { alive = false; clearInterval(timer) }
  }, [bridge, healthy, cardId])
  return healthy && snapshot.cardId === cardId ? snapshot.failures : undefined
}
export function MessageFailureHint({ messageId, reason, focus }: { messageId: string; reason: string; focus: (message: DiagnosticsMessageFocus) => void }) {
  return <div className="message-failure-hint" role="status" onContextMenu={event => event.stopPropagation()}>
    <span>该消息模型调用失败 · {diagnosticReasonLabel(reason)} · </span><button type="button" onClick={() => focus(diagnosticsMessageFocus(messageId))}>查看诊断</button>
  </div>
}
