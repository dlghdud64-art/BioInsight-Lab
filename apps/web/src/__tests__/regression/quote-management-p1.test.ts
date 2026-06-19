/**
 * §quote-management P1 (PLAN_quote-management) — 파생 로직 + 설정값 분리
 *
 * 지시문 §03 가중합·§04 마감. 저장 금지(항상 계산). 빈 계정 무해(순수 함수).
 *   ★ 지시문 검증 예(71점)의 사유는 "회신 정체"로 표기됐으나, §03 argmax 규칙상
 *     urgency(40) > stall(20)이라 "마감임박"이 정확(지시문 예시 표기 오류). 규칙 우선.
 *   ★ s1/s3/s4 마감 미보유(B 채택) → null = "—"(validUntil 근사 대입 금지).
 */

import { describe, it, expect } from "vitest";
import {
  computePriority,
  computeDue,
  deriveStage,
  dDayLabel,
  daysUntil,
  type QuoteCase,
} from "@/lib/quote-management/derive";
import { PRIORITY_THRESHOLDS, PRIORITY_WEIGHTS } from "@/lib/quote-management/config";

const NOW = new Date("2026-06-19T00:00:00Z");

function base(p: Partial<QuoteCase> = {}): QuoteCase {
  return {
    id: "RFQ-test",
    name: "테스트 품목",
    stage: "s1",
    suppliers: [],
    amount: null,
    stock: "ok",
    sentDate: null,
    responseWindowDays: 7,
    sendByDate: null,
    decisionDueDate: null,
    ...p,
  };
}

describe("§quote-management P1 — computePriority 가중합", () => {
  it("검증 예: s2·D-1·회신2/5·발송6일·재고low = 71 high (argmax 마감임박)", () => {
    const c = base({
      stage: "s2",
      suppliers: [
        { name: "A", replied: true },
        { name: "B", replied: true },
        { name: "C", replied: false },
        { name: "D", replied: false },
        { name: "E", replied: false },
      ],
      amount: null,
      stock: "low",
      sentDate: "2026-06-13", // +7 = 06-20 = D-1, 발송 6일 경과
      responseWindowDays: 7,
    });
    const p = computePriority(c, NOW);
    expect(p.score).toBe(71); // 40(urgency) + 3(money null) + 20(stall) + 8(stock low)
    expect(p.level).toBe("high");
    expect(p.dd).toBe(1);
    expect(p.reason).toBe("마감임박"); // argmax = urgency 40 (지시문 예 "회신정체"는 표기 오류)
  });
  it("低 등급은 사유 null(생략)", () => {
    const c = base({ stage: "s5", amount: 500000 }); // dd null, money other=5 → score 8 < 28
    const p = computePriority(c, NOW);
    expect(p.level).toBe("low");
    expect(p.reason).toBeNull();
  });
  it("임계값 경계 — high ≥ 50 / mid ≥ 28", () => {
    expect(PRIORITY_THRESHOLDS.high).toBe(50);
    expect(PRIORITY_THRESHOLDS.mid).toBe(28);
  });
});

describe("§quote-management P1 — computeDue 단계별(근사 금지)", () => {
  it("s2 = sentDate + responseWindowDays(발송 모달 공유)", () => {
    expect(computeDue(base({ stage: "s2", sentDate: "2026-06-13", responseWindowDays: 7 }))).toBe("2026-06-20");
  });
  it("s1 sendByDate null → null = '—' (validUntil 근사 0)", () => {
    const c = base({ stage: "s1", sendByDate: null });
    expect(computeDue(c)).toBeNull();
    expect(dDayLabel(daysUntil(computeDue(c), NOW))).toBe("—");
  });
  it("s3/s4 decisionDueDate null → null, s5 null", () => {
    expect(computeDue(base({ stage: "s3", decisionDueDate: null }))).toBeNull();
    expect(computeDue(base({ stage: "s4", decisionDueDate: null }))).toBeNull();
    expect(computeDue(base({ stage: "s5" }))).toBeNull();
  });
});

describe("§quote-management P1 — deriveStage + dDayLabel", () => {
  it("QuoteStatus → stage, CANCELLED 등 퍼널 외 null", () => {
    expect(deriveStage("PENDING")).toBe("s1");
    expect(deriveStage("SENT")).toBe("s2");
    expect(deriveStage("RESPONDED")).toBe("s3");
    expect(deriveStage("PURCHASED")).toBe("s5");
    expect(deriveStage("CANCELLED")).toBeNull();
  });
  it("dDayLabel 표시 규칙", () => {
    expect(dDayLabel(null)).toBe("—");
    expect(dDayLabel(0)).toBe("D-day");
    expect(dDayLabel(2)).toBe("D-2");
    expect(dDayLabel(-3)).toBe("3일 지남");
  });
});

describe("§quote-management P1 — 설정값 분리(하드코딩 금지)", () => {
  it("가중치·임계값 = config 모듈(derive 가 참조)", () => {
    expect(PRIORITY_WEIGHTS.urgency.d1).toBe(40);
    expect(PRIORITY_WEIGHTS.stall.stalled).toBe(20);
    expect(PRIORITY_WEIGHTS.stock.low).toBe(8);
  });
});
