const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const M = require('../../src/model');
async function measure(page, key, value) {
  await page.locator('#input-' + key).fill(value);
  await page.locator('#input-' + key).press('Tab');
}
async function importPlan(page, data) {
  await page.locator('#importFile').setInputFiles({
    name: 'plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('first visit renders without errors or third-party requests', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const remote = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173/')) remote.push(r.url());
  });
  await page.reload();
  await expect(page.locator('#plan .furniture')).toHaveCount(7);
  await expect(page.locator('#progressCount')).toHaveText('0 / 2');
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
test('exact rectangle area, unit changes and undo preserve values', async ({ page }) => {
  await measure(page, 'W', '500');
  await measure(page, 'H', '400');
  await expect(page.locator('#areaValue')).toHaveText('20.00');
  await page.locator('#units').selectOption('m');
  await expect(page.locator('#input-W')).toHaveValue('5');
  await page.locator('#units').selectOption('ft');
  await expect(page.locator('#areaValue')).toHaveText('215.28');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#units')).toHaveValue('m');
  await expect(page.locator('#areaValue')).toHaveText('20.00');
  await page.reload();
  await expect(page.locator('#units')).toHaveValue('m');
});
test('L-shaped constraints derive missing spans and flag conflicts', async ({ page }) => {
  await page.locator('#roomShape').selectOption('l');
  await measure(page, 'W', '600');
  await measure(page, 'H', '400');
  await measure(page, 'NW', '180');
  await measure(page, 'ND', '150');
  await expect(page.locator('#input-NT')).toHaveValue('250');
  await expect(page.locator('#row-NT .row-status')).toHaveText('CALCULATED');
  await expect(page.locator('#areaValue')).toHaveText('21.30');
  await measure(page, 'NT', '200');
  await expect(page.locator('#warnings')).toContainText('conflict');
});
test('furniture measurements, rotation, position and lock survive reload', async ({ page }) => {
  await page.getByRole('tab', { name: 'Furniture', exact: true }).click();
  await page.locator('[data-item="bed"]').click();
  for (const [prop, value] of [
    ['w', '150'],
    ['d', '200'],
    ['x', '25'],
    ['y', '30'],
  ]) {
    const el = page.locator(`[data-prop="${prop}"]`);
    await el.fill(value);
    await el.press('Tab');
  }
  await page.locator('#rotateItemRight').click();
  await expect(page.locator('#objectAngle')).toHaveText('90°');
  await page.locator('#lockItem').click();
  await expect(page.locator('#rotateItemRight')).toBeDisabled();
  await page.reload();
  await page.getByRole('tab', { name: 'Furniture', exact: true }).click();
  await page.locator('[data-item="bed"]').click();
  await expect(page.locator('[data-prop="w"]')).toHaveValue('150');
  await expect(page.locator('[data-prop="x"]')).toHaveValue('25');
  await expect(page.locator('#objectAngle')).toHaveText('90°');
});
test('keyboard nudge and pointer drag move a piece', async ({ page }) => {
  const bed = page.locator('#plan [data-piece="bed"]');
  await bed.focus();
  await bed.press('ArrowRight');
  const before = await page.locator('[data-prop="x"]').inputValue();
  await bed.press('Shift+ArrowRight');
  expect(Number(await page.locator('[data-prop="x"]').inputValue()) - Number(before)).toBeCloseTo(
    10,
  );
  const box = await bed.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.locator('[data-prop="x"]').inputValue())).toBeGreaterThan(
    Number(before) + 10,
  );
});
test('optional bathroom and sink can be enabled and disabled', async ({ page }) => {
  await page.getByRole('tab', { name: 'Features', exact: true }).click();
  await page.getByLabel('Include bathroom').check();
  await expect(page.locator('#plan [data-piece="bathroom"]')).toHaveCount(1);
  await page.getByLabel('Include window').check();
  await page.getByLabel('Include window').uncheck();
  await page.getByLabel('Include bathroom').uncheck();
  await expect(page.locator('#plan [data-piece="bathroom"]')).toHaveCount(0);
});
test('save, change and restore backs up the unsaved draft', async ({ page }) => {
  await measure(page, 'W', '500');
  await page.locator('#savePlanBtn').click();
  await page.locator('#savePlanName').fill('First room');
  await page.locator('#confirmSavePlan').click();
  await measure(page, 'W', '650');
  await page.locator('#savedPlansBtn').click();
  await page
    .locator('.layout-card')
    .filter({ has: page.getByRole('heading', { name: 'First room', exact: true }) })
    .getByRole('button', { name: 'Open layout' })
    .click();
  await expect(page.locator('#input-W')).toHaveValue('500');
  await page.locator('#savedPlansBtn').click();
  await expect(page.locator('#savedLayoutsList')).toContainText('Before opening First room');
});
test('JSON export reimports exactly and malformed imports do not replace the draft', async ({
  page,
}) => {
  await measure(page, 'W', '525.5');
  await page.locator('#exportBtn').click();
  const promised = page.waitForEvent('download');
  await page.locator('#downloadJson').click();
  const download = await promised;
  const plan = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(plan.known.W).toBe(525.5);
  await page.locator('#exportDialog .close').click();
  await page.locator('#resetBtn').click();
  await importPlan(page, plan);
  await expect(page.locator('#input-W')).toHaveValue('525.5');
  await importPlan(page, { version: 99 });
  await expect(page.locator('#toast')).toContainText('Could not import');
  await expect(page.locator('#input-W')).toHaveValue('525.5');
});
test('SVG export contains the entire plan at any zoom', async ({ page }) => {
  await page.locator('#zoomIn').click();
  await page.locator('#zoomIn').click();
  await page.locator('#exportBtn').click();
  const promised = page.waitForEvent('download');
  await page.locator('#downloadSvg').click();
  const download = await promised;
  const svg = await fs.readFile(await download.path(), 'utf8');
  expect(svg).toContain('viewBox="-85 -65 770');
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).not.toMatch(/NaN|undefined/);
});
test('imports escape user names instead of executing markup', async ({ page }) => {
  const p = M.fresh();
  p.items[0].name = '<img src=x onerror=alert(1)>';
  await importPlan(page, p);
  await page.getByRole('tab', { name: 'Furniture', exact: true }).click();
  await page.locator('[data-item="bed"]').click();
  await expect(page.locator('#selectionPanel img')).toHaveCount(0);
  await expect(page.locator('#selectionPanel')).toContainText('<img src=x');
});
test('legacy room imports preserve the original ten-dimensional outline', async ({ page }) => {
  const p = M.fresh();
  delete p.shape;
  delete p.bathroom;
  delete p.sink;
  p.known = { W: 600, H: 260, L: 140, NW: 90, ND: 72, EW: 80, R: 40, ED: 94 };
  await importPlan(page, p);
  await expect(page.locator('#roomShape')).toHaveValue('study');
  await expect(page.locator('#progressCount')).toHaveText('10 / 10');
  await expect(page.locator('#plan .furniture')).toHaveCount(9);
});
test('storage blocked by browser still allows the planner and export', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('Storage blocked');
      },
    });
  });
  await page.reload();
  await expect(page.locator('#saveState')).toContainText('not stored');
  await measure(page, 'W', '500');
  await expect(page.locator('#input-W')).toHaveValue('500');
  await page.locator('#exportBtn').click();
  await expect(page.locator('#downloadJson')).toBeVisible();
});
test('offline release opens directly from disk and includes help', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
  await expect(page.locator('#plan .furniture')).toHaveCount(7);
  await measure(page, 'W', '500');
  await page.locator('#helpBtn').click();
  await expect(page.locator('#helpDialog')).toBeVisible();
  await expect(page.locator('#helpDialog')).toContainText('使用说明');
});
test('small screens have no page-wide horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#plan')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});
