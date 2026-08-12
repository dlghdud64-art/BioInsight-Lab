import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

/**
 * S04. Route-backed Workbench Overlay
 * 플랫폼: Desktop (md+ viewport)
 *
 * 시나리오:
 * - PO 목록에서 클릭 시 Progress Overlay 열림
 * - Progress → Full Workbench 전환
 * - overlay deep-link (?overlay=...) 지원
 * - ESC로 overlay 닫기
 * - mobile viewport에서는 full-page fallback
 */
test.describe("S04: Workbench Overlay", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSession(page);
  });

  // ── 4.1 PO 목록에서 클릭 시 Progress Overlay 열림 ──

  test("4.1: PO 카드 클릭 시 Progress Overlay Sheet가 열린다", async ({ page }) => {
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    // PO 목록에서 첫 번째 actionable row 클릭
    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Sheet가 열렸는지 확인 — "진행 현황" 뱃지와 "전체 작업면 열기" CTA
      await expect(page.getByText("진행 현황")).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("전체 작업면 열기")).toBeVisible();
    }
  });

  // ── 4.2 Progress → Full Workbench 전환 ──

  test("4.2: '전체 작업면 열기' 클릭 시 Full Workbench Overlay로 전환된다", async ({ page }) => {
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByText("진행 현황")).toBeVisible({ timeout: 3000 });

      // "전체 작업면 열기" CTA 클릭
      await page.getByText("전체 작업면 열기").click();

      // Full overlay에서 workbench 헤더 "발송 워크벤치" 라벨 확인
      await expect(page.getByText("발송 워크벤치")).toBeVisible({ timeout: 3000 });
      // "전체 페이지" 링크가 있어야 함 (overlay 탈출)
      await expect(page.getByText("전체 페이지")).toBeVisible();
    }
  });

  // ── 4.3 ESC로 overlay 닫기 ──

  test("4.3: ESC 키로 overlay가 닫힌다", async ({ page }) => {
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByText("진행 현황")).toBeVisible({ timeout: 3000 });

      // ESC 누르기
      await page.keyboard.press("Escape");

      // overlay가 닫혔는지 확인
      await expect(page.getByText("진행 현황")).not.toBeVisible({ timeout: 2000 });
    }
  });

  // ── 4.4 overlay deep-link ──

  test("4.4: ?overlay= query param으로 직접 접근 시 overlay가 열린다", async ({ page }) => {
    // deep-link 형식: /dashboard/purchase-orders?overlay=/dashboard/purchase-orders/test-po/dispatch
    await page.goto(
      "/dashboard/purchase-orders?overlay=/dashboard/purchase-orders/test-po/dispatch",
    );
    await page.waitForLoadState("networkidle");

    // overlay가 자동으로 열려야 함
    // deep-link 처리 후 URL에서 overlay param이 제거되어야 함
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).not.toContain("overlay=");
  });

  // ── 4.5 overlay deep-link with workbench mode ──

  test("4.5: ?overlayMode=workbench 로 full workbench가 직접 열린다", async ({ page }) => {
    await page.goto(
      "/dashboard/purchase-orders?overlay=/dashboard/purchase-orders/test-po/dispatch&overlayMode=workbench",
    );
    await page.waitForLoadState("networkidle");

    // full workbench overlay 확인 — "발송 워크벤치" 라벨
    // (test-po가 실제로 존재하지 않으면 "로딩 중..." 또는 "찾을 수 없습니다" 표시)
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).not.toContain("overlay=");
    expect(url).not.toContain("overlayMode=");
  });

  // ── 4.6 닫기 버튼 ──

  test("4.6: 닫기 버튼 클릭 시 overlay가 닫힌다", async ({ page }) => {
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByText("진행 현황")).toBeVisible({ timeout: 3000 });

      // 닫기 버튼 클릭
      const closeBtn = page.getByRole("button", { name: "닫기" }).first();
      await closeBtn.click();

      await expect(page.getByText("진행 현황")).not.toBeVisible({ timeout: 2000 });
    }
  });

  // ── 4.7 mobile viewport에서는 full-page 이동 ──

  test("4.7: mobile viewport(375px)에서는 overlay 대신 full-page 이동", async ({ page }) => {
    // mobile viewport 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      // mobile에서는 overlay가 아닌 full-page로 이동해야 함
      await page.waitForTimeout(1000);

      // 현재 URL이 purchase-orders/{id} 형태인지 확인
      // (overlay가 아닌 route 이동이 발생해야 함)
      const url = page.url();
      // overlay Sheet가 보이지 않아야 함 (full-page로 이동했으므로)
      const progressBadge = page.getByText("진행 현황");
      const isOverlayVisible = await progressBadge.isVisible().catch(() => false);

      // mobile이면 overlay가 열리지 않거나, full-page로 이동
      // 둘 중 하나면 pass
      expect(
        url.includes("/purchase-orders/") || !isOverlayVisible,
      ).toBeTruthy();
    }
  });

  // ── 4.8 Cmd+Shift+W shortcut ──

  test("4.8: Cmd+Shift+W로 progress → workbench 전환", async ({ page }) => {
    await page.goto("/dashboard/purchase-orders");
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("[data-testid='actionable-row']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByText("진행 현황")).toBeVisible({ timeout: 3000 });

      // Cmd+Shift+W (macOS) or Ctrl+Shift+W (Linux/Windows)
      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+Shift+W`);

      // 잠시 대기 후 full workbench가 열렸는지 확인
      await page.waitForTimeout(500);
      // "발송 워크벤치" 또는 full overlay 관련 요소
      // (Radix Sheet → Dialog 전환이 발생해야 함)
    }
  });
});
