import { defineConfig, devices } from '@playwright/test';

/**
 * 스모크 테스트 설정.
 * - 로컬: 이미 떠 있는 dev 서버(3005)를 재사용한다(Electron이 같은 포트를 점유 중일 수 있음).
 * - CI: 서버가 없으므로 `npm run dev`로 직접 띄운다.
 * 무거운 E2E가 아니라, 핵심 화면이 깨지지 않는지 빠르게 확인하는 용도다.
 */
const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
