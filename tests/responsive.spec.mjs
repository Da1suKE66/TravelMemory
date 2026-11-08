import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep layout checks reproducible without depending on an external font server.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/');
  await page.locator('#travel-map svg').waitFor();
});

async function noPageOverflow(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(sizes.document, 'document must fit the viewport').toBeLessThanOrEqual(sizes.width + 1);
  expect(sizes.body, 'body must fit the viewport').toBeLessThanOrEqual(sizes.width + 1);
}

async function insideVisibleArea(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

test('all main pages and trip tabs fit without page-level horizontal scrolling', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of ['map', 'trips', 'memories', 'import', 'settings', 'trip/japan/timeline', 'trip/japan/photos', 'trip/japan/expenses', 'trip/japan/selection']) {
    await page.goto(`/#${route}`);
    await expect(page.locator('main')).not.toBeEmpty();
    await noPageOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('navigation stays reachable and adapts to screen shape', async ({ page }, info) => {
  if (info.project.metadata.phoneNav) {
    const links = page.locator('.sidebar > .nav .nav-link');
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      await insideVisibleArea(page, link);
      await expect(link.locator('.nav-text')).toBeVisible();
      const box = await link.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('link', { name: '本地保存', exact: true }).click();
    await expect(page).toHaveURL(/#settings$/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await insideVisibleArea(page, page.getByRole('link', { name: '足迹地图', exact: true }));
    await page.getByRole('link', { name: '足迹地图', exact: true }).click();
    await expect(page.locator('#travel-map svg')).toBeVisible();
    await expect(page.locator('.mobile-brand')).toBeVisible();
    for (const control of [page.locator('#archive-mode'), page.locator('.top-actions .btn')]) {
      await insideVisibleArea(page, control);
      expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  } else {
    await expect(page.locator('.mobile-brand')).toBeHidden();
    await expect(page.locator('.sidebar-bottom a')).toBeVisible();
    const sidebar = await page.locator('.sidebar').boundingBox();
    expect(sidebar.x).toBe(0);
    expect(sidebar.height).toBeGreaterThan(500);
  }
});

test('five maps and their controls work at every size', async ({ page }, info) => {
  for (const mode of ['world', 'mainland', 'japan', 'usa', 'other']) {
    const button = page.locator(`[data-action="region"][data-value="${mode}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#travel-map svg')).toBeVisible();
    await noPageOverflow(page);
    if (info.project.use.hasTouch) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('[data-action="zoom-in"]').click();
  await expect.poll(() => page.locator('#travel-map svg > g').getAttribute('transform')).not.toBe('translate(0,0) scale(1)');
  await page.locator('[data-action="zoom-reset"]').click();
  await expect.poll(() => page.locator('#travel-map svg > g').getAttribute('transform')).toBe('translate(0,0) scale(1)');
  if (info.project.use.hasTouch) {
    await expect(page.locator('#travel-map svg')).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  }
  // Dense world-map markers must select the point that was actually tapped.
  await page.locator('[data-action="region"][data-value="world"]').click();
  await page.locator('[data-action="world-view"][data-value="flat"]').click();
  await page.locator('#travel-map a[href="#trip/japan"] .map-dot').click();
  await expect(page).toHaveURL(/#trip\/japan$/);
});

test('import preview can be reviewed and archived on the device', async ({ page }, info) => {
  await page.goto('/#import');
  const sources = page.locator('.source-btn');
  await expect(sources).toHaveCount(6);
  for (const source of await sources.all()) {
    if (info.project.use.hasTouch) expect((await source.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('[data-action="source"][data-value="ledger"]').click();
  await page.locator('#file-input').setInputFiles({
    name: 'fictional-layout-check.csv', mimeType: 'text/csv',
    buffer: Buffer.from('日期,商家,金额,币种,地点\n2026-05-01,用于屏幕测试的虚构商家名称,123.45,CNY,测试地点\n'),
  });
  await expect(page.locator('.preview-table tbody tr')).toHaveCount(1);
  await noPageOverflow(page);
  const review = page.locator('.row-checkbox');
  expect((await review.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await review.click();
  await expect(review.locator('input')).not.toBeChecked();
  await review.click();
  await page.locator('#archive-form [name="title"]').fill('屏幕适配测试旅行');
  await page.locator('#archive-form [name="country"]').selectOption('CHN');
  await page.locator('#archive-form [name="confirmed"]').check();
  await page.getByRole('button', { name: '确认加入我的档案' }).click();
  await expect(page.locator('.detail-hero h1')).toHaveText('屏幕适配测试旅行');
  await noPageOverflow(page);
});

test('editing and memory playback remain usable in a short viewport', async ({ page }, info) => {
  await page.goto('/#trip/japan/selection');
  await page.locator('[data-action="edit-trip"]').click();
  await insideVisibleArea(page, page.getByRole('button', { name: '关闭', exact: true }));
  const title = page.locator('#edit-trip-form [name="title"]');
  await title.fill('测试很长的旅行标题以及完整显示的旅行文字 · 京都与大阪');
  if (info.project.use.hasTouch) {
    expect(await title.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await page.getByRole('button', { name: '保存旅行', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.memory-banner [data-action="play"]').click();
  for (const label of ['关闭回忆', '上一张', '自动播放', '下一张']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await insideVisibleArea(page, button);
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  const first = await page.locator('#player-count').textContent();
  await page.getByRole('button', { name: '下一张', exact: true }).click();
  await expect(page.locator('#player-count')).not.toHaveText(first);
  await page.getByRole('button', { name: '关闭回忆', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('phone safe areas leave navigation and the final content reachable', async ({ page }, info) => {
  test.skip(!info.project.metadata.phoneNav, 'Only the phone layout has a fixed bottom navigation.');
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--safe-top', '24px');
    root.style.setProperty('--safe-bottom', '34px');
    root.style.setProperty('--safe-left', innerWidth > innerHeight ? '59px' : '0px');
    root.style.setProperty('--safe-right', innerWidth > innerHeight ? '59px' : '0px');
  });
  await page.getByRole('link', { name: '本地保存', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = await page.locator('main > .page-note').last().boundingBox();
  const nav = await page.locator('.sidebar').boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(nav.y);
  for (const link of await page.locator('.sidebar > .nav .nav-link').all()) await insideVisibleArea(page, link);
  await noPageOverflow(page);
});
