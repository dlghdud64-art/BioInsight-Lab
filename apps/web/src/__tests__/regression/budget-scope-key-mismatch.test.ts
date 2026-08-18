/**
 * §budget-scope-key-mismatch — 예산 사용액 집계 키 공간 sentinel (2026-08-18 프로덕션 실측 회귀)
 *
 * 실측: 850,000원 PurchaseRecord 생성 · 예산은 usedAmount 0 / remainingAmount 5,000,000.
 *       Budget.scopeKey = organizationId, PurchaseRecord.scopeKey = workspaceId 로
 *       키 공간이 갈려 지출이 영원히 0으로 잡혔다(잔액 과대 표시 = 위험한 방향).
 *
 * 잠그는 것: 집계 3곳이 모두 공통 해석기를 쓴다 · Budget.scopeKey 단일 비교가 남아있지 않다
 *            · 해석기가 조직→워크스페이스(1:1)를 실제로 조회한다 · 쓰기 경로는 안 건드린다.
 * 잠그지 못하는 것: 실 DB 집계값 · 기간 산출(별도 백로그) · UI 표시.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const HELPER = "lib/budget/purchase-scope-keys.ts";
const SITES = [
  "app/api/user-budgets/route.ts",
  "app/api/budgets/route.ts",
  "app/api/budgets/[id]/route.ts",
];

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => strip(readFileSync(join(ROOT, rel), "utf8"));

describe("§budget-scope-key-mismatch — 집계 키 해석기", () => {
  it("해석기가 조직 → 워크스페이스(1:1)를 실제로 조회한다", () => {
    const s = read(HELPER);
    expect(s).toMatch(/workspace\.findUnique/);
    expect(s).toMatch(/organizationId: orgId/);
    expect(s).toMatch(/export async function resolveBudgetPurchaseScopeKeys/);
  });

  it("🛑 해석기는 읽기 전용 — 쓰기(create/update/delete) 0", () => {
    const s = read(HELPER);
    expect(s).not.toMatch(/\.(create|update|delete|upsert|createMany|updateMany)\(/);
  });

  it("집계 3곳 전부 해석기를 쓴다", () => {
    for (const site of SITES) {
      const s = read(site);
      expect(s, site).toMatch(/resolveBudgetPurchaseScopeKeys\(budget\)/);
      expect(s, site).toMatch(/scopeKey: \{ in: purchaseScopeKeys \}/);
    }
  });

  it("🛑 purchaseRecord 조회에 scopeKey 단일 비교가 남아있지 않다", () => {
    for (const site of SITES) {
      const s = read(site);
      /* 🛑 창을 **purchaseRecord 조회부로 좁힌다.** 파일 전역에 걸면 오탐이 난다 —
       *    2026-08-18 실측: user-budgets/route.ts L125 `scopeKey: budget.scopeKey` 는
       *    조회가 아니라 **응답 DTO 필드**(하위 호환)라서 전역 단언이 그것을 잡았다.
       *    잠글 대상은 "집계 쿼리가 단일 키로 되돌아가는 것" 이지 DTO 표기가 아니다. */
      let i = s.indexOf("purchaseRecord.findMany");
      expect(i, `${site}: purchaseRecord.findMany 미발견 — 창이 안 잡히면 단언이 공집합에 통과한다`).toBeGreaterThan(-1);
      while (i >= 0) {
        const win = s.slice(i, i + 400); // findMany( … where … ) 창
        expect(win, `${site} @${i}`).not.toMatch(/scopeKey: budget\.scopeKey/);
        expect(win, `${site} @${i}`).not.toMatch(/scopeKey: purchaseScopeKey\b(?!s)/);
        i = s.indexOf("purchaseRecord.findMany", i + 1);
      }
    }
  });
});
