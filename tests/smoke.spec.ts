import { test, expect, Page } from '@playwright/test';

/**
 * 스모크 테스트 — 핵심 기능이 "최소한 동작하는지" 빠르게 검증한다.
 * 데이터에 의존하지 않도록 셀렉터·문구 기준으로만 확인한다.
 */

async function gotoApp(page: Page) {
  await page.goto('/');
  // 하이드레이션 이후 셸이 보일 때까지
  await expect(page.getByText('Zero-Friction').first()).toBeVisible();
}

test('앱 셸과 네비게이션 탭이 렌더된다', async ({ page }) => {
  await gotoApp(page);
  for (const label of ['전체', '일정', '재고', '메모']) {
    await expect(page.locator('.nav-link', { hasText: label })).toBeVisible();
  }
});

test('검색: 헤더 버튼 → 검색창·타입탭 노출, 닫기 동작', async ({ page }) => {
  await gotoApp(page);
  await page.locator('button[title^="검색"]').click();

  const searchInput = page.getByPlaceholder(/일정.재고.메모 검색/);
  await expect(searchInput).toBeVisible();

  // 타입 필터 탭 4종
  for (const t of ['전체', '일정', '재고', '메모']) {
    await expect(page.locator('button', { hasText: new RegExp(`^${t}\\s*\\d`) }).first()).toBeVisible();
  }

  // 키워드 입력해도 깨지지 않는다(결과 0건이어도 통과)
  await searchInput.fill('테스트검색어zzz');
  await expect(page.getByText(/검색 결과|건/).first()).toBeVisible();

  // ESC로 닫기 → 검색창 사라짐
  await page.keyboard.press('Escape');
  await expect(searchInput).toBeHidden();
});

test('다크모드 토글이 data-theme를 전환한다', async ({ page }) => {
  await gotoApp(page);
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.locator('.theme-floating-btn').click();
  await expect(html).not.toHaveAttribute('data-theme', before || '');
});
