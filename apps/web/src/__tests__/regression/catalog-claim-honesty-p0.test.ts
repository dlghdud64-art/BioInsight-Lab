/**
 * §catalog-honesty (P0) — 허위 "500만+ 품목" 클레임 제거 회귀 가드
 *
 * Truth (2026-06-08 cowork TR): searchProducts(src/lib/api/products.ts)는 로컬
 *   db.product 만 조회(외부 5M 소스 0, Prisma 없으면 sample fallback). 실제 검색
 *   집합 = import-catno-master "검증 실거래 286 Product" + seed ~31. 따라서
 *   "500만+ 품목"은 무근거 광고 = canonical(표시) 위반(웰호류). 정성 표현으로 정정.
 *
 * 가드: 검색 안내 surface 들에 "500만"·"5,000,000 품목" 마케팅 클레임 재출현 0.
 *   (예산 임계 "500만원" 등 비마케팅 용도는 본 가드 대상 아님 — surface 한정.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SURFACES = [
  "src/app/_components/ops-flow-section.tsx",
  "src/app/_workbench/search/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/support-center/page.tsx",
  "src/components/dashboard/command-palette.tsx",
];

describe("§catalog-honesty — 검색 surface 허위 폭 클레임 0", () => {
  for (const f of SURFACES) {
    it(`${f} — "500만"/"5,000,000 품목" 마케팅 클레임 없음`, () => {
      const src = read(f);
      expect(src).not.toMatch(/500만/);
      expect(src).not.toMatch(/5,000,000\s*(품목|개|건)/);
    });
  }
});
