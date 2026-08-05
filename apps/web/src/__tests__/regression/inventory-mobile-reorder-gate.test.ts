/**
 * §inventory-mobile-reorder-gate — 재고 모바일 AI 재발주 검토 no-op 수정 (호영님 승인 2026-07-28)
 *
 * 원인(실측):
 *   ① 모바일 onReorder → openReorderReview → openContextPanel: ContextPanel은 데스크톱
 *      컨테이너에서만 렌더 → 모바일 침묵 no-op. §11.155 MobileOperationalBriefSheet(모바일 변종)도
 *      데스크톱 컨테이너(hidden md:flex) "내부"에 렌더되어 조상 display:none으로 dead code였음.
 *   ② InventoryReorderReviewSheet는 recommendedQty null/0이면 data=null → 침묵 미표시.
 *   ③ 차단 사유는 데스크톱 분기에서만 소비 — 모바일은 무반응.
 *   ④ 바텀시트 scrim이 fixed 헤더까지 덮음.
 *
 * 수정:
 *   P1 openReorderReview viewport 분기(모바일 3분기: 추천→시트/차단→소프트 게이트/미산출→fallback)
 *      + MobileOperationalBriefSheet top-level 재배치(§11.155 복원).
 *   P2 로딩 CTA(추천 수량 계산 중) + 안전재고 fallback(출처 배지, 가짜 AI 라벨 금지)
 *      + 검토 시트 스테퍼·breakdown 캡션·상태 도트(시안 ①).
 *   P3 소프트 게이트 시트(하드 차단 금지) + override 사유 시트 표기·견적 초안 reason 전파.
 *   P4 SheetContent overlayClassName("!top-14") — scrim 헤더 비침범.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest 권위).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const CONTENT = read("src/app/dashboard/inventory/inventory-content.tsx");
const VIEW = read("src/components/inventory/mobile-inventory-view.tsx");
const WRAPPER = read("src/components/inventory/inventory-reorder-review-sheet.tsx");
const SHEET = read("src/components/inventory/ReorderReviewSheet.tsx");
const BLOCKED = read("src/components/inventory/inventory-reorder-blocked-sheet.tsx");
const UI_SHEET = read("src/components/ui/sheet.tsx");

describe("§inventory-mobile-reorder-gate P1 — 모바일 배선(no-op 0)", () => {
  it("openReorderReview가 viewport 분기 — 데스크톱 ContextPanel 유지 + 모바일 직접 라우팅", () => {
    expect(CONTENT).toMatch(/window\.matchMedia\("\(min-width: 768px\)"\)\.matches/);
    expect(CONTENT).toMatch(/if \(isDesktop\) \{\s*\n\s*openContextPanel\(inventory, "reorder"\)/);
  });

  it("모바일 3분기 — 차단→소프트 게이트 / 추천→검토 시트 / 미산출→안전재고 fallback", () => {
    expect(CONTENT).toMatch(/setReorderBlockedState\(\{ item: inventory, reasons: mBlocked \}\)/);
    expect(CONTENT).toMatch(/mQty != null && mQty > 0/);
    expect(CONTENT).toMatch(/Math\.max\(0, \(inventory\.safetyStock \?\? 0\) - inventory\.currentQuantity\)/);
  });

  it("§11.155 모바일 브리핑 시트 재배치 — 데스크톱 컨테이너 탈출(top-level, dead code 복원)", () => {
    expect(CONTENT).toMatch(/§11\.155 모바일 브리핑 시트 재배치[\s\S]{0,700}<MobileOperationalBriefSheet/);
    // 구 위치(Context Panel 직전) 잔재 없음 — MobileOperationalBriefSheet 렌더는 1곳뿐
    expect(CONTENT.match(/<MobileOperationalBriefSheet/g)?.length).toBe(1);
  });

  it("게이트/검토 시트 상태 배선 — InventoryReorderBlockedSheet 렌더 + onProceed override 전파", () => {
    expect(CONTENT).toMatch(/<InventoryReorderBlockedSheet/);
    expect(CONTENT).toMatch(/setReorderOverrideReasons\(reasons\)/);
    expect(CONTENT).toMatch(/overrideReasons=\{reorderOverrideReasons\}/);
  });
});

describe("§inventory-mobile-reorder-gate P2 — 침묵 금지", () => {
  it("추천 쿼리 로딩 중 상세 시트 CTA 로딩 상태(비활성 + 스피너), 실 핸들러 보존", () => {
    expect(CONTENT).toMatch(/isLoading: reorderRecoLoading/);
    expect(CONTENT).toMatch(/reorderRecoLoading=\{reorderRecoLoading\}/);
    expect(VIEW).toMatch(/추천 수량 계산 중…/);
    expect(VIEW).toMatch(/reorderRecoLoading \?/);
    expect(VIEW).toMatch(/onReorder\(inv\)/); // mobile-reco-tone lock 보존
  });

  it("wrapper — canonical 우선 + fallback 수량(둘 다 없으면 미표시, 가짜 0 금지)", () => {
    expect(WRAPPER).toMatch(/recommendedQty != null && recommendedQty > 0/);
    expect(WRAPPER).toMatch(/fallbackQty != null && fallbackQty > 0/);
    expect(WRAPPER).toMatch(/qtySource=\{hasCanonicalQty \? "ai" : "safety-fallback"\}/);
  });

  it("검토 시트 — 출처 배지(AI 권장 / 안전재고 기준, 가짜 AI 라벨 금지)", () => {
    expect(SHEET).toMatch(/data-testid="reorder-review-qty-source-ai"/);
    expect(SHEET).toMatch(/data-testid="reorder-review-qty-source-fallback"/);
    expect(SHEET).toMatch(/AI 추천 미산출 · 안전재고 기준 수량/);
  });

  it("검토 시트 — 스테퍼(34px) + breakdown 근거 캡션 + 상태 도트(실값 조건)", () => {
    expect(SHEET).toMatch(/data-testid="reorder-review-qty-stepper"/);
    expect(SHEET).toMatch(/width: 34, height: 34/);
    expect(SHEET).toMatch(/data-testid="reorder-review-qty-breakdown"/);
    expect(SHEET).toMatch(/부족 \{breakdown\.safetyGap\} \+ 리드타임 소비 \{breakdown\.leadTimeConsumption\}/);
    expect(SHEET).toMatch(/h-\[7px\] w-\[7px\] rounded-full bg-rose-500/);
  });
});

describe("§inventory-mobile-reorder-gate P3 — 소프트 게이트(하드 차단 금지)", () => {
  it("게이트 시트 — 타이틀 한 줄(대시 없음) + 사유별 미니 카드 + yellow hex(amber 클래스 0)", () => {
    expect(BLOCKED).toMatch(/중복 발주 위험이 있습니다/);
    expect(BLOCKED).not.toMatch(/중복 발주 위험이 있습니다[^<"]*[—–-]/);
    expect(BLOCKED).toMatch(/data-testid="reorder-blocked-reason"/);
    expect(BLOCKED).toMatch(/#fffbeb/);
    expect(BLOCKED).toMatch(/#fde68a/);
    expect(BLOCKED).toMatch(/#92400e/);
    expect(BLOCKED).not.toMatch(/bg-amber-|text-amber-|border-amber-|bg-orange-|text-orange-/);
  });

  it("경로 비차단 — '그래도 재발주 검토 진행' primary 상시 + 진행 중 견적 보기 outline", () => {
    expect(BLOCKED).toMatch(/data-testid="reorder-blocked-proceed"/);
    expect(BLOCKED).toMatch(/그래도 재발주 검토 진행/);
    expect(BLOCKED).not.toMatch(/reorder-blocked-proceed"[\s\S]{0,200}disabled/);
    expect(BLOCKED).toMatch(/data-testid="reorder-blocked-view-quotes"/);
  });

  it("정량 근거 — 실값(현재/안전재고 부족분)만, 입고 예정 수량 미표시(canonical 부재)", () => {
    expect(BLOCKED).toMatch(/Math\.max\(0, safetyStock - currentQuantity\)/);
    expect(BLOCKED).not.toMatch(/입고 예정/);
  });

  it("override 기록 — 검토 시트 표기 + 견적 초안 reason 전파(front-only success 0)", () => {
    expect(SHEET).toMatch(/data-testid="reorder-review-override-note"/);
    expect(SHEET).toMatch(/중복 위험 확인 후 진행/);
    expect(SHEET).toMatch(/overrideNote/);
    // §reorder-quote-handoff P2 승계(2026-08-05): reason 전파 경로가 query-string
    // prefill → POST /api/quotes body(items.notes + specialNotes)로 교체.
    // 보호 의도(override 사유가 초안에 남는다)는 동일 — 전파 형태만 진화.
    expect(SHEET).toMatch(/"안전 재고 미달 — 재고 운영 도우미 권장" \+ overrideNote/);
    expect(SHEET).toMatch(/specialNotes[\s\S]{0,120}reason/);
  });
});

describe("§inventory-mobile-reorder-gate P4 — scrim 헤더 비침범", () => {
  it("SheetContent overlayClassName prop — 기본 거동 불변(additive)", () => {
    expect(UI_SHEET).toMatch(/overlayClassName\?: string/);
    expect(UI_SHEET).toMatch(/<SheetOverlay className=\{overlayClassName\} \/>/);
  });

  it("상세/검토/게이트 시트 overlay !top-14 적용", () => {
    expect(VIEW).toMatch(/overlayClassName="!top-14"/);
    expect(SHEET).toMatch(/overlayClassName="!top-14"/);
    expect(BLOCKED).toMatch(/overlayClassName="!top-14"/);
  });
});

describe("§inventory-mobile-reorder-gate — 기존 invariant 보존(회귀 0)", () => {
  it("p2 lock — openReorderReviewSheet 시그니처 verbatim 보존", () => {
    expect(CONTENT).toMatch(/openReorderReviewSheet = \(item: ProductInventory\) => setReorderReviewItem\(item\)/);
  });

  it("p3a lock — 모바일 onReorder 경로·ContextPanel 분기 보존", () => {
    expect(CONTENT).toMatch(/onSearchChange=\{setSearchQuery\}[\s\S]{0,200}openReorderReview\(inventory\)/);
    expect(CONTENT).toMatch(/setContextPanelMode\("reorder"\)/);
  });

  it("310/p3b lock — 견적/발주 route·prefill·게이팅 보존", () => {
    // §reorder-quote-handoff P2·1b 승계(2026-08-05, 호영님 지시문):
    //   견적 = query-string prefill(§11.310 Q30, 소비자 0 no-op 실측) → POST /api/quotes
    //   실생성 + ?prepare= 직행으로 교체. 발주(Q31) prefill 경로는 무변경 보존.
    //   바로 발주 게이팅: 공급사 0 = hide(1b dead button 제거), 공급사 有 = flag 게이팅 유지.
    expect(SHEET).toMatch(/"안전 재고 미달 — 재고 운영 도우미 권장"/);
    expect(SHEET).toMatch(/prefill: "reorder-recommendation"/); // Q31 발주 경로 보존
    expect(SHEET).toMatch(/hasVendor\s*&&[\s\S]{0,400}reorder-review-direct-purchase-cta/);
    expect(SHEET).toMatch(/disabled=\{!purchasingOn\}/);
    expect(SHEET).toMatch(/bg-green-600 hover:bg-green-700/);
  });
});
