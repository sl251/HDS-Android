import type { ModelConfig } from '../upstream/hds-interlude/src/narrator'
import { resolveEffectiveEmbeddingTarget } from '../upstream/hds-interlude/src/model-routing'

/** Preserve desired settings; invalid optional retrieval never blocks chat startup. */
export function effectiveRetrievalConfig(model: ModelConfig) {
  const target = resolveEffectiveEmbeddingTarget(model)
  const desired = model.embedding?.enabled === true
  const embedding = { desired, effective: desired && !target.reason, reason: desired ? target.reason || undefined : 'disabled' }
  return { model: { ...model, embedding: { ...model.embedding!, enabled: embedding.effective } }, status: { embedding } }
}
