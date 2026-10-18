import assert from 'node:assert/strict'
import { characterFixture } from './character-io-fixture.mjs'
const f = await characterFixture(), { page } = f
try {
  const dialog = page.getByRole('dialog', { name: '用分享码导入角色' })
  const open = async () => { await page.getByRole('button', { name: '用导入码导入', exact: true }).click(); await page.getByLabel('typ0.space 导入码').fill('ABCDEFGH') }
  const check = async () => { await dialog.getByRole('button', { name: '检查', exact: true }).click(); await dialog.getByText('分享的角色 · 修订 1').waitFor() }
  const save = () => dialog.getByRole('button', { name: '导入角色卡', exact: true }).click()
  await f.load(true); await open(); await check(); await save(); await dialog.waitFor({ state: 'detached' })
  await page.locator('.card-list h2').getByText('星禾', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => fixture.selected), 'imported-0')
  await f.load(); await open(); await check(); await save(); await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => fixture.selected), 'first')
  assert.equal(await page.locator('.card-list article').count(), 2)
  await open(); await check(); await save(); await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.card-list article').count(), 2)
  assert.equal(await page.evaluate(() => fixture.calls.some(c => c.options?.method === 'preset.sync' || c.options?.method === 'story.applySetting')), false)
  await open(); await check(); await page.evaluate(() => { fixture.share.revision = 2 }); await save()
  await dialog.getByRole('alert').getByText('分享内容已变化，请重新检查后导入。').waitFor()
  await page.evaluate(() => { fixture.share.revision = 1; fixture.failSave = true }); await check(); await save()
  await dialog.getByRole('alert').getByText('测试：保存失败').waitFor()
  await page.evaluate(() => { fixture.failSave = false; fixture.httpError = '测试：网络失败' })
  await dialog.getByRole('button', { name: '检查', exact: true }).click(); await dialog.getByRole('alert').waitFor()
  await page.evaluate(() => { delete fixture.httpError }); await check()
  await page.getByLabel('typ0.space 导入码').fill('HGFEDCBA'); assert.equal(await dialog.getByRole('button', { name: '导入角色卡', exact: true }).count(), 0)
  await page.getByLabel('typ0.space 导入码').fill('ABCDEFGH'); await check(); await save(); await dialog.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '导入角色卡', exact: true }).click()
  const preview = page.getByRole('dialog', { name: '角色卡预览' }); await preview.waitFor()
  await page.evaluate(() => { fixture.failSelect = true }); await preview.getByRole('button', { name: '保存并使用这个角色' }).click()
  await page.getByText(/已保存到角色库，切换未完成/).waitFor()
  assert.equal(await page.locator('.card-list h2').getByText('文件角色', { exact: true }).count(), 1)
  await preview.getByRole('button', { name: '只保存到角色库' }).click(); await preview.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.card-list article').count(), 3)
  assert.deepEqual(f.errors, [])
  console.log('PASS character imports: empty/stopped library, visible cards, active story preservation, duplicates, stale share, failed save/retry, file save/selection failure.')
} finally { await f.close() }
