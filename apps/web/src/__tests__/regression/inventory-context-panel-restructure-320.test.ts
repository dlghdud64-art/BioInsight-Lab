/**
 * §11.320 #inventory-context-panel-restructure — Regression sentinel (Phase 1 RED)
 *
 * 호영님 P1 (구 §11.315, 번호 충돌로 §11.320 매핑, 2026-05-29):
 *   재고 상세 우측 패널이 9 섹션 세로 나열 + 정보 우선순위 부재 + 색상 체계 혼재 →
 *   상태 배너 1개로 통합 + 액션 상단 + 섹션 접기 + 색상 §11.302 정합.
 *
 *   본 sentinel = Phase 1 RED. Phase 2~4 작업으로 GREEN 전환:
 *   - Phase 2: 상태 배너 + 액션 상단 + 탭 제거
 *   - Phase 3: KPI 4 → 3 + 섹션 접기
 *   - Phase 4: 색상 통일 + 인터랙션 wiring
 *
 * canonical 보존 (Phase 5 가드):
 *   - caller 호출 시그니처 (InventoryContextPanel props) 변경 0
 *   - item 데이터 mutation 0
 *   - 폐기 검토 탭(작업 surface)과 분리 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/components/inventory/inventory-context-panel.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.320 — 상태 배너 통합 (Phase 2 GREEN target)", () => {
  it("상태 배너 testid 노출 — 단일 카드로 상황요약+리스크+권장액션 통합", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="inventory-context-status-banner"/);
  });

  it("배너 상태별 분기 3 case — 정상 emerald / 만료 임박 yellow / 위험 red", () => {
    const src = read(PATH);
    // 위험 = bg-red-50 + text-red-700
    expect(src).toMatch(/inventory-context-status-banner[\s\S]{0,800}bg-red-50/);
    // 정상 = bg-emerald-50 (또는 bg-green-50)
    expect(src).toMatch(/bg-emerald-50|bg-green-50/);
    // 주의 = bg-yellow-50
    expect(src).toMatch(/bg-yellow-50/);
  });

  it("탭 4 (상태 요약/보유량/리스크/재발주) 제거", () => {
    const src = read(PATH);
    // 옛 탭 array 4 id 모두 0
    expect(src).not.toMatch(/id:\s*"summary",\s*label:\s*"상태 요약"/);
    expect(src).not.toMatch(/id:\s*"facts",\s*label:\s*"보유량"/);
    expect(src).not.toMatch(/id:\s*"risks",\s*label:\s*"리스크"/);
    expect(src).not.toMatch(/id:\s*"next",\s*label:\s*"재발주"/);
  });
});

describe("§11.320 — 액션 button 상단 이동 (Phase 2 GREEN target)", () => {
  it("액션 button testid = 상태 배너 인근(상단), sticky footer 위치 제거", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="inventory-context-primary-actions"/);
    // sticky footer 옛 위치 단서(§ 4. 다음 조치) 제거
    expect(src).not.toMatch(/§\s*4\.\s*다음 조치/);
  });
});

describe("§11.320 — KPI 4 → 3 + '재고 현황' 라벨 (Phase 3 GREEN target)", () => {
  it("'핵심 근거' 라벨 제거 → '재고 현황' 으로 변경", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/SectionHeader[\s\S]{0,60}label="핵심 근거"/);
    expect(src).toMatch(/SectionHeader[\s\S]{0,60}label="재고 현황"/);
  });

  it("KPI 3 항목 (현재 / 안전재고 / 만료 임박) — 최단 LOT 제거", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="inventory-context-kpi-current"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-safety-stock"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-expiring-soon"/);
  });
});

describe("§11.320 — 섹션 접기 패턴 (Phase 3 GREEN target)", () => {
  it("LOT / 연결된 흐름 / 최근 수정 — useState 접기 default false", () => {
    const src = read(PATH);
    expect(src).toMatch(/isLotSectionExpanded|setIsLotSectionExpanded/);
    expect(src).toMatch(/isFlowSectionExpanded|setIsFlowSectionExpanded/);
    expect(src).toMatch(/isHistorySectionExpanded|setIsHistorySectionExpanded/);
  });
});

describe("§11.320 — 색상 §11.302 정합 (Phase 4 GREEN target)", () => {
  it("보라색 강조(text-purple)/빨간 테두리(border-red-300+)/회색 글씨 강조 사용 0 — 정보성은 slate/gray", () => {
    const src = read(PATH);
    // 보라색 강조 0
    expect(src).not.toMatch(/text-purple-700 font-bold/);
    // 빨간 테두리 강조 0 (border-red-300/400/500) — 위험은 bg-red-50 + text-red-700 으로 표현
    expect(src).not.toMatch(/border-red-300/);
    expect(src).not.toMatch(/border-red-400/);
  });
});

describe("§11.320 — 인터랙션 wiring (Phase 4 GREEN target)", () => {
  it("재주문 button → §11.303 재발주안 바텀시트 wiring (real action, onReorder prop 보존)", () => {
    const src = read(PATH);
    // Phase 4 GREEN: 실제 prop 이름 onReorder (또는 변형). caller(inventory-content:2725 /
    //   inventory-main:1958) 가 §11.303 재발주안 바텀시트 trigger 를 onReorder 핸들러 안에 wiring.
    expect(src).toMatch(/onReorder\?\.\(item\)|onReorder\(item\)|onReorder\?:\s*\(/);
  });

  it("상태 배너 onClick → operationalBriefPopup.open (풀 패널 진입)", () => {
    const src = read(PATH);
    expect(src).toMatch(/operationalBriefPopup\.open|useOperationalBriefPopup/);
  });
});

describe("§11.320 — canonical 보존 (caller props + item mutation 0)", () => {
  it("InventoryContextPanel props 시그니처 유지 (item / onClose / onEdit 등)", () => {
    const src = read(PATH);
    expect(src).toMatch(/InventoryContextPanel/);
    expect(src).toMatch(/item:/);
  });

  it("폐기 검토 탭 분리 정합 — 패널 안 폐기 mutation 0 (deep link 만)", () => {
    const src = read(PATH);
    // disposal 실제 mutation 함수 호출 0 (패널 = 알림/요약)
    expect(src).not.toMatch(/handleLotDisposal\(|executeDisposal\(/);
  });
});
