import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto('/#map');
  await page.locator('.globe-svg .map-land').first().waitFor();
});
const rotation = page => page.locator('.globe-svg').getAttribute('data-rotation');
const zoom = async page => Number(await page.locator('.globe-svg').getAttribute('data-zoom'));

test('globe hides the back hemisphere, focuses destinations, and remembers the flat alternative', async ({ page }) => {
  await expect(page.locator('[data-action="world-view"][data-value="globe"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.globe-marker[data-globe-trip="taiwan"]')).toBeVisible();
  await expect(page.locator('.globe-marker[data-globe-trip="yosemite"]')).toHaveCount(0);
  await page.getByRole('button', { name: '转向美国', exact: true }).click();
  await expect(page.locator('.globe-marker[data-globe-trip="yosemite"]')).toBeVisible();
  await expect(page.locator('.globe-marker[data-globe-trip="taiwan"]')).toHaveCount(0);
  await page.locator('[data-action="zoom-in"]').click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(1);
  await page.locator('[data-action="zoom-reset"]').click();
  await expect.poll(() => zoom(page)).toBe(1);
  await expect(page.locator('.globe-marker[data-globe-trip="taiwan"]')).toBeVisible();
  await page.locator('[data-action="world-view"][data-value="flat"]').click();
  await expect(page.locator('.globe-svg')).toHaveCount(0);
  await expect(page.locator('#travel-map .map-dot')).toHaveCount(5);
  await page.reload();
  await expect(page.locator('[data-action="world-view"][data-value="flat"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="world-view"][data-value="globe"]').click();
  await expect(page.locator('.globe-svg')).toBeVisible();
});

test('dragging rotates without opening a trip, while a deliberate tap opens the destination', async ({ page }, info) => {
  await page.locator('.globe-svg').scrollIntoViewIfNeeded();
  const globe = page.locator('.globe-svg');
  const original = await rotation(page), box = await globe.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 20, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => rotation(page)).not.toBe(original);
  await expect(page).toHaveURL(/#map$/);
  await page.getByRole('button', { name: '转向中国台湾', exact: true }).click();
  const dot = page.locator('.globe-marker[data-globe-trip="taiwan"] .map-dot');
  await dot.scrollIntoViewIfNeeded();
  const marker = await dot.boundingBox();
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker.x + marker.width / 2 + 70, marker.y + marker.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/#map$/);
  await page.getByRole('button', { name: '转向中国台湾', exact: true }).click();
  await dot.scrollIntoViewIfNeeded();
  if (info.project.use.hasTouch) {
    const target = await dot.boundingBox();
    await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
  } else await dot.click();
  await expect(page).toHaveURL(/#trip\/taiwan$/);
  await expect(page.locator('.detail-hero h1')).toHaveText('台北与九份');
});

test('pinch, cancellation, keyboard and device zoom controls remain usable after resizing', async ({ page }, info) => {
  const globe = page.locator('.globe-svg');
  await globe.scrollIntoViewIfNeeded();
  await expect(globe).toHaveCSS('touch-action', 'none');
  await page.evaluate(() => {
    const node = document.querySelector('.globe-svg'), r = node.getBoundingClientRect();
    const send = (type, id, x, y) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: r.x + x, clientY: r.y + y }));
    send('pointerdown', 21, r.width / 2 - 25, r.height / 2);
    send('pointerdown', 22, r.width / 2 + 25, r.height / 2);
    send('pointermove', 21, r.width / 2 - 80, r.height / 2);
    send('pointermove', 22, r.width / 2 + 80, r.height / 2);
    send('pointerup', 21, r.width / 2 - 80, r.height / 2);
    send('pointercancel', 22, r.width / 2 + 80, r.height / 2);
  });
  await expect.poll(() => zoom(page)).toBeGreaterThan(2);
  await expect(globe).not.toHaveClass(/is-dragging/);
  await globe.focus();
  const before = await rotation(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => rotation(page)).not.toBe(before);
  await page.keyboard.press('Home');
  await expect.poll(() => zoom(page)).toBe(1);
  if (info.project.use.isMobile) await page.locator('[data-action="zoom-in"]').click();
  else {
    await page.mouse.move((await globe.boundingBox()).x + 50, (await globe.boundingBox()).y + 80);
    await page.mouse.wheel(0, -180);
  }
  await expect.poll(() => zoom(page)).toBeGreaterThan(1);
  const preserved = await rotation(page), scale = await zoom(page), viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width + 20, height: viewport.height + 10 });
  await expect.poll(() => rotation(page)).toBe(preserved);
  await expect.poll(() => zoom(page)).toBe(scale);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width + 20);
});

test('Chinese place names and Taiwan itinerary work in the list, photos, expenses and memories', async ({ page }) => {
  await expect(page.getByRole('button', { name: '中国大陆', exact: true })).toBeVisible();
  await expect(page.locator('.globe-destinations')).toContainText('中国大陆');
  await expect(page.locator('.globe-destinations')).toContainText('中国台湾');
  await page.goto('/#trips');
  const trip = page.locator('.trip-card[href="#trip/taiwan"]');
  await expect(trip.locator('.region-chip')).toHaveText('中国台湾');
  await trip.click();
  await expect(page.locator('.detail-hero h1')).toHaveText('台北与九份');
  await page.getByRole('link', { name: '照片', exact: true }).click();
  await expect(page.locator('.photo-item')).toHaveCount(2);
  for (const photo of await page.locator('.photo-item > img').all()) {
    await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('link', { name: '花费', exact: true }).click();
  await expect(page.locator('.expense-totals')).toContainText('480');
  await page.getByRole('link', { name: '回忆选片', exact: true }).click();
  await expect(page.locator('.memory-banner')).toContainText('2 张精选');
  await page.locator('.memory-banner [data-action="play"]').click();
  await expect(page.locator('#player-count')).toHaveText('1 / 2');
  await page.getByRole('button', { name: '下一张', exact: true }).click();
  await expect(page.locator('#player-count')).toHaveText('2 / 2');
});

test('an empty local archive still offers a working globe without adding demo records', async ({ page }) => {
  await page.locator('#archive-mode').selectOption('mine');
  await expect(page.locator('.globe-svg')).toBeVisible();
  await expect(page.locator('.globe-marker')).toHaveCount(0);
  await expect(page.locator('.map-heading p')).toContainText('0 次旅行');
  await page.locator('[data-action="zoom-in"]').click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(1);
  await page.goto('/#trips');
  await expect(page.locator('.trip-card')).toHaveCount(0);
});
