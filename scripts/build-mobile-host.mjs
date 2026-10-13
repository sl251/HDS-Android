import { build } from 'esbuild'
await build({ entryPoints: ['runtime/host.ts'], outfile: 'runtime/generated/host.cjs', platform: 'node', format: 'cjs', target: 'node24', bundle: true, packages: 'external', tsconfig: 'upstream/hds-interlude/tsconfig.json' })
console.log('Compiled actual HDS rc51 and mobile host from sources')
