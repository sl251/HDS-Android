// CI only: checks the actual ARM64 guest/QQ wrapper up to an unscanned QR.
// Does not log in, expose the QR/token, or send messages.
import { Context } from 'koishi'
import { HTTP } from '@cordisjs/plugin-http'
import { QQRuntime } from '../runtime/qq'
import { mkdirSync } from 'node:fs'

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
