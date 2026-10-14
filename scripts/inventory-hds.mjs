import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'tools/hds-baseline/package.json'))
const ts = require('typescript')
const source = ts.createSourceFile('index.ts', readFileSync(join(root, '.references/HDS-Interlude/src/index.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
const rows = []
const at = node => `src/index.ts:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`
const description = expression => {
  let node = expression
  while (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'description' && ts.isStringLiteral(node.arguments[0])) return node.arguments[0].text
    node = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : node.expression
  }
  return ''
}
function walk(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'Config' && node.initializer && ts.isCallExpression(node.initializer)) {
    const object = node.initializer.arguments[0]
    if (object && ts.isObjectLiteralExpression(object)) for (const property of object.properties) {
      if (ts.isPropertyAssignment(property)) rows.push(['config', property.name.getText(source), description(property.initializer), at(property), 'NOT_IMPLEMENTED', ''])
    }
  }
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'ctx.command' && ts.isStringLiteral(node.arguments[0])) {
    rows.push(['command', node.arguments[0].text, ts.isStringLiteral(node.arguments[1]) ? node.arguments[1].text : '', at(node), 'NOT_IMPLEMENTED', ''])
  }
  ts.forEachChild(node, walk)
}
walk(source)
if (!rows.some(row => row[0] === 'config') || !rows.some(row => row[0] === 'command')) throw new Error('No HDS inventory extracted; upstream structure may have changed')
const escape = value => `"${String(value).replaceAll('"', '""')}"`
mkdirSync(join(root, 'docs'), { recursive: true })
// mobile_status 的默认值是盘点基线：脚本只机械提取上游配置分区与命令，不判断移动端实现状态。
// 人工确认后改写该列；口径说明见 docs/feature-parity.md，不要把默认值当作"未实现"的结论。
writeFileSync(join(root, 'docs/feature-parity.csv'), [['kind', 'feature', 'description', 'upstream_location', 'mobile_status', 'evidence'], ...rows].map(row => row.map(escape).join(',')).join('\n') + '\n')
console.log(`Inventoried ${rows.filter(row => row[0] === 'config').length} config sections and ${rows.filter(row => row[0] === 'command').length} commands`)
