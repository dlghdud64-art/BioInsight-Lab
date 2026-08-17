/**
 * §11.310 #reorder-review-flow — Regression sentinel
 *
 * 호영님 P1 spec (2026-05-26):
 *   재고 운영 도우미 (inventory-ai-assistant-panel) 의 재발주 카드/sticky CTA
 *   재정렬 + ReorderReviewSheet 바텀시트 신규.
 *
 * 카드 button (호영님 spec):
 *   - "재발주안 검토하기" 제거 (sticky CTA 단일화 — 중복 해소)
 *   - "추천 벤더 보기" 유지 (탐색 액션)
 *   - "구매 이력 보기" 신설 (탐색 액션)
 *
 * Sticky CTA:
 *   - "재발주안 검토하기" → 바텀시트 wiring (handleOpenReorderSheet)
 *   - 색상: bg-blue-600 → bg-green-600 (호영님 spec "실행 가능 액션")
 *
 * 바텀시트 (호영님 spec):
 *   - 품목 / 권장 수량 / 보관 위치 요약
 *   - 추천 벤더 list (Q32 = A: PurchaseRecord 집계, MVP 빈 array)
 *   - 최근 구매 list (MVP 빈 array)
 *   - 예상 금액 = 권장 수량 × 최근 단가
 *   - [견적 요청] (Q30 = A: query string) / [바로 발주] (Q31 = A: query string + draft)
 *
 * 색상 정합:
 *   - urgency.high amber-50/amber-600 → yellow-100/yellow-700 (§11.302)
 *   - urgency.urgent red-50/red-600 → red-50/red-700 (text 강화)
 *   - isHighlighted bg-orange-50/50 → bg-emerald-50/40 (재발주 권장 톤)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SHEET_PATH = "src/components/inventory/ReorderReviewSheet.tsx";
const PANEL_PATH = "src/components/ai/inventory-ai-assistant-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.310 — ReorderReviewSheet 컴포넌트", () => {
  it("파일 존재 + export", () => {
    expect(existsSync(join(REPO_ROOT, SHEET_PATH))).toBe(true);
    const src = read(SHEET_PATH);
    expect(src).toMatch(/export\s+function\s+ReorderReviewSheet/);
    expect(src).toMatch(/export\s+interface\s+ReorderReviewInput/);
  });

  it("Sheet (side=bottom) + testid", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/side="bottom"/);
    expect(src).toMatch(/data-testid="reorder-review-sheet"/);
  });

  /* 🔁 은퇴→승계 (2026-08-16 · 38c5aed9 후속)
   *   구 계약: `router.push(\`/dashboard/quotes?${params.toString()}\`)` — **조립 방식에 핀**.
   *   현행:    `router.push(\`/dashboard/quotes?prepare=${encodeURIComponent(quoteId)}\`)`.
   *   목적지(`/dashboard/quotes` 딥링크)와 quoteId 전달은 **그대로 살아 있다.**
   *   query 조립이 `params` → `prepare=<id>` 로 진화했을 뿐이므로 앵커를 계약으로 옮긴다:
   *     ① 목적지  ② quoteId 가 push 인자에 실재  — 조립 방식은 자유. */
  it("[견적 요청] CTA — 목적지 딥링크 + quoteId 전달 (Q30 = A · 앵커 이동)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-request-quote-cta"/);
    expect(src).toMatch(/router\.push\(`\/dashboard\/quotes\?[^`]*\$\{[^}]*quoteId[^}]*\}/);
    expect(src).toMatch(/productName:\s*data\.productName/);

    /* 🔁 은퇴→승계 (2026-08-16) — 같은 it 안의 **4번째** 단언. 위 앵커 이동으로 비로소 드러났다.
     *   🛑 vitest 는 it 당 첫 실패만 보고한다 — 첫 단언을 고치면 형제가 새로 나온다.
     *      (이 저장소 승격 항목: "sentinel 승계는 it() 블록 전체 대조")
     *   구 계약: `reason: "안전 재고 미달…"` — **인라인 객체 프로퍼티 형태에 핀**.
     *   현행:    `const reason = … "안전 재고 미달 — 재고 운영 도우미 권장" + overrideNote;`
     *            → `notes: reason` · `specialNotes: \`…· ${reason}\`` 로 전파.
     *   계약(견적 초안에 사유가 전파된다)은 살아 있고 override 사유 합성이 추가됐다.
     *   앵커를 형태에서 **전파 사실**로 옮긴다. */
    expect(src).toMatch(/["']안전 재고 미달/); // 사유 문구 존재
    expect(src).toMatch(/const reason =/); // 단일 출처로 파생
    /* 🛑 OR 로 쓰면 안 된다 — 2026-08-16 프로브 실측: `notes: reason` 을 끊어도
     *    `specialNotes` 가 대신 매칭해 GREEN 이 떴다(§정규식 sentinel ④ 대체 매칭).
     *    전파 경로가 둘이면 **둘 다** 잠근다. 하나가 끊기는 것도 회귀다. */
    expect(src).toMatch(/notes:\s*reason/); // 경로 ① 견적 초안 notes
    expect(src).toMatch(/specialNotes:[^\n]*\$\{reason\}/); // 경로 ② specialNotes 합성
  });

  it("[바로 발주] CTA — query string + PO draft (Q31 = A)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-direct-purchase-cta"/);
    expect(src).toMatch(/router\.push\(`\/dashboard\/purchase-orders\/new\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/prefill:\s*["']reorder-recommendation["']/);

    /* 🔁 은퇴→승계 (2026-08-16 · 38c5aed9 후속) — **축이 바뀌었다: disabled → 렌더 게이트**
     *   구 계약: `disabled={!hasVendor || !purchasingOn}` — 공급사 0건이면 비활성.
     *   현행:    `{hasVendor && ( <Button … disabled={!purchasingOn}> )}`
     *            공급사 0건이면 **버튼을 아예 만들지 않는다.**
     *   🛑 의도는 보존됐고 구현이 **더 강하다** — CLAUDE.md "액션 없으면 버튼을 만들지 않는다".
     *      sentinel 이 disabled 축만 보고 렌더 게이트 축을 안 봐서 못 따라온 것이다.
     *      라벨(`disabled 배선`)로 판정했으면 멀쩡한 구현을 disabled 로 되돌릴 뻔했다.
     *
     *   🛑 역계약이 이 승계의 실질이다. 그냥 현행에 맞추면 다음 사람이
     *      `disabled={!hasVendor || !purchasingOn}` 로 "복원"하면서 렌더 게이트를 걷어낼 수 있고,
     *      그러면 dead button 이 다시 생긴다. 아래 not.toMatch 가 그 경로를 막는다. */
    expect(src).toMatch(/\{hasVendor && \(/); // 렌더 게이트 — 공급사 0건이면 미생성
    expect(src).not.toMatch(/disabled=\{[^}]*hasVendor/); // 역계약 — disabled 로 되돌리면 RED
    expect(src).toMatch(/disabled=\{!purchasingOn\}/); // purchasing-off 는 disabled 가 맞다(권한 축)
  });

  it("색상 — green-600 (실행 가능 액션 — 호영님 spec)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
  });

  it("amber/orange 0 (§11.310 scope 정합)", () => {
    const src = read(SHEET_PATH);
    expect(src).not.toMatch(/bg-amber-/);
    expect(src).not.toMatch(/text-amber-/);
    expect(src).not.toMatch(/bg-orange-/);
    expect(src).not.toMatch(/border-amber-/);
  });

  /* 🔁 은퇴→승계 + 🛑 중복 제거 (2026-08-16 · 38c5aed9 후속)
   *   구 계약: `/등록된 공급사가 없습니다.*견적 요청으로 시작/`
   *   현행:    `이 품목에 등록된 공급사가 없습니다` + `초안을 만든 뒤 바로 공급사 지정 화면으로 이동합니다.`
   *            v21 흐름으로 안내가 교체됐다(`견적 요청으로 시작` → `공급사 지정 화면으로 이동`).
   *
   *   🛑 문안 계약은 여기서 **은퇴**시킨다 — 이미 두 곳이 잠그고 있다:
   *      제목  reorder-quote-handoff.test.ts:123  /이 품목에 등록된 공급사가 없습니다/
   *      본문  design/reorder-handoff-impl-conformance.test.ts:211 (축 C · fixture 1b.no_vendor 병합)
   *      같은 문자열을 세 곳이 핀하면 문안 변경 때 한 곳만 고치고 RED 가 난다.
   *
   *   여기 남기는 것은 **축 C 가 안 잡는 것**뿐이다 — testid 는 fixture 라벨이 아니다. */
  it("추천 벤더 0건 시 fallback — 전용 블록 존재 (문안 계약은 축 C·handoff 로 이관)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-no-vendor"/);
    // 🛑 문안 재핀 금지 — 여기서 다시 잠그면 삼중 핀으로 돌아간다.
    expect(src).not.toMatch(/견적 요청으로 시작/); // 구판 문안 부활 방어(역계약)
  });

  it("예상 금액 = 검토 수량 × 최근 단가 (자동 계산)", () => {
    // §inventory-mobile-reorder-gate P2 (호영님 승인 2026-07-28) — 권장 수량 스테퍼 도입으로
    // 예상 금액 기준이 data.recommendedQty(고정) → qty(스테퍼, 초기값 recommendedQty)로 supersede.
    const src = read(SHEET_PATH);
    expect(src).toMatch(/estimatedAmount\s*=\s*primaryVendor\s*\?\s*qty\s*\*\s*primaryVendor\.unitPrice/);
    expect(src).toMatch(/const \[qty, setQty\] = useState<number>\(baseQty\)/);
    expect(src).toMatch(/data-testid="reorder-review-estimated-amount"/);
  });

  it("최근 구매 + 추천 벤더 list — testid + map slice(0, 3)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="reorder-review-vendor-row"/);
    expect(src).toMatch(/data-testid="reorder-review-purchase-row"/);
    expect(src).toMatch(/data\.vendors\.slice\(0,\s*3\)/);
    expect(src).toMatch(/data\.recentPurchases\.slice\(0,\s*3\)/);
  });

  it("터치 영역 ≥ 44px (모바일 a11y, h-11 min-h-[44px])", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/h-11 min-h-\[44px\]/);
  });
});

describe("§11.310 — inventory-ai-assistant-panel wiring", () => {
  it("ReorderReviewSheet import", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ReorderReviewSheet[^}]*type\s+ReorderReviewInput[^}]*\}\s*from\s*["']@\/components\/inventory\/ReorderReviewSheet["']/);
  });

  it("isReorderSheetOpen + selectedReorderForReview state", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/isReorderSheetOpen.*useState\(false\)/);
    expect(src).toMatch(/selectedReorderForReview/);
  });

  it("handleOpenReorderSheet (선택된 recommendation + sheet open + caller props 호환)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/handleOpenReorderSheet[\s\S]{0,200}setSelectedReorderForReview/);
    expect(src).toMatch(/setIsReorderSheetOpen\(true\)/);
    expect(src).toMatch(/onReviewReorder\?\.\(recommendation\)/);
  });

  it("ReorderReviewInput 매핑 (productName / recommendedQty / vendors / recentPurchases)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/reorderReviewInput:\s*ReorderReviewInput\s*\|\s*null/);
    expect(src).toMatch(/productName:\s*selectedReorderForReview\.productName/);
    expect(src).toMatch(/recommendedQty:\s*selectedReorderForReview\.recommendedQty/);
  });

  it("StickyActions onReviewReorder = handleOpenReorderSheet (sticky CTA wiring)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/<StickyActions[\s\S]{0,200}onReviewReorder=\{handleOpenReorderSheet\}/);
  });

  it("Sticky CTA 색상 — green-600 (호영님 spec)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-sticky-cta"/);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
  });

  it("ReorderReviewSheet 렌더 (panel Sheet 내부)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/<ReorderReviewSheet[\s\S]{0,200}open=\{isReorderSheetOpen\}[\s\S]{0,200}data=\{reorderReviewInput\}/);
  });
});

describe("§11.310 — 카드 내부 button 분리 (호영님 spec)", () => {
  it("'재발주안 검토하기' button 카드 내부에서 제거 (sticky CTA 단일화)", () => {
    const src = read(PANEL_PATH);
    // ReorderSection 안 (line 470~596) "재발주안 검토하기" button 제거 확인
    // sticky CTA (line 793~) 에는 보존 — 단일 위치
    const reorderSectionMatch = src.match(/function ReorderSection\(([\s\S]*?)\n\/\/ ── 5\. Lot/);
    expect(reorderSectionMatch).toBeTruthy();
    if (reorderSectionMatch) {
      // §11.310 구조 진화: 추출 마커 non-greedy(// ── 5. Lot). 주석(button 제거 설명)은 strip 후 검증.
      const body = reorderSectionMatch[1]
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
      expect(body).not.toMatch(/재발주안 검토하기/);
    }
  });

  it("카드 '추천 벤더 보기' 유지 (testid)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-card-view-vendors-cta"/);
    expect(src).toMatch(/추천 벤더 보기/);
  });

  it("카드 '구매 이력 보기' 신설 (testid + History icon + 라우팅)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/data-testid="reorder-card-view-history-cta"/);
    expect(src).toMatch(/구매 이력 보기/);
    expect(src).toMatch(/<History className="h-3 w-3 mr-1"/);
    expect(src).toMatch(/\/dashboard\/purchases\?/);
  });
});

describe("§11.310 — 색상 정합 (§11.302 신호등 체계, amber → yellow)", () => {
  it("urgency.high amber → yellow-100/yellow-700", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/high:\s*\{[\s\S]{0,200}bg-yellow-100 text-yellow-700 border-yellow-200/);
  });

  it("urgency.urgent — red 톤 보존 (text-red-700 강화)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/urgent:\s*\{[\s\S]{0,200}bg-red-50 text-red-700 border-red-200/);
  });

  it("ReorderSection isHighlighted — orange-50 → emerald-50 (재발주 권장 톤)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/isHighlighted \? "bg-emerald-50\/40"/);
  });

  it("ReorderSection 안 amber-50 / amber-600 / orange-50 잔여 0 (§11.310 scope)", () => {
    const src = read(PANEL_PATH);
    const reorderSectionMatch = src.match(/function ReorderSection\(([\s\S]*?)\n\/\/ ── 5\. Lot/);
    expect(reorderSectionMatch).toBeTruthy();
    if (reorderSectionMatch) {
      expect(reorderSectionMatch[1]).not.toMatch(/bg-amber-50 text-amber-600/);
      expect(reorderSectionMatch[1]).not.toMatch(/bg-orange-50\/50/);
    }
  });
});

describe("§11.310 — 회귀 0 (보존)", () => {
  it("ReorderSection 라벨 (재발주 우선순위 / 권장 발주 수량 / 추천 벤더) 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/재발주 우선순위/);
    expect(src).toMatch(/권장 발주 수량/);
    expect(src).toMatch(/추천 벤더/);
  });

  it("StickyActions hasReorder 분기 + onViewActions + onCreatePurchaseRequest 보존", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/onCreatePurchaseRequest/);
    expect(src).toMatch(/onViewActions/);
    expect(src).toMatch(/hasReorder/);
  });

  it("LotExpirySection 변경 0 (§11.310 scope 외 — 후속 §11.302d-6)", () => {
    const src = read(PANEL_PATH);
    expect(src).toMatch(/function LotExpirySection/);
    // LotExpirySection 의 isHighlighted bg-amber-50\/40 — out of scope (보존)
  });
});
