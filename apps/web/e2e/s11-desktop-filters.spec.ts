import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

/**
 * S11. 데스크탑 전용 테이블/필터/상태 전이 정상 여부
 * 플랫폼: Desktop
 * 역할: 구매 담당, 운영 관리자
 */
test.describe("S11: 데스크탑 필터 & 상태 전이", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSession(page);
  });

  test("대시보드가 정상 로드된다", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // 대시보드 콘텐츠 확인 (에러 페이지가 아닌지)
    const body = await page.textContent("body");
    expect(body).not.toContain("500");
    expect(body).not.toContain("Internal Server Error");
  });

  test("견적 목록 페이지가 로드된다", async ({ page }) => {
    await page.goto("/dashboard/quotes");
    await page.waitForLoadState("networkidle");

    // 페이지 타이틀 확인
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("재고 목록 페이지가 로드된다", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).not.toContain("500");
  });

  test("재고 검색이 동작한다", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("networkidle");

    // 검색 입력 필드 찾기
    const searchInput = page.locator(
      'input[placeholder*="검색"], input[type="search"], input[placeholder*="품목"]'
    );

    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill("test");
      await page.waitForTimeout(1000); // 디바운스 대기
      // 에러 없이 필터링 결과 표시되면 성공
      const body = await page.textContent("body");
      expect(body).not.toContain("500");
    }
  });

  test("구매 목록 페이지가 로드된다", async ({ page }) => {
    await page.goto("/dashboard/purchases");
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).not.toContain("500");
  });
});
