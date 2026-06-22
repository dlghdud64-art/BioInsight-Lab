/**
 * §11.284d #purchases-base-status-whitelist — 호영님 P1 Phase 1 잔여 #2.
 *
 * 호영님 보고: 구매 운영 목록이 견적 관리 복제본. 견적 단계 (sent /
 * collecting / comparing) item 도 표시됨.
 *
 * Fix: filteredItems base whitelist (STATUS_MAP key 5종 — review_required /
 * ready_for_po / hold / confirmed / expired) + empty state 메시지 spec 정합.
 *
 * Audit 결과 (Phase 1 잔여 5 항목):
 *   #2 status filter (이 fix) — 진짜 미반영
 *   #3 카드 본문 — §11.284c 이미 land
 *   #4 견적 상세 버튼 — "다음 단계로 이동" 이미 swap
 *   #6 영문 잔여 — 이미 한글화 (grep 0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

describe("§11.284d — 구매 운영 base status whitelist + empty state", () => {
  it("§11.284d trace marker + PURCHASE_STAGE_STATUSES 정의", () => {
    expect(PAGE).toMatch(/§11\.284d/);
    expect(PAGE).toMatch(/PURCHASE_STAGE_STATUSES/);
  });

  it("PURCHASE_STAGE_STATUSES = Object.keys(STATUS_MAP) (whitelist)", () => {
    expect(PAGE).toMatch(/PURCHASE_STAGE_STATUSES[\s\S]{0,100}Object\.keys\(STATUS_MAP\)/);
  });

  it("filteredItems base filter — .has(conversionStatus)", () => {
    expect(PAGE).toMatch(/PURCHASE_STAGE_STATUSES\.has\(i\.conversionStatus\)/);
  });

  // §11.334 supersede — 호영님 시안 결정으로 데이터 0건 빈상태는 얇은 텍스트
  //   카피 대신 온보딩(히어로+파이프라인+할 일)로 전환. 옛 §11.284d 카피("발주
  //   인계 대기 중인 건이 없습니다" / "견적 비교가 완료되면 여기에 표시")는
  //   의도적으로 제거됨 → 온보딩 컴포넌트 렌더로 정합. whitelist 로직(위 3개
  //   it)은 그대로 유효하므로 보존.
  it("§11.334 — 데이터 0건 빈상태는 온보딩(PurchasesOnboarding)으로 전환", () => {
    expect(PAGE).toContain("PurchasesOnboarding");
    expect(PAGE).toMatch(/items\.length === 0 \?\s*\(\s*<PurchasesOnboarding/);
  });

  it("§11.334 — 검색/탭 무결과 얇은 안내는 보존(회귀 0)", () => {
    expect(PAGE).toMatch(/에 해당하는 항목이 없습니다/);
    expect(PAGE).toMatch(/선택한 탭에 항목이 없습니다/);
  });

  it("기존 queueTab + searchQuery filter 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/queueTab !== "all"/);
    expect(PAGE).toMatch(/searchQuery\.trim\(\)/);
  });
});
