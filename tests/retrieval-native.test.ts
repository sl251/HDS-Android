import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const native = (file: string) => readFileSync(`android/app/src/main/java/io/hdsinterlude/android/${file}.kt`, 'utf8')
test('Kotlin static contract matches generated schema limits, integer checks, endpoint isolation and guest lifecycle', () => {
  const tsSchema = readFileSync('packages/contracts/mobile-config.schema.json', 'utf8')
  assert.equal(tsSchema, readFileSync('android/app/src/main/assets/mobile-config.schema.json', 'utf8'))
  const schema = JSON.parse(tsSchema)
  for (const key of ['embedding', 'rerank']) for (const field of schema.sections.find((s: any) => s.key === key).fields) {
    if (field.type === 'string') assert.equal(field.maxLength, field.key === 'endpoint' ? 2048 : field.key === 'model' ? 256 : 64)
    if (['timeout', 'dimensions', 'topN'].includes(field.key)) assert.equal(field.step, 1)
  }
  const codec = native('MobileSettingsCodec'), endpoint = native('ModelEndpoint'), runtime = native('HdsRuntime'), plugin = native('HdsRuntimePlugin')
  for (const text of ['rawValue.trim()', 'field.optInt("maxLength"', '应为整数', '连接编号无效', 'validateRetrievalEndpoint(value)']) assert.ok(codec.includes(text), text)
  for (const text of ['uri.userInfo == null', 'uri.fragment == null', 'uri.host', 'http', 'https']) assert.ok(endpoint.includes(text))
  for (const text of ['models.testRetrieval', 'models.cancelRetrieval', 'retrievalIo.execute', 'models.test']) assert.ok(plugin.includes(text))
  for (const text of ['modelProbeBusy.compareAndSet', 'modelProbeDone.await', 'killProbeGroup(modelProbeGroup', '15000 + timeout + 5000', 'request.size <= 256 * 1024', 'ModelProbeResult.sanitize', 'HDS_MODEL_PROBE_MAIN', '1.0.1-rc57']) assert.ok(runtime.includes(text), text)
  assert.ok(native('ModelProbeResult').includes('vectorDimensions')); assert.doesNotMatch(native('ModelProbeResult'), /put\("(?:apiKey|endpoint|error|url)"/)
})
