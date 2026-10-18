import assert from 'node:assert/strict'
import { parse } from 'yaml'
import { characterFixture } from './character-io-fixture.mjs'
const f = await characterFixture(), { page } = f
try {
  await f.load()
  await page.getByRole('button', { name: '导出角色卡', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '导出角色', exact: true })
  const content = dialog.getByLabel('导出内容', { exact: true })
  const save = () => dialog.getByRole('button', { name: '导出', exact: true }).click()
  assert.equal(await dialog.getByRole('radio', { name: /原格式/ }).isChecked(), true)
  await page.evaluate(() => { fixture.hold = true }); await save()
  await page.waitForFunction(() => fixture.release !== null)
  assert.equal(await dialog.getByRole('button', { name: '正在导出…' }).isDisabled(), true)
  assert.equal(await page.evaluate(() => window.hdsHandleBack()), true)
  await page.evaluate(() => { fixture.hold = false; fixture.release() })
  await dialog.getByRole('status').filter({ hasText: '已保存：已有角色-v2.json' }).waitFor()
  const card = JSON.parse(await content.inputValue())
  assert.equal(card.data.name, '已有角色'); assert.equal(card.data.description, '已编辑的人设')
  assert.deepEqual(card.data.alternate_greetings, ['晚安']); assert.deepEqual(card.data.extensions, { safe: true })
  assert.equal(await page.evaluate(() => fixture.exported[0].content), await content.inputValue())
  assert.equal(await page.evaluate(() => fixture.calls.some(c => c.options?.method === 'story.snapshot' || c.method === 'selectCard')), false)
  for (const label of [/SillyTavern/, /HDSI 预设 JSON/, /YAML 视图/]) {
    await dialog.getByRole('radio', { name: label }).check(); await save(); await dialog.getByRole('status').filter({ hasText: '已保存：' }).waitFor()
    const data = parse(await content.inputValue())
    if (data.storyDefaults) { assert.equal(data.storyDefaults.characterProfile, '已编辑的人设'); assert.equal(data.agency.enabled, true) }
    else assert.deepEqual(data.data.alternate_greetings, ['晚安'])
  }
  await page.evaluate(() => { fixture.exportMode = 'cancel' }); await save()
  await dialog.getByRole('status').filter({ hasText: '已取消保存' }).waitFor()
  await page.evaluate(() => { fixture.exportMode = 'error' }); await save()
  await dialog.getByRole('alert').getByText('测试：写入失败').waitFor()
  assert.equal(parse(await content.inputValue()).storyDefaults.characterName, '已有角色')
  await page.evaluate(() => { fixture.exportMode = ''; fixture.cards[0].card.description = '导出前的新编辑' }); await save()
  await dialog.getByRole('status').filter({ hasText: '已保存：' }).waitFor()
  assert.equal(parse(await content.inputValue()).storyDefaults.characterProfile, '导出前的新编辑')
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
  assert.deepEqual(f.errors, [])
  console.log('PASS character exports: saved edits, stopped host, original metadata, four formats, native picker, busy/back guard, cancellation and write failure/retry.')
} finally { await f.close() }
