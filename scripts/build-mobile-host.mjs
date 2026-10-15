import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
await build({ entryPoints: ['runtime/host.ts'], outfile: 'runtime/generated/host.cjs', platform: 'node', format: 'cjs', target: 'node24', bundle: true, packages: 'external', tsconfig: 'upstream/hds-interlude/tsconfig.json' })
await build({ entryPoints: ['runtime/qq.ts'], outfile: 'runtime/generated/qq.cjs', platform: 'node', format: 'cjs', target: 'node24', bundle: true, packages: 'external' })
const { mobileSchema } = createRequire(import.meta.url)('../runtime/generated/host.cjs')
const schema = JSON.stringify(mobileSchema(), null, 2) + '\n'
writeFileSync('packages/contracts/mobile-config.schema.json', schema)
writeFileSync('android/app/src/main/assets/mobile-config.schema.json', schema)
console.log('Compiled actual HDS rc51 and mobile host from sources')
