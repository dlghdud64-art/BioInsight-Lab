/**
 * §설정-고도화 §4 (호영님 2026-07-04) — 청구·구독: 플랜 특전 칩 + 결제 수단 카드(dead-button 정합).
 * §4.1 추상 플랜명 아래 실제 제공 가치 4칩 · §4.2 결제 수단 canonical 카드(정직 empty) · §4.3 등록 모달 배선.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("§설정-고도화 §4 — 특전칩 + 결제수단 카드", () => {
  it("§4.1 플랜 포함 특전 칩 4종", () => {
    expect(PAGE).toMatch(/견적·구매 무제한/);
    expect(PAGE).toMatch(/LOT·GMP 추적/);
    expect(PAGE).toMatch(/승인자 매트릭스/);
    expect(PAGE).toMatch(/감사 로그 내보내기/);
  });
  it("§4.2 결제 수단 카드(CreditCard) + 정직 empty(자동 결제 수단 없음)", () => {
    expect(PAGE).toMatch(/title="결제 수단" icon=\{CreditCard\}/);
    expect(PAGE).toMatch(/등록된 자동 결제 수단이 없습니다/);
  });
  it("§4.3 등록 CTA → 모달 배선(dead-button 아님)", () => {
    expect(PAGE).toMatch(/DialogTitle[^>]*>결제 수단 등록/);
  });
});
