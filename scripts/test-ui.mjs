import { spawnSync } from 'node:child_process'

const failures = []
for (const name of ['story', 'preview91-m4', 'qq-policy', 'share-persona', 'm5', 'import-code', 'retrieval', 'typing']) {
  const script = `tests/${name}-ui.mjs`
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) failures.push(script)
}
if (failures.length) {
  console.error(`UI regressions failed: ${failures.join(', ')}`)
  process.exitCode = 1
}
