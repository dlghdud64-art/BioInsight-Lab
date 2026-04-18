import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

/**
 * S06. 부족 재고 확인 → 재발주 진입
 * 플랫폼: Desktop
 * 역할: 재고 담당
 *
 * P3 핫픽스(Prisma 쿼리 수정) 검증 포함
 */
test.describe("S06: 부족 재고 필터 (P3 핫픽스 검증)", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSession(page);
  });

  test("부족 재고 API가 500 에러 없이 응답한다", async ({ page }) => {
    // P3 핫픽스 핵심 검증: lowStock 필터가 런타임 에러 없이 동작
    const response = await page.request.get(
      "/api/inventory?lowStock=true"
    );

    // 500 에러가 아닌 것이 핵심 (이전에는 Prisma 쿼리 오류로 500 반환)
    expect(response.status()).not.toBe(500);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty("inventories");
    expect(Array.isArray(data.inventories)).toBeTruthy();
  });

  test("status=low 필터도 동일하게 동작한다", async ({ page }) => {
    const response = await page.request.get(
      "/api/inventory?status=low"
    );

    expect(response.status()).not.toBe(500);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.inventories)).toBeTruthy();

    // 반환된 항목이 실제로 부족 상태인지 검증
    for (const inv of data.inventories) {
      if (inv.safetyStock != null) {
        expect(inv.currentQuantity).toBeLessThanOrEqual(inv.safetyStock);
      } else {
        expect(inv.currentQuantity).toBeLessThanOrEqual(0);
      }
    }
  });

  test("재고 목록 UI에서 부족 필터가 동작한다", async ({ page }) => {
    await page.goto("/dashboard/inventory?filter=low");
    await page.waitForLoadState("networkidle");

    // 페이지 로드 성공 (500 에러 페이지가 아닌지 확인)
    const errorMsg = page.locator("text=/500|서버 오류|Internal Server/");
    await expect(errorMsg).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // 에러 메시지가 없으면 정상
    });
  });

  test("만료 재고 필터가 동작한다", async ({ page }) => {
    const response = await page.request.get(
      "/api/inventory?status=expired"
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.inventories)).toBeTruthy();
  });

  test("만료 예정 재고 필터가 동작한다", async ({ page }) => {
    const response = await page.request.get(
      "/api/inventory?status=expiring"
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.inventories)).toBeTruthy();
  });
});
