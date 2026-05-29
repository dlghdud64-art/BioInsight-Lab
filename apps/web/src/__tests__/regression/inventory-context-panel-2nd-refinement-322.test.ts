/**
 * §11.322 #inventory-context-panel-2nd-refinement — Regression sentinel (Phase 1 RED)
 *
 * 호영님 P1 (구 §11.317 spec, 번호 충돌로 §11.322 매핑, 2026-05-29):
 *   §11.320 production smoke 결과 잔여 5 문제 발견:
 *   A. 재고 현황 카드 잘림 ("0 bot...") — 인라인 라벨-값 row 4
 *   B. 빨간 카드 테두리 잔존 — 텍스트 색상만
 *   C. 상태 배너 ↔ 재고 현황 숫자 중복 — 상태 배너 결론+액션만
 *   D. 리스크 ↔ 상태 배너 안전재고 중복 — risks 필터링
 *   E. 정보 위계 평면 — 권장 액션 접힘 추가
 *
 *   본 sentinel = Phase 1 RED. Phase 2~5 작업으로 GREEN 전환:
 *   - Phase 2: A + B (인라인 row + 위험 텍스트 색상)
 *   - Phase 3: C + D (상태 배너 결론만 + 리스크 필터)
 *   - Phase 4: E (권장 액션 접힘) + 모바일
 *
 * canonical 보존 (Phase 5 가드):
 *   - caller 호출 시그니처 (InventoryContextPanel props) 변경 0
 *   - §11.320 결정 유지 (탭 0 / 상태 배너 / 액션 상단 / 접기 패턴)
 *   - 권장 액션 섹션 자체 보존 (단지 접힘 추가)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/inventory/inventory-context-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.322 — A. 재고 현황 잘림 해결 (Phase 2 GREEN target)", () => {
  it("재고 현황 인라인 row 4 (현재/안전재고/만료 임박/최단 LOT) — grid-cols-3 카드 패턴 제거", () => {
    const src = read(PATH);
    // 옛 grid-cols-3 + MetricCell 패턴 0
    expect(src).not.toMatch(/grid grid-cols-3 gap-3 mt-3[\s\S]{0,400}MetricCell/);
    // 인라인 row testid 4 (current/safety-stock/expiring-soon 보존 + 신규 shortest-lot)
    expect(src).toMatch(/data-testid="inventory-context-kpi-current"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-safety-stock"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-expiring-soon"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-shortest-lot"/);
  });

  it("flex justify-between 패턴 — 라벨 좌 / 값 우 (잘림 0, 단위 풀표기)", () => {
    const src = read(PATH);
    // 4 row 모두 flex justify-between 패턴
    const flexRowCount = (src.match(/data-testid="inventory-context-kpi-(?:current|safety-stock|expiring-soon|shortest-lot)"[\s\S]{0,200}flex.*justify-between/g) || []).length;
    expect(flexRowCount).toBeGreaterThanOrEqual(4);
  });
});

describe("§11.322 — B. 카드 테두리 색상 정리 (Phase 2 GREEN target)", () => {
  it("MetricCell tone={qtyTone} 카드 강조 패턴 0 — 위험은 텍스트 색상만 (text-red-600)", () => {
    const src = read(PATH);
    // qtyTone 변수 자체는 유지 (텍스트 색상 분기용)
    expect(src).toMatch(/qtyTone/);
    // 위험 값 텍스트 색상 분기 패턴 존재 (text-red-600)
    expect(src).toMatch(/qtyTone\s*===\s*"danger"[\s\S]{0,80}text-red-600/);
  });
});

describe("§11.322 — C. 상태 배너 정량 숫자 제거 (Phase 3 GREEN target)", () => {
  it("toneSub — \"현재 {qty}\" 정량 숫자 패턴 0, 결론+액션만", () => {
    const src = read(PATH);
    // 옛 toneSub 패턴 0
    expect(src).not.toMatch(/toneSub\s*=[\s\S]{0,300}현재 \$\{item\.currentQuantity\}/);
    // 신 toneSub = 결론 문구 only ("즉시 재주문 필요" / "우선 소진 권장" / "특이사항 없음")
    expect(src).toMatch(/즉시 재주문 필요|우선 소진 권장/);
  });
});

describe("§11.322 — D. 리스크 필터링 (Phase 3 GREEN target)", () => {
  it("risks 필터 — 안전재고 미달/재고 소진 type 또는 label 제외 (상태 배너 흡수)", () => {
    const src = read(PATH);
    // risks.filter 또는 visibleRisks 변수 신규 존재 (필터링 표현)
    expect(src).toMatch(/visibleRisks|risks\.filter|filteredRisks/);
    // length 0 시 섹션 생략 조건 (이미 있음, 보존)
    expect(src).toMatch(/visibleRisks\.length\s*>\s*0|filteredRisks\.length\s*>\s*0|risks\.filter[\s\S]{0,200}\.length\s*>\s*0/);
  });
});

describe("§11.322 — E. 정보 위계 — 권장 액션 접힘 (Phase 4 GREEN target)", () => {
  it("권장 액션 + 추천 이유 — useState 접기 default false", () => {
    const src = read(PATH);
    expect(src).toMatch(/isActionsSectionExpanded|setIsActionsSectionExpanded/);
    // SectionHeader "권장 액션" 옆 접기 토글 button + aria-expanded
    expect(src).toMatch(/label="권장 액션 \+ 추천 이유"[\s\S]{0,400}aria-expanded=\{isActionsSectionExpanded\}/);
  });
});

describe("§11.322 — canonical 보존 (§11.320 결정 + caller props)", () => {
  it("InventoryContextPanel props 시그니처 유지", () => {
    const src = read(PATH);
    expect(src).toMatch(/InventoryContextPanel/);
    expect(src).toMatch(/item:/);
  });

  it("§11.320 결정 보존 — 탭 0 / 상태 배너 testid / 액션 상단 / 접기 3섹션 (LOT/Flow/History)", () => {
    const src = read(PATH);
    // 탭 4 array 패턴 0 (§11.320 phase 2)
    expect(src).not.toMatch(/id:\s*"summary",\s*label:\s*"상태 요약"/);
    // 상태 배너 testid 보존
    expect(src).toMatch(/data-testid="inventory-context-status-banner"/);
    // 액션 button testid 보존
    expect(src).toMatch(/data-testid="inventory-context-primary-actions"/);
    // 접기 3 섹션 useState 보존 (§11.320 phase 3)
    expect(src).toMatch(/isLotSectionExpanded/);
    expect(src).toMatch(/isFlowSectionExpanded/);
    expect(src).toMatch(/isHistorySectionExpanded/);
  });

  it("권장 액션 + 추천 이유 섹션 자체 보존 (단지 접힘 추가)", () => {
    const src = read(PATH);
    expect(src).toMatch(/label="권장 액션 \+ 추천 이유"/);
    // visibleActions render 보존
    expect(src).toMatch(/visibleActions\.map/);
  });

  it("폐기 검토 분리 — disposal-strip + isExpiredLotWithQty 보존 (§11.320 결정)", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="labaxis-inventory-context-disposal-strip"/);
    expect(src).toMatch(/const isExpiredLotWithQty/);
  });
});

describe("§11.322 Phase 5 — 모바일 + sourcing-context-rail 회귀 0", () => {
  it("액션 button 모바일 min-h-[44px] 보존 (§11.320 Phase 5)", () => {
    const src = read(PATH);
    const actionMinHCount = (src.match(/min-h-\[44px\] md:min-h-0 md:h-8/g) || []).length;
    expect(actionMinHCount).toBeGreaterThanOrEqual(4);
  });

  it("sourcing-context-rail.tsx — 본 패널 변경 영향 0 (의존성 유지 0)", () => {
    const RAIL_PATH = "src/app/_workbench/_components/sourcing-context-rail.tsx";
    const railSrc = read(RAIL_PATH);
    expect(railSrc).not.toMatch(/const SEVERITY_STYLE:\s*Record/);
    expect(railSrc).not.toMatch(/function SectionHeader/);
  });
});
