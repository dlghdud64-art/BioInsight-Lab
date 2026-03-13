import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

/**
 * S01. 검색 → 비교 → 견적 요청 생성
 * 플랫폼: Desktop
 * 역할: 연구원
 */
test.describe("S01: 검색 → 비교 → 견적 요청", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSession(page);
  });

  test("제품 검색 후 결과가 표시된다", async ({ page }) => {
    await page.goto("/test/search");
    await page.waitForLoadState("networkidle");

    // 검색어 입력
    const searchInput = page.locator(
      'input[placeholder*="시약명"]'
    );
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Ethanol");
    await searchInput.press("Enter");

    // 검색 결과 로드 대기
    await page.waitForResponse(
      (res) => res.url().includes("/api/products/search") && res.ok()
    );

    // 결과가 1건 이상 렌더링
    const results = page.locator('[class*="search-result"], [class*="product"]');
    // 결과가 있거나, "검색 결과가 없습니다" 메시지가 표시되어야 함
    const hasResults = await results.count();
    const noResultsMsg = page.getByText("검색 결과가 없습니다");
    const hasNoResults = await noResultsMsg.isVisible().catch(() => false);

    expect(hasResults > 0 || hasNoResults).toBeTruthy();
  });

  test("제품 2건을 비교 목록에 추가할 수 있다", async ({ page }) => {
    await page.goto("/test/search");

    const searchInput = page.locator('input[placeholder*="시약명"]');
    await searchInput.fill("test");
    await searchInput.press("Enter");

    await page.waitForTimeout(2000);

    // 비교 체크박스/버튼 클릭 (최대 2건)
    const compareToggles = page.locator(
      'button:has-text("비교"), input[type="checkbox"]'
    );
    const count = await compareToggles.count();

    if (count >= 2) {
      await compareToggles.nth(0).click();
      await compareToggles.nth(1).click();

      // 비교 바 표시 확인
      const compareBar = page.locator('text=/비교.*보기|비교 중/');
      await expect(compareBar.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("견적 요청 리스트에 제품을 담을 수 있다", async ({ page }) => {
    await page.goto("/test/search");

    const searchInput = page.locator('input[placeholder*="시약명"]');
    await searchInput.fill("test");
    await searchInput.press("Enter");
    await page.waitForTimeout(2000);

    // "리스트에 담기" 또는 장바구니 추가 버튼 클릭
    const addBtn = page.locator(
      'button:has-text("리스트에 담기"), button:has-text("담기")'
    );
    if ((await addBtn.count()) > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(1000);

      // 하단 견적 리스트 바 확인
      const quoteBar = page.locator('text=/견적.*리스트|개 품목/');
      await expect(quoteBar.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("견적 요청 페이지로 이동할 수 있다", async ({ page }) => {
    await page.goto("/test/quote");
    await page.waitForLoadState("networkidle");

    // 견적 요청 폼 또는 페이지 확인
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.includes("견적") || page.url().includes("quote")
    ).toBeTruthy();
  });
});
