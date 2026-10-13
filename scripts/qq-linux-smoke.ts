// CI only: checks the actual ARM64 guest/QQ wrapper up to an unscanned QR.
// Does not log in, expose the QR/token, or send messages.
import { Context } from 'koishi'
import { HTTP } from '@cordisjs/plugin-http'
import { QQRuntime } from '../runtime/qq'
import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { componentsPath } from '../runtime/qq-components'

async function main() {
  if (process.arch !== 'arm64' || process.platform !== 'linux') throw new Error('ARM64 Linux required')
  const app = new Context()
  app.plugin(HTTP)
  await app.start()
  const directory = '/qq-data', profile = '/qq-data/smoke-profile'
  mkdirSync(profile, { recursive: true })
  const qq = new QQRuntime(app, directory, profile, { onebot: {} })
  try {
    await qq.dispatch('qq.install', {})
    let limit = Date.now() + 12 * 60 * 1000
    while (qq.status().phase === 'installing' && Date.now() < limit) await new Promise(resolve => setTimeout(resolve, 1000))
    if (!qq.status().installed) throw new Error(`Component install: ${qq.status().error}`)
    // A phone can reject native execution. That must leave stop/retry usable.
    const binary = join(componentsPath(directory), 'opt/QQ/qq')
    chmodSync(binary, 0o600)
    try {
      await qq.start()
      limit = Date.now() + 10000
      while (qq.status().phase !== 'failed' && Date.now() < limit) await new Promise(resolve => setTimeout(resolve, 100))
      if (qq.status().phase !== 'failed' || qq.status().running) throw new Error('Rejected QQ execution was not cleaned up')
      await Promise.race([qq.stop(), new Promise((_, reject) => setTimeout(() => reject(new Error('Stop hung after rejected QQ execution')), 5000))])
      console.log('PASS: rejected QQ execution can be stopped and retried.')
    } finally { chmodSync(binary, 0o755) }
    await qq.start()
    limit = Date.now() + 130000
    while (Date.now() < limit) {
      const status = qq.status()
      if (status.qr.startsWith('data:image/png;base64,')) { console.log('PASS: ARM64 guest loaded pinned NapCat and Linux QQ; authenticated API returned an unscanned QR. Android PRoot and actual account login remain unverified.'); return }
      if (status.phase === 'failed') throw new Error(status.error + '\n' + status.logs.join('\n'))
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('QR timeout: ' + qq.status().logs.join('\n'))
  } finally { await qq.close(); await app.stop() }
}
main().then(() => process.exit(0), error => { console.error(error.message); process.exit(1) })
