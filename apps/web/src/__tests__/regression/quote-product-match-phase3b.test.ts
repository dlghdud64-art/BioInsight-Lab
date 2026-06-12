import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §catalog-A P3b — quote-scoped 매칭 + 끊긴 등록(① 400) 봉합 + quote-access 가드.
//   배치 위치: src/__tests__/regression/ (REPO_WEB = 3단계 상승, phase3a 동형).
//   패턴: readFileSync + regex (CLAUDE.md sentinel). 런타임 401/403/200 은 smoke(P4) 책임.

const REPO_WEB = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}

const ROUTE = "src/app/api/quotes/[id]/match-products/route.ts";
const PURE = "src/lib/catalog/quote-product-match.ts";
const MODAL = "src/components/quotes/ai-quote-parse-modal.tsx";
const VENDOR_REPLIES = "src/app/api/quotes/[id]/vendor-replies/route.ts";

describe("§catalog-A P3b-1 — match-products: quote-scoped 계약", () => {
  it("route 가 path param(quoteId)을 수신한다", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/params/);
    expect(src).toMatch(/const\s*\{\s*id(\s*:\s*quoteId)?\s*\}\s*=\s*await\s+params/);
  });

  it("pool = 이 견적의 items(QuoteListItem), 전 카탈로그 Product findMany 아님", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.quote\.findUnique/);
    expect(src).toMatch(/include:\s*\{[^}]*items/);
    expect(src).not.toMatch(/db\.product\.findMany/);
  });

  it("응답 후보가 quoteItemId(=QuoteListItem.id)를 담는다", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/quoteItemId/);
  });

  it("tier 순수함수를 재사용한다(로직 재구현 금지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/matchQuoteItemToProduct/);
  });
});

describe("§catalog-A P3b-2 — match-products: quote-access 가드(401 + 403)", () => {
  it("401 인증 게이트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/session\?\.user\?\.id/);
    expect(src).toMatch(/status:\s*401/);
  });

  it("403 quote-access (isOwner ‖ isOrgMember) — 타 조직 quoteItem 노출 차단", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/status:\s*403/);
    expect(src).toMatch(/userId\s*===\s*session\.user\.id|isOwner/);
    expect(src).toMatch(/organizationMember|organizationId|isOrgMember/);
  });

  it("role 게이트(ADMIN|SUPPLIER)는 없다 — read 라우트, 승격 아님", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/UserRole\.(ADMIN|SUPPLIER)/);
  });
});

describe("§catalog-A P3b-3 — 끊긴 등록(① 400) 봉합 (모달)", () => {
  it("빈 quoteItemId 전송 금지 — '' 하드코딩 제거", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/quoteItemId:\s*""/);
  });

  it("picker 선택 quoteItemId 를 등록 payload 에 사용", () => {
    const src = read(MODAL);
    expect(src).toMatch(/selectedQuoteItemId/);
    expect(src).toMatch(/const\s+quoteItemId\s*=\s*selectedQuoteItemId\[idx\]/);
  });

  it("candidate 배지가 클릭 가능(dead-end 0) — Sheet/picker 트리거", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onClick|onPress|Sheet/);
  });
});

describe("§catalog-A P3b-4 — P3a 회귀 0 (항상 GREEN)", () => {
  it("tier 순수함수 게이트 철학 보존 (exact 단일 auto, candidate merge 금지)", () => {
    const src = read(PURE);
    // /s flag 는 tsc target es2017 미지원(TS1501) → [\s\S] 동치 패턴.
    expect(src).toMatch(/catMatches\.length\s*===\s*1[\s\S]*tier:\s*"exact"/);
    expect(src).toMatch(/catMatches\.length\s*>=\s*2[\s\S]*tier:\s*"candidate"/);
    expect(src).toMatch(/tier:\s*"none"/);
  });

  it("순수함수는 candidates-agnostic (modelNumber optional, pool 무관)", () => {
    const src = read(PURE);
    expect(src).toMatch(/matchQuoteItemToProduct\s*\(\s*\n?\s*item:/);
    expect(src).toMatch(/products:\s*QuoteProductTarget\[\]/);
  });

  it("vendor-replies quoteItemId 검증 계약 보존 (봉합 대상 불변)", () => {
    const src = read(VENDOR_REPLIES);
    expect(src).toMatch(/quoteItemId/);
    expect(src).toMatch(/validItemIds|잘못된 quoteItemId/);
  });
});

describe("§catalog-A P3b-5 — ① 봉합 구조 락 (호영님 invariant 권고 2026-06-12)", () => {
  it("invariant: 매칭 pool ⊆ quote.items — 후보 quoteItemId 는 항상 이 견적 items 에서 유래", () => {
    const src = read(ROUTE);
    // pool 생성이 quote.items.map 단일 경로 — 후행이 전 카탈로그(db.product)로 되돌리면 RED.
    expect(src).toMatch(/quote\.items\.map/);
    expect(src).not.toMatch(/db\.product\./);
    // matches[].quoteItemId = QuoteListItem.id 매핑 명시(등록축 정합 락).
    expect(src).toMatch(/quoteItemId:\s*m\.id/);
  });

  it("dead-picker 0: candidate 클릭 대상 Sheet 본체(JSX) 존재 — trigger 만 있고 렌더 0 금지", () => {
    const src = read(MODAL);
    // P3b-3 it3 의 onClick|Sheet OR 약점 봉합 — Sheet 본체 + 제목 + 후보 매핑 모두 명시 락.
    expect(src).toMatch(/<SheetContent/);
    expect(src).toMatch(/매칭할 견적 품목 선택/);
    expect(src).toMatch(/setSelectedQuoteItemId\(\(prev\)/);
    // trigger(setPickerLineIndex)와 본체(open=\{pickerLineIndex)가 짝으로 존재.
    expect(src).toMatch(/setPickerLineIndex\(idx\)/);
    expect(src).toMatch(/open=\{pickerLineIndex !== null\}/);
  });
});
