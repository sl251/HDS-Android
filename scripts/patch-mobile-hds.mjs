import { readFileSync, writeFileSync } from 'node:fs'
const directory = 'upstream/hds-interlude/src'
for (const name of ['endpoints.ts', 'types.ts', 'service.ts']) {
  const path = `${directory}/${name}`
  let source = readFileSync(path, 'utf8')
  source = source.replaceAll("'qq' | 'wechat'", "'qq' | 'wechat' | 'local'").replaceAll("'qq' | 'wechat' | 'local' | 'local'", "'qq' | 'wechat' | 'local'")
  if (name === 'endpoints.ts') {
    source = source.replace("channelKind: 'qq', platform: story.platform", "channelKind: story.platform === 'mobile-local' ? 'local' : 'qq', platform: story.platform")
    source = source.replace("channelKind: 'qq', platform: participant.platform", "channelKind: participant.platform === 'mobile-local' ? 'local' : 'qq', platform: participant.platform")
    source = source.replace("const channelKind = row.channelKind === 'wechat' ? 'wechat' : 'qq'", "const channelKind = row.channelKind === 'local' ? 'local' : row.channelKind === 'wechat' ? 'wechat' : 'qq'")
    source = source.replace("return row?.channelKind === 'wechat' ? 'wechat' : 'qq'", "return row?.channelKind === 'local' ? 'local' : row?.channelKind === 'wechat' ? 'wechat' : 'qq'")
  }
  writeFileSync(path, source)
}
const path = `${directory}/narrator.ts`
let source = readFileSync(path, 'utf8')
if (!source.includes('mobileCardPrompt?:')) {
  source = source.replace('export interface ModelConfig {', "export interface ModelConfig {\n  /** Android host: character context only; engine protocol remains first. */\n  mobileCardPrompt?: (request: NarrativeRequest) => { before: string; after: string }\n")
  const anchor = '    let earlyReplyHandled = false'
  if (!source.includes(anchor)) throw new Error('Narrator patch anchor changed')
  source = source.replace(anchor, "    // Android character-card context is separate from the engine contract and history.\n    const mobileCard = this.config.mobileCardPrompt?.(request)\n    if (mobileCard?.before) requestBody.messages.splice(1, 0, { role: 'system', content: mobileCard.before })\n    if (mobileCard?.after) requestBody.messages.push({ role: 'system', content: mobileCard.after })\n" + anchor)
}
writeFileSync(path, source)
console.log('Applied narrow local-channel and character-context patches')
