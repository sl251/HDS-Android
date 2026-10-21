import { isContextDisposedError, type ModelConfig } from '../upstream/hds-interlude/src/narrator'
import { diagnosticError } from './message-diagnostics'

/** Credentials and request shape cannot recover by charging the same provider again. */
export function mobileRetryFilter(maxAttempts: number): NonNullable<ModelConfig['mobileRetryFilter']> {
  return async (error, { attempt }) => {
    const value = error as { code?: string; response?: { headers?: unknown }; headers?: unknown }
    if (isContextDisposedError(error) || ['HDS_MOBILE_BUDGET', 'HDS_MOBILE_TURN_DEADLINE', 'HDS_MOBILE_EARLY_REPLY'].includes(value?.code ?? '')) return 'abort'
    const reason = diagnosticError(error)
    if (['authentication', 'permission', 'provider_quota', 'invalid_request'].includes(reason)) return 'next'
    if (attempt < maxAttempts && ['rate_limit', 'throttled_or_quota'].includes(reason)) {
      const headers = value?.response?.headers ?? value?.headers
      const retryAfter = headers instanceof Headers ? headers.get('retry-after')
        : headers && typeof headers === 'object' ? Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1] : undefined
      const raw = String(retryAfter ?? '').trim()
      const seconds = raw ? Number(raw) : NaN
      const delay = raw && Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
        : raw && Number.isFinite(Date.parse(raw)) ? Math.max(0, Date.parse(raw) - Date.now())
        : 1500 + Math.random() * 1500
      await new Promise(resolve => setTimeout(resolve, Math.min(10_000, delay)))
    }
    return 'retry'
  }
}
