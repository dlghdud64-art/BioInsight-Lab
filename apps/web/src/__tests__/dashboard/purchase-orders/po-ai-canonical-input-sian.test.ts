/**
 * §11.392 #po-ai-canonical-input-sian
 *
 * 발주 관리 page.tsx 의 AiAnalysisPanel 이 AI 예산이상/안전 분석에
 * 하드코딩 입력이 아니라 canonical(실 PO 금액·실 예산·실 품목명)을
 * 넘기는지 보장하는 honesty RED guard (source-regex).
 *
 * 검증 범위:
 *   1. 하드코딩 리터럴 전부 제거 (350000 / 50000000 / 28000000 /
 *      "연구비" budgetName / "2026년 상반기" budgetPeriod / category:"REAGENT").
 *   2. 실 fetch 사용 — PO 상세(/api/orders/) + 예산(/api/user-budgets) 조회.
 *   3. canonical 입력 전달 — orderAmount/budgetTotal/budgetCurrent 가
 *      실 데이터(totalAmount/usedAmount)에서 유래.
 *   4. canonical 부재 정직 표기 — 예산 미등록 문구 존재 + budget-anomaly
 *      조건부 호출(canRunBudget) gate.
 *   5. 회귀 0 — runAnalysis / budgetResult·safetyResult state /
 *      budget-anomaly·safety-check 두 엔드포인트 호출 / 결과 카드 렌더 보존.
 *
 * Source-level guards only (readFileSync + regex). DB / mount 없음.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = "src/app/dashboard/purchase-orders/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.392 — PO AI 분석 canonical 입력 (honesty)", () => {
  const src = read(PAGE);

  it("하드코딩 입력 리터럴 전부 제거", () => {
    expect(src).not.toMatch(/orderAmount:\s*350000/);
    expect(src).not.toMatch(/budgetTotal:\s*50000000/);
    expect(src).not.toMatch(/budgetCurrent:\s*28000000/);
    expect(src).not.toMatch(/budgetName:\s*"연구비"/);
    expect(src).not.toMatch(/budgetPeriod:\s*"2026년 상반기"/);
    expect(src).not.toContain('category: "REAGENT"');
  });

  it("실 PO 상세 + 실 예산 fetch 사용", () => {
    // PO 상세 — 실 발주 금액/품목명 source.
    expect(src).toMatch(/csrfFetch\(`\/api\/orders\/\$\{item\.entityId\}`\)/);
    // 워크스페이스 예산 — 실 budgetTotal/budgetCurrent source.
    expect(src).toMatch(/csrfFetch\("\/api\/user-budgets"\)/);
  });

  it("canonical 입력 전달 — 실 금액/예산/품목명", () => {
    // orderAmount = 실 PO totalAmount
    expect(src).toMatch(/const orderAmount = poDetail\?\.totalAmount/);
    // budgetTotal = 실 예산 totalAmount, budgetCurrent = 실 usedAmount
    expect(src).toMatch(/const budgetTotal = activeBudget\?\.totalAmount/);
    expect(src).toMatch(/const budgetCurrent = activeBudget\?\.usedAmount/);
    // 요청 body 가 실 변수 사용 (literal 아님)
    expect(src).toMatch(/orderAmount,/);
    expect(src).toMatch(/budgetTotal,/);
    expect(src).toMatch(/budgetCurrent,/);
  });

  it("canonical 부재 시 정직 표기 + 호출 gate", () => {
    // 예산 미등록 문구
    expect(src).toContain(
      "예산 정보가 없어 분석할 수 없습니다 · 예산을 먼저 등록하세요",
    );
    // budget-anomaly 는 canRunBudget 일 때만 호출 (하드코딩 예산 호출 금지)
    expect(src).toMatch(/canRunBudget\s*=\s*budgetTotal > 0 && orderAmount > 0/);
    expect(src).toMatch(/canRunBudget\s*\?\s*csrfFetch\("\/api\/ai\/budget-anomaly"/);
    expect(src).toMatch(/setBudgetNotice/);
  });

  it("회귀 0 — runAnalysis / state / 두 엔드포인트 / 결과 카드 보존", () => {
    expect(src).toMatch(/const runAnalysis = useCallback/);
    expect(src).toMatch(/setBudgetResult\(/);
    expect(src).toMatch(/setSafetyResult\(/);
    expect(src).toContain("/api/ai/budget-anomaly");
    expect(src).toContain("/api/ai/safety-check");
    // 결과 카드 라벨 보존
    expect(src).toContain("Budget & Anomaly");
    expect(src).toContain("Safety & Compliance");
    // 두 패널 사용처 보존 (ActionableRow + 그 외 row)
    expect(src.match(/<AiAnalysisPanel item=\{item\} \/>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
