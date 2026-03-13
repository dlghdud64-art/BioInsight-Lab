import { test, expect } from "@playwright/test";
import { loginWithSession, loginAsAdmin } from "./helpers/auth";

/**
 * S07. 권한 없는 사용자 접근 차단 (보안)
 * 플랫폼: Desktop
 * 역할: 관리자/승인권자 (주)
 *
 * P1 핫픽스(admin 권한체크 복구) 검증 포함
 */
test.describe("S07: 권한 접근 제어 (P1 핫픽스 검증)", () => {
  test.describe("비인증 사용자 → 401", () => {
    test("admin/orders POST → 401", async ({ request }) => {
      const res = await request.post("/api/admin/orders", {
        data: { quoteId: "fake" },
      });
      expect(res.status()).toBe(401);
    });

    test("admin/quotes GET → 401", async ({ request }) => {
      const res = await request.get("/api/admin/quotes");
      expect(res.status()).toBe(401);
    });

    test("products/update PATCH → 401", async ({ request }) => {
      const res = await request.patch("/api/products/fake-id/update", {
        data: { name: "hacked" },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe("일반 사용자(RESEARCHER) → 403", () => {
    test.beforeEach(async ({ page }) => {
      await loginWithSession(page);
    });

    test("admin/orders POST → 403", async ({ page }) => {
      const res = await page.request.post("/api/admin/orders", {
        data: { quoteId: "fake" },
      });
      expect(res.status()).toBe(403);

      const body = await res.json();
      expect(body.error).toContain("관리자 권한");
    });

    test("admin/quotes GET → 403", async ({ page }) => {
      const res = await page.request.get("/api/admin/quotes");
      expect(res.status()).toBe(403);

      const body = await res.json();
      expect(body.error).toContain("관리자 권한");
    });

    test("products/update PATCH → 403", async ({ page }) => {
      const res = await page.request.patch(
        "/api/products/fake-id/update",
        { data: { name: "hacked" } }
      );
      expect(res.status()).toBe(403);

      const body = await res.json();
      expect(body.error).toContain("관리자 권한");
    });
  });

  test.describe("관리자(ADMIN) → 정상 접근", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("admin/quotes GET → 200", async ({ page }) => {
      const res = await page.request.get("/api/admin/quotes");
      // 200 (또는 데이터 없으면 200 + 빈 배열)
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("quotes");
    });
  });
});
