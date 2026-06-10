/**
 * §11.318 Phase 1c — API + same-canvas 드로어 wiring sentinel
 *
 * 호영님 P1 (2026-05-30):
 *   Phase 1c 완료 기준 단언:
 *   - 신규 추천 API (/api/sourcing/recommend) — productId 파라미터, PurchaseRecord 조회,
 *     LeadTimeIndex 구성, buildSourcingRecommendation 호출, sourceLabel "과거 구매 기록 기반"
 *   - sourcing-recommendation-drawer.tsx — SourcingRecommendationDrawer export,
 *     "과거 구매 기록 기반" 뱃지, hasData 분기, 빈 상태, 견적 CTA, dead button 0
 *   - compare/page.tsx wiring — "대체품/벤더 찾기" 버튼, SourcingRecommendationDrawer import,
 *     showSourcingDrawer state, sourcingProductId state
 *
 * 환각 차단 보존:
 *   - API: 추정 전략 생성 0 (buildSourcingRecommendation 순수 함수만)
 *   - 드로어: 자유 텍스트 "전략" 노출 0
 *
 * canonical 보존:
 *   - compare/page.tsx: 기존 CompareAnalysisDrawer 보존
 *   - sourcing-recommendation.ts 코어 변경 0
 *
 * §11.381b 갱신 (호영님 결정 2026-06-10, drawer 구출):
 *   compare 라우트 retire(Phase B)에 따라 드로어를
 *   _workbench/_components/ 로 이식 — 본 sentinel 의 드로어 경로를
 *   신 경로로 갱신, 견적 CTA 는 /compare/quote → /app/quote 재배선.
 *   compare/page.tsx wiring 단언(C 블록)은 B2 라우트 제거 시 함께 정리 예정.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// ── A. 신규 추천 API ──

describe("§11.318 Phase 1c — A. 추천 API (/api/sourcing/recommend)", () => {
  it("API 파일 존재 + GET export + productId 파라미터", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/productId/);
    expect(src).toMatch(/searchParams\.get\("productId"\)/);
  });

  it("인증 — auth() + getAuthUser 패턴", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/getAuthUser/);
    expect(src).toMatch(/Unauthorized|인증이 필요합니다/);
  });

  it("PurchaseRecord 조회 — scopeKey + OR 조건 (itemName/catalogNumber/category)", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/purchaseRecord\.findMany/);
    expect(src).toMatch(/scopeKey/);
    expect(src).toMatch(/OR/);
    expect(src).toMatch(/itemName/);
  });

  it("QuoteListItem 조회 → LeadTimeIndex 구성 (납기 파싱)", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/quoteListItem\.findMany/);
    expect(src).toMatch(/leadTimeIndex/);
    expect(src).toMatch(/parseLeadTimeDays/);
  });

  it("buildSourcingRecommendation 호출", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/buildSourcingRecommendation/);
  });

  it("sourceLabel '과거 구매 기록 기반' 응답 포함", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/과거 구매 기록 기반/);
  });

  it("환각 차단 — buildLocalAnalysis/추정 전략 생성 코드 0", () => {
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).not.toMatch(/buildLocalAnalysis/);
    expect(src).not.toMatch(/estimatedPrice|estimatedDelivery/);
    expect(src).not.toMatch(/aiSummary|scenarios/);
  });
});

// ── B. sourcing-recommendation-drawer.tsx ──

describe("§11.318 Phase 1c — B. SourcingRecommendationDrawer", () => {
  it("SourcingRecommendationDrawer export + Sheet same-canvas", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/export function SourcingRecommendationDrawer/);
    expect(src).toMatch(/Sheet/);
    expect(src).toMatch(/SheetContent/);
  });

  it("'과거 구매 기록 기반' 뱃지 (SourceBadge / sourceLabel)", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/과거 구매 기록 기반/);
    expect(src).toMatch(/sourcing-source-badge/);
  });

  it("hasData 분기 — 데이터 있을 때 / 없을 때(EmptyState)", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/hasData/);
    expect(src).toMatch(/EmptyState/);
    expect(src).toMatch(/sourcing-empty-state/);
  });

  it("빈 상태 견적 CTA — /app/quote Link + testid (§11.381b 재배선)", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/\/app\/quote/);
    expect(src).toMatch(/sourcing-empty-quote-cta/);
    expect(src).toMatch(/견적 요청하기/);
  });

  it("벤더 비교 섹션 — VendorRow + 최저가/최단납기 뱃지", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/VendorRow/);
    expect(src).toMatch(/isLowestPrice/);
    expect(src).toMatch(/isFastest/);
    expect(src).toMatch(/sourcing-vendor-row/);
  });

  it("대체품 섹션 — SubstituteRow + reason 표시", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/SubstituteRow/);
    expect(src).toMatch(/sourcing-substitute-row/);
    expect(src).toMatch(/sub\.reason/);
  });

  it("벤더 선택 후 견적 CTA — sourcing-vendor-quote-cta testid", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/sourcing-vendor-quote-cta/);
  });

  it("loading / error 상태 testid 존재 (dead state 0)", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/sourcing-loading/);
    expect(src).toMatch(/sourcing-error/);
  });

  it("납기 미확인 — leadTimeSource=unknown 시 '(미확인)' 표시 (지어내기 0)", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/leadTimeSource.*unknown|unknown.*미확인/);
    expect(src).toMatch(/미확인/);
  });

  it("드로어 testid sourcing-recommendation-drawer 존재", () => {
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/sourcing-recommendation-drawer/);
  });
});

// ── C. compare/page.tsx wiring ──

describe("§11.318 Phase 1c — C. CTA wiring (§11.381c 갱신: compare/page retire → 소싱 섹션 이전)", () => {
  // §11.381c (2026-06-10): compare/page.tsx retire — 드로어 CTA wiring 의
  // canonical 소비처는 sourcing-spec-compare-section (§11.381b 가 상세 검증).
  // 본 블록은 구 표면 부재 + 신 표면 wiring 존재의 요점만 잠근다.
  const SECTION = "src/app/_workbench/_components/sourcing-spec-compare-section.tsx";

  it("compare/page.tsx 소멸 (구 wiring 표면 부재)", () => {
    expect(existsSync(join(REPO_ROOT, "src/app/compare/page.tsx"))).toBe(false);
  });

  it("소싱 섹션 — '대체품/벤더 찾기' 버튼 + drawer wiring 존재", () => {
    const src = read(SECTION);
    expect(src).toMatch(/대체품\/벤더 찾기/);
    expect(src).toMatch(/sourcing-find-btn/);
    expect(src).toMatch(/setShowSourcingDrawer\(true\)/);
    expect(src).toMatch(/<SourcingRecommendationDrawer/);
    expect(src).toMatch(/productId=\{sourcingProductId\}/);
    expect(src).toMatch(/productName=\{sourcingProductName\}/);
  });
});

// ── D. canonical 보존 ──

describe("§11.318 Phase 1c — D. canonical 보존 (환각 경계 + 코어 변경 0)", () => {
  it("sourcing-recommendation.ts 코어 — strategy/recommendationText 생성 0 (환각 표면 미노출)", () => {
    const src = read("src/lib/compare-workspace/sourcing-recommendation.ts");
    expect(src).not.toMatch(/strategy\s*:/);
    expect(src).not.toMatch(/recommendationText/);
  });

  it("API — 신규 page 없음 (same-canvas 드로어만)", () => {
    // sourcing/recommend 는 API route, page route 아님 (Next.js page.tsx 없음)
    const src = read("src/app/api/sourcing/recommend/route.ts");
    expect(src).toMatch(/export async function GET/);
    // page.tsx 형태로 export default 없음
    expect(src).not.toMatch(/export default function/);
  });

  it("드로어 — 신규 page.tsx 미생성 (Sheet same-canvas 패턴)", () => {
    // sourcing-recommendation-drawer.tsx 는 Sheet 컴포넌트, 독립 page 아님
    const src = read("src/app/_workbench/_components/sourcing-recommendation-drawer.tsx");
    expect(src).toMatch(/<Sheet/);
    expect(src).not.toMatch(/export default function/); // page.tsx 패턴 아님
  });
});
