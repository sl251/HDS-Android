import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
async function probe(input: unknown, raw?: string) {
  const child = spawn(process.execPath, ['runtime/generated/model-probe.cjs'], { env: { ...process.env, HDS_MODEL_PROBE_MAIN: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
  let out = '', err = ''; child.stdout.on('data', c => { out += c }); child.stderr.on('data', c => { err += c }); child.stdin.end(raw ?? JSON.stringify(input) + '\n')
  const code = await new Promise(r => child.on('exit', r)); assert.equal(code, 0); assert.equal(err, ''); assert.equal(out.trim().split('\n').length, 1)
  assert.ok(out.length < 4096); assert.doesNotMatch(out, /mock-secret|127\.0\.0\.1|apiKey|embedding":\[/)
  return JSON.parse(out.trim().slice('HDS_MODEL_PROBE '.length))
}
test('built standalone guest probe executes exactly one request per task with bounded secret-free output', async () => {
  let count = 0
  const server = createServer(async (req, res) => { count++; for await (const chunk of req) {} res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(req.url?.endsWith('rerank') ? { results: [{ index: 1, relevance_score: 1 }] } : { data: [{ embedding: [1, 2, 3] }] })) })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const endpoint = `http://127.0.0.1:${(server.address() as any).port}/v1`
  const providers = [{ id: 'probe', enabled: true, endpoint, model: 'chat', apiKey: 'mock-secret', useForEmbedding: true }]
  try {
    const embedding = await probe({ task: 'embedding', providers, mobileConfig: { sections: { embedding: { enabled: false, model: 'vector' } } } }); assert.equal(embedding.vectorDimensions, 3); assert.equal(embedding.ok, true)
    const rerank = await probe({ task: 'rerank', providers, mobileConfig: { sections: { rerank: { enabled: false, providerId: 'probe', model: 'ranker' } } } }); assert.equal(rerank.resultCount, 1); assert.equal(rerank.ok, true)
    assert.equal(count, 2)
    assert.equal((await probe({}, 'a'.repeat(256 * 1024 + 1))).ok, false); assert.equal(count, 2)
    const source = readFileSync('runtime/model-probe.ts', 'utf8'); assert.doesNotMatch(source, /SQLiteDriver|new InterludeService|app\.plugin/)
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
})
