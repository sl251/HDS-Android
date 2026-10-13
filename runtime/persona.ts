import type { Card } from '../packages/card-format'
import type { StoryDefaults } from '../upstream/hds-interlude/src/service'
import type { StorySetting } from '../upstream/hds-interlude/src/types'
import { storyDefaultsToSettingPatch } from '../upstream/hds-interlude/src/share-sync'

export function personaDefaults(card: Card, userProfile: string): Partial<StoryDefaults> {
  if (card.format === 'hds' && card.hds) {
    return { ...card.hds.storyDefaults, characterName: card.name, characterProfile: card.description, world: card.scenario,
      userProfile: userProfile.trim() || String(card.hds.storyDefaults.userProfile ?? ''), timezone: String(card.hds.storyDefaults.timezone || 'Asia/Shanghai') } as Partial<StoryDefaults>
  }
  return { characterName: card.name, characterProfile: [`[角色描述]\n${card.description}`, `[性格]\n${card.personality}`].join('\n\n'), world: card.scenario, userProfile, timezone: 'Asia/Shanghai' }
}

/** Apply only explicit card edits to an existing story; its user identity/history remain intact. */
export function personaEditPatch(card: Card): Partial<StorySetting> {
  const defaults = personaDefaults(card, '')
  const patch = storyDefaultsToSettingPatch(defaults)
  delete patch.user
  patch.character = { name: card.name, profile: String(defaults.characterProfile) }
  patch.world = card.scenario
  if (card.format === 'hds' && card.hds) {
    // Editor values are explicit replacements, including intentionally emptied fields.
    for (const key of ['relationship', 'location', 'perspective', 'supportingCast', 'style'] as const) {
      if (key in card.hds.storyDefaults) patch[key] = String(card.hds.storyDefaults[key])
    }
    for (const key of ['perspectives', 'supplementaryFacts'] as const) {
      if (key in card.hds.storyDefaults) patch[key] = card.hds.storyDefaults[key] as string[]
    }
  }
  return patch
}
