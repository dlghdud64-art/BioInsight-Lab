/**
 * #quote-rationale-inventory-context Phase 1 — RED test (helper unit)
 *
 * Goal: §11.221/222 desktop + mobile 의 inline 6-case 인과관계 메시지 logic 을
 *       별도 helper 로 추출 + inventoryContext optional input 으로 tail append.
 *
 * canonical truth lock:
 *   - 6-case base 메시지 보존 (미발송 / SENT-회신0 / 부분회신 / 수집완료 / poReady / fallback).
 *   - inventoryContext.mostUrgent 가 있으면 tail append.
 *   - tail format: " ⏰ {productName} {daysRemaining}일 남음 / 예상 수령일 +{leadTimeDays}일"
 *   - inventoryContext 미전달 또는 mostUrgent === null 시 base 그대로 (graceful fallback).
 */

import { describe, it, expect } from "vitest";
import { buildBriefRationaleSummary } from "../../../lib/operational-brief/build-rationale";

describe("#quote-rationale-inventory-context Phase 1 — base 6-case (no inventory)", () => {
  it("미발송 → 📋 견적 미발송", () => {
    const result = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
    });
    // #operational-brief-emoji-sweep — 이모지 제거 후 텍스트 keyword 매칭.
    expect(result).toMatch(/견적 미발송 → 비교·발주 차단 중\. 발송이 첫 단계입니다\./);
    expect(result).not.toMatch(/📋|📤|📥|📊|✅|⚠️|⏰/);
  });

  it("SENT + 회신 0 → 📤 발송 완료", () => {
    const result = buildBriefRationaleSummary({
      blocker: "응답 대기",
      status: "회신 수집 중",
      replyCount: 0,
      totalItems: 1,
      isSent: true,
    });
    expect(result).toMatch(/발송 완료 → 회신 대기 중/);
  });

  it("부분 회신 → 📥 회신 N/M", () => {
    const result = buildBriefRationaleSummary({
      replyCount: 1,
      totalItems: 3,
      isSent: true,
    });
    expect(result).toMatch(/회신 1\/3/);
  });

  it("수집 완료 → 📊 회신 수집 완료", () => {
    const result = buildBriefRationaleSummary({
      replyCount: 3,
      totalItems: 3,
      compareReady: "가능",
      isSent: true,
    });
    expect(result).toMatch(/회신 수집 완료 → 비교 검토 가능/);
  });

  it("poReady → ✅ 비교 완료", () => {
    // poReady 매칭 case: 다른 case (미발송/SENT-회신0/부분/수집완료) 모두 미충족.
    // realistic 시나리오: isSent=false + poReady="가능" (선택안 확정 후 발주 대기).
    const result = buildBriefRationaleSummary({
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      // blocker 없음 + status 없음 → case 1 통과
      blocker: "차단 없음",
      poReady: "가능",
    });
    expect(result).toMatch(/비교 완료 → 발주 전환 가능/);
  });

  it("fallback (모든 case 미충족)", () => {
    const result = buildBriefRationaleSummary({
      replyCount: 0,
      totalItems: 0,
      isSent: false,
      nextAction: "확인 필요",
    });
    expect(result).toMatch(/다음 단계: 확인 필요/);
  });
});

describe("#quote-rationale-inventory-context Phase 1 — inventoryContext tail append", () => {
  it("mostUrgent 가 있으면 tail append (low-stock + leadTime)", () => {
    const result = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      inventoryContext: {
        mostUrgent: {
          productName: "FBS",
          daysRemaining: 5,
          isLowStock: true,
          leadTimeDays: 5,
        },
      },
    });
    expect(result).toMatch(/견적 미발송[\s\S]*?FBS[\s\S]*?5일 남음/);
    expect(result).not.toMatch(/📋|⏰/);
    expect(result).toMatch(/예상 수령일 \+5일|예상 수령 \+5일/);
  });

  it("mostUrgent === null → base 메시지 그대로 (fallback)", () => {
    const result = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      inventoryContext: { mostUrgent: null },
    });
    expect(result).toMatch(/견적 미발송/);
    expect(result).not.toMatch(/📋|⏰/);
  });

  it("inventoryContext 미전달 → base 그대로", () => {
    const result = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
    });
    expect(result).not.toMatch(/⏰/);
  });

  it("daysRemaining 없으면 leadTime 만 표시", () => {
    const result = buildBriefRationaleSummary({
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      inventoryContext: {
        mostUrgent: {
          productName: "PBS",
          isLowStock: true,
          leadTimeDays: 7,
          // daysRemaining undefined
        },
      },
    });
    expect(result).toMatch(/PBS/);
    expect(result).toMatch(/\+7일/);
    expect(result).not.toMatch(/⏰/);
  });

  it("isLowStock === false 이고 daysRemaining 도 없으면 tail 없음", () => {
    const result = buildBriefRationaleSummary({
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      inventoryContext: {
        mostUrgent: {
          productName: "DMSO",
          isLowStock: false,
          leadTimeDays: 3,
        },
      },
    });
    // isLowStock false + daysRemaining undefined → tail 노출 안 함 (의미 약함).
    expect(result).not.toMatch(/⏰/);
  });
});
