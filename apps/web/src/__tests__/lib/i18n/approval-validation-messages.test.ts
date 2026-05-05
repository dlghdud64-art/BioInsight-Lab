/**
 * #approver-routing-validation-error-i18n — RED→GREEN test
 *
 * lib/i18n/approval-validation-messages.ts — approval cluster validation
 * message i18n helper. ko (default) + en (fallback). 향후 일본어 등 확장
 * 시 본 helper 만 변경.
 *
 * caller 가 getApprovalValidationMessage(key, lang?) 호출 시 단일 source
 * (단일 truth) — drift 차단 lock.
 */

import { describe, it, expect } from "vitest";
import {
  getApprovalValidationMessage,
  type ApprovalValidationMessageKey,
  type ApprovalValidationLocale,
} from "@/lib/i18n/approval-validation-messages";

describe("#approver-routing-validation-error-i18n — getApprovalValidationMessage", () => {
  it("INVALID_THRESHOLD_ORDER ko (default)", () => {
    const msg = getApprovalValidationMessage("INVALID_THRESHOLD_ORDER");
    expect(msg).toContain("저액");
    expect(msg).toContain("고액");
    expect(msg).toContain("이하");
  });

  it("INVALID_THRESHOLD_ORDER en", () => {
    const msg = getApprovalValidationMessage("INVALID_THRESHOLD_ORDER", "en");
    expect(msg.toLowerCase()).toContain("low");
    expect(msg.toLowerCase()).toContain("high");
  });

  it("APPROVAL_LIMIT_EXCEEDED ko / en 매핑", () => {
    expect(getApprovalValidationMessage("APPROVAL_LIMIT_EXCEEDED")).toContain("한도");
    expect(getApprovalValidationMessage("APPROVAL_LIMIT_EXCEEDED", "en").toLowerCase()).toContain("limit");
  });

  it("APPROVER_NOT_FOUND ko / en", () => {
    expect(getApprovalValidationMessage("APPROVER_NOT_FOUND")).toContain("결재자");
    expect(getApprovalValidationMessage("APPROVER_NOT_FOUND", "en").toLowerCase()).toContain("approver");
  });

  it("APPROVAL_POLICY_NOT_ENABLED ko / en", () => {
    expect(getApprovalValidationMessage("APPROVAL_POLICY_NOT_ENABLED")).toContain("결재");
    expect(getApprovalValidationMessage("APPROVAL_POLICY_NOT_ENABLED", "en").toLowerCase()).toContain("policy");
  });

  it("unknown locale → ko fallback (default)", () => {
    const msg = getApprovalValidationMessage(
      "INVALID_THRESHOLD_ORDER",
      "ja" as ApprovalValidationLocale,
    );
    // ja 미지원 → ko default fallback
    expect(msg).toContain("저액");
  });
});

describe("#approver-routing-validation-error-i18n — type exports", () => {
  it("ApprovalValidationMessageKey + ApprovalValidationLocale type 확인 (compile-time)", () => {
    // type-level — runtime 검증 필요 없음. import 가 성공하면 OK.
    const key: ApprovalValidationMessageKey = "INVALID_THRESHOLD_ORDER";
    const lang: ApprovalValidationLocale = "ko";
    expect(key).toBe("INVALID_THRESHOLD_ORDER");
    expect(lang).toBe("ko");
  });
});
