import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= fileURLToPath(new URL('./.sites/browsers', import.meta.url));
const iphone = devices['iPhone 15 Pro Max'];

export default defineConfig({
  testDir: './tests',
  testMatch: 'responsive.spec.mjs',
  outputDir: '.sites/qa/test-results',
  reporter: [['list'], ['html', { outputFolder: '.sites/qa/report', open: 'never' }]],
  fullyParallel: true,
  workers: 3,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:4178', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop-1440', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
    { name: 'laptop-1366', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1366, height: 768 } } },
    { name: 'desktop-1920', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1920, height: 1080 } } },
    { name: 'iphone-15-pro-max', metadata: { phoneNav: true }, use: { ...iphone, browserName: 'webkit' } },
    { name: 'iphone-landscape', metadata: { phoneNav: true }, use: { ...devices['iPhone 15 Pro Max landscape'], browserName: 'webkit' } },
    { name: 'iphone-fullscreen', metadata: { phoneNav: true }, use: { ...iphone, browserName: 'webkit', viewport: { width: 430, height: 932 } } },
    { name: 'iphone-landscape-fullscreen', metadata: { phoneNav: true }, use: { ...iphone, browserName: 'webkit', viewport: { width: 932, height: 430 } } },
    { name: 'small-phone', metadata: { phoneNav: true }, use: { ...iphone, browserName: 'webkit', viewport: { width: 320, height: 640 } } },
    { name: 'tablet', use: { ...devices['iPad Mini'], browserName: 'webkit' } },
  ],
});
