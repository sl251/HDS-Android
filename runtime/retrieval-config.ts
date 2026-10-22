import type { ModelConfig } from '../upstream/hds-interlude/src/narrator'
import { resolveEffectiveEmbeddingTarget, resolveEffectiveRerankTarget } from '../upstream/hds-interlude/src/model-routing'

/** Preserve desired settings; invalid optional retrieval never blocks chat startup. */
export function effectiveRetrievalConfig(model: ModelConfig) {
  const target = resolveEffectiveEmbeddingTarget(model)
  const desired = model.embedding?.enabled === true
  const embedding = { desired, effective: desired && !target.reason, reason: desired ? target.reason || undefined : 'disabled' }
  const rerankTarget = resolveEffectiveRerankTarget(model), rerankDesired = model.rerank?.enabled === true
  const rerank = { desired: rerankDesired, effective: rerankDesired && !rerankTarget.reason, reason: rerankDesired ? rerankTarget.reason || undefined : 'disabled' }
  return { model: { ...model, rerank: { ...model.rerank!, enabled: rerank.effective }, embedding: { ...model.embedding!, enabled: embedding.effective } }, targets: { embedding: { providerId: target.provider?.id, model: target.model, endpointSource: target.endpointSource, modelSource: target.modelSource }, rerank: { providerId: rerankTarget.provider?.id, model: rerankTarget.model, endpointSource: model.rerank?.endpoint ? 'explicit' : 'derived', modelSource: 'explicit' } }, status: { embedding, rerank } }
}
