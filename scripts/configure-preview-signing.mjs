import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = resolve('.tools')
mkdirSync(directory, { recursive: true })
const store = resolve(directory, 'hds-preview.keystore')
const state = resolve(directory, 'hds-preview-signing.json')
const run = (command, args, input) => {
  const result = spawnSync(command, args, { input, encoding: 'utf8', timeout: 90000 })
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}); signing secrets were not printed`)
  return result.stdout.trim()
}
let password
if (existsSync(state) && existsSync(store)) password = JSON.parse(readFileSync(state, 'utf8')).password
else {
  if (existsSync(state) || existsSync(store)) throw new Error('Incomplete signing files; preserve and inspect them before retrying')
  password = randomBytes(24).toString('hex')
  const tool = process.env.HDS_KEYTOOL || 'C:/Program Files/Java/jdk-11.0.12/bin/keytool.exe'
  run(tool, ['-genkeypair', '-keystore', store, '-storetype', 'PKCS12', '-alias', 'hds-preview', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-storepass', password, '-keypass', password, '-dname', 'CN=HDS Android Preview, OU=Development, O=sl251'])
  writeFileSync(state, JSON.stringify({ purpose: 'Stable private APK preview signing key; back up both ignored files', password }, null, 2))
}
if (run('gh', ['api', 'user', '--jq', '.login']) !== 'sl251') throw new Error('Refusing to configure another account')
run('gh', ['secret', 'set', 'HDS_SIGNING_STORE_B64', '--repo', 'sl251/HDS-Android'], readFileSync(store).toString('base64'))
run('gh', ['secret', 'set', 'HDS_SIGNING_PASSWORD', '--repo', 'sl251/HDS-Android'], password)
console.log('Stable preview key saved locally and configured as private repository Actions secrets')
