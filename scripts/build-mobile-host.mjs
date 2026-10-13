import { build } from 'esbuild'
await build({ entryPoints: ['runtime/host.ts'], outfile: 'runtime/generated/host.cjs', platform: 'node', format: 'cjs', target: 'node24', bundle: true, packages: 'external', tsconfig: 'upstream/hds-interlude/tsconfig.json' })
await build({ entryPoints: ['runtime/qq.ts'], outfile: 'runtime/generated/qq.cjs', platform: 'node', format: 'cjs', target: 'node24', bundle: true, packages: 'external' })
console.log('Compiled actual HDS rc51 and mobile host from sources')
