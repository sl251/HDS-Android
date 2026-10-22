import { Context } from 'koishi'
import { HTTP } from '@cordisjs/plugin-http'
import { OpenAICompatibleEmbedder, RerankClient, classifyRetrievalError } from '../upstream/hds-interlude/src/narrator'
import { mapMobileConfig, normalizeMobileConfig } from './mobile-config'

export const PROBE_INPUT_LIMIT = 256 * 1024
export async function runModelProbe(input: any) {
  const task = input?.task
  if (!['embedding', 'rerank'].includes(task)) return { ok: false, task: 'embedding', category: 'configuration', elapsedMs: 0 }
  const started = Date.now()
  const ctx = new Context()
  try {
    const mobile = normalizeMobileConfig(input.mobileConfig)
    if (!Array.isArray(input.providers) || input.providers.length > 12) throw new Error('configuration')
    const mapped = mapMobileConfig(mobile, false)
    const config: any = { ...mapped.model, providers: input.providers }
    config[task] = { ...config[task], enabled: true }
    ctx.plugin(HTTP); await ctx.start()
    if (task === 'embedding') {
      const vector = await new OpenAICompatibleEmbedder(ctx, config).embed('A quiet morning.', { foreground: true })
      return { ok: true, task, category: 'succeeded', elapsedMs: Date.now() - started, vectorDimensions: vector.length }
    }
    const results = await new RerankClient(ctx, config).rerank('A quiet morning.', ['A quiet morning.', 'An evening walk.'], 2, { foreground: true })
    return { ok: true, task, category: 'succeeded', elapsedMs: Date.now() - started, resultCount: results.length }
  } catch (error) {
    const classified = classifyRetrievalError(error)
    return { ok: false, task, category: classified.category === 'network' && /configuration|生活设置|配置|整数|HTTP\(S\)/.test(String(error)) ? 'configuration' : classified.category, ...(classified.httpStatus ? { httpStatus: classified.httpStatus } : {}), elapsedMs: Date.now() - started }
  } finally { await ctx.stop().catch(() => {}) }
}
async function main() {
  let data = Buffer.alloc(0)
  try {
    for await (const chunk of process.stdin) {
      data = Buffer.concat([data, chunk])
      if (data.length > PROBE_INPUT_LIMIT) throw new Error('bounded_input')
    }
    const lines = data.toString('utf8').trim().split('\n')
    if (lines.length !== 1) throw new Error('single_input')
    const result = await runModelProbe(JSON.parse(lines[0]))
    process.stdout.write(`HDS_MODEL_PROBE ${JSON.stringify(result)}\n`)
  } catch { process.stdout.write('HDS_MODEL_PROBE {"ok":false,"task":"embedding","category":"configuration","elapsedMs":0}\n') }
}
if (process.env.HDS_MODEL_PROBE_MAIN === '1') void main()
