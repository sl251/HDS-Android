/** Read a partial JSON tree without eval or guessing a string boundary. Only the
 * visible reply field is exported; script/reasoning never enter the UI. */
export function partialReply(text: string): string | undefined {
  if (text.length > 2_000_000) return
  let at = 0
  const space = () => { while (/\s/.test(text[at] ?? '') && at < text.length) at++ }
  const string = (): { value: string; complete: boolean } => {
    at++; let value = ''
    while (at < text.length) {
      const char = text[at++]
      if (char === '"') return { value, complete: true }
      if (char === '\\') {
        if (at >= text.length) break
        const escape = text[at++]
        if (escape === 'u') {
          if (text.length - at < 4) break
          const code = text.slice(at, at + 4); if (!/^[0-9a-f]{4}$/i.test(code)) throw new Error('escape')
          value += String.fromCharCode(parseInt(code, 16)); at += 4
        } else { const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }; if (!(escape in escapes)) throw new Error('escape'); value += escapes[escape] }
      } else { if (char.charCodeAt(0) < 32) throw new Error('control'); value += char }
    }
    // Never publish an incomplete surrogate pair.
    if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1)
    return { value, complete: false }
  }
  const parse = (depth = 0): { value: any; complete: boolean } => {
    if (depth > 30) throw new Error('depth'); space()
    if (text[at] === '"') return string()
    if (text[at] === '{' || text[at] === '[') {
      const array = text[at++] === '[', result: any = array ? [] : Object.create(null), end = array ? ']' : '}'
      while (at < text.length) {
        space(); if (text[at] === end) { at++; return { value: result, complete: true } }
        let key: string | number = array ? result.length : ''
        if (!array) { if (text[at] !== '"') break; const name = string(); if (!name.complete) break; key = name.value; if (key in result) throw new Error('duplicate key'); space(); if (text[at++] !== ':') break }
        const child = parse(depth + 1); result[key] = child.value
        if (!child.complete) break
        space(); if (text[at] === ',') { at++; continue }; if (text[at] === end) { at++; return { value: result, complete: true } }; break
      }
      return { value: result, complete: false }
    }
    const start = at; while (at < text.length && !/[,}\]\s]/.test(text[at])) at++
    const token = text.slice(start, at)
    try { return { value: JSON.parse(token), complete: at < text.length } } catch { return { value: undefined, complete: false } }
  }
  try {
    const reply = parse().value?.interaction?.reply
    if (reply?.mode !== 'immediate' || typeof reply.content !== 'string') return
    // Delay all markup until the normal final delivery sanitizer has run.
    return reply.content.split('<')[0].slice(0, 2000)
  } catch { return }
}
