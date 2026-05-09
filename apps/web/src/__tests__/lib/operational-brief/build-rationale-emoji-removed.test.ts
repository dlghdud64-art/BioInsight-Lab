/**
 * #operational-brief-emoji-sweep — Phase 1 RED (Phase B-1)
 *
 * 호영님 redesign Phase B-1 — B2B 톤 정합 위한 이모지 제거.
 *
 * canonical truth lock:
 *   - buildBriefRationale 새 export (structured) — { message, case, tone, inventoryTail? }.
 *   - 6 case: not_sent / awaiting_reply / partial_reply / reply_complete / po_ready / fallback.
 *   - tone: slate / amber / blue / emerald / red.
 *   - message + inventoryTail.message 모두 emoji prefix 0 (텍스트만).
 *   - 기존 buildBriefRationaleSummary 도 emoji 제거 (backward compat — 메시지 의미 보존).
 *   - 6-case 매칭 로직 (status/blocker/replyCount 등) 그대로 보존.
 */

import { describe, it, expect } from "vitest";
import {
  buildBriefRationale,
  buildBriefRationaleSummary,
} from "../../../lib/operational-brief/build-rationale";

const EMOJI_REGEX = /[📋📤📥📊✅⚠️⏰]/;

describe("#operational-brief-emoji-sweep — message emoji 제거", () => {
  const cases: Array<[string, Parameters<typeof buildBriefRationale>[0], string]> = [
    [
      "not_sent",
      { blocker: "공급사 미전송", status: "요청 생성 완료", replyCount: 0, totalItems: 1, isSent: false },
      "not_sent",
    ],
    [
      "awaiting_reply",
      { blocker: "차단 없음", status: "회신 대기", replyCount: 0, totalItems: 1, isSent: true },
      "awaiting_reply",
    ],
    [
      "partial_reply",
      { blocker: "차단 없음", status: "회신 진행", replyCount: 1, totalItems: 3, isSent: true },
      "partial_reply",
    ],
    [
      "reply_complete",
      { blocker: "차단 없음", status: "비교 가능", replyCount: 3, totalItems: 3, compareReady: "가능", isSent: true },
      "reply_complete",
    ],
    [
      "po_ready",
      { blocker: "차단 없음", status: "발주 가능", replyCount: 3, totalItems: 3, poReady: "가능", isSent: true },
      "po_ready",
    ],
    [
      "fallback",
      { blocker: "차단 없음", status: null, nextAction: "다음 단계 결정", replyCount: 0, totalItems: 0, isSent: false },
      "fallback",
    ],
  ];

  for (const [name, input, expectedCase] of cases) {
    it(`case=${name}: 이모지 0 + case 키 정합`, () => {
      const result = buildBriefRationale(input);
      expect(result.message, `case=${name} message: ${result.message}`).not.toMatch(EMOJI_REGEX);
      expect(result.case).toBe(expectedCase);
      expect(result.tone).toBeDefined();
    });
  }

  it("inventoryTail 도 이모지 0", () => {
    const result = buildBriefRationale({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      inventoryContext: {
        mostUrgent: { productName: "FBS", daysRemaining: 5, isLowStock: true, leadTimeDays: 5 },
      },
    });
    expect(result.inventoryTail?.message).not.toMatch(EMOJI_REGEX);
    expect(result.inventoryTail?.productName).toBe("FBS");
  });
});

describe("#operational-brief-emoji-sweep — buildBriefRationaleSummary backward compat", () => {
  it("summary string 도 이모지 제거", () => {
    const summary = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
    });
    expect(summary).not.toMatch(EMOJI_REGEX);
  });

  it("summary 6-case 의미 보존 — 키워드 매칭", () => {
    const cases = [
      { input: { blocker: "공급사 미전송", status: "요청 생성", replyCount: 0, totalItems: 1, isSent: false }, kw: "발송" },
      { input: { blocker: "차단 없음", status: "회신 대기", replyCount: 0, totalItems: 1, isSent: true }, kw: "회신 대기" },
      { input: { blocker: "차단 없음", replyCount: 1, totalItems: 3, isSent: true }, kw: "회신" },
      { input: { blocker: "차단 없음", replyCount: 3, totalItems: 3, compareReady: "가능", isSent: true }, kw: "비교" },
      { input: { blocker: "차단 없음", replyCount: 3, totalItems: 3, poReady: "가능", isSent: true }, kw: "발주" },
    ];
    for (const c of cases) {
      const summary = buildBriefRationaleSummary(c.input);
      expect(summary, `summary=${summary}`).toContain(c.kw);
    }
  });

  it("inventory tail join 보존 (\\n separator)", () => {
    const summary = buildBriefRationaleSummary({
      blocker: "공급사 미전송",
      status: "요청 생성 완료",
      replyCount: 0,
      totalItems: 1,
      isSent: false,
      inventoryContext: {
        mostUrgent: { productName: "FBS", daysRemaining: 5, isLowStock: true, leadTimeDays: 5 },
      },
    });
    expect(summary).toContain("\n");
    expect(summary).toContain("FBS");
    expect(summary).not.toMatch(EMOJI_REGEX);
  });
});

describe("#operational-brief-emoji-sweep — tone matrix", () => {
  it("not_sent → slate (cold start)", () => {
    expect(buildBriefRationale({ blocker: "공급사 미전송", status: "요청 생성 완료", replyCount: 0, totalItems: 1, isSent: false }).tone).toBe("slate");
  });

  it("awaiting_reply → amber (대기)", () => {
    expect(buildBriefRationale({ blocker: "차단 없음", status: "회신 대기", replyCount: 0, totalItems: 1, isSent: true }).tone).toBe("amber");
  });

  it("partial_reply → blue (진행)", () => {
    expect(buildBriefRationale({ blocker: "차단 없음", replyCount: 1, totalItems: 3, isSent: true }).tone).toBe("blue");
  });

  it("reply_complete → blue (검토 가능)", () => {
    expect(buildBriefRationale({ blocker: "차단 없음", replyCount: 3, totalItems: 3, compareReady: "가능", isSent: true }).tone).toBe("blue");
  });

  it("po_ready → emerald (실행 가능)", () => {
    expect(buildBriefRationale({ blocker: "차단 없음", replyCount: 3, totalItems: 3, poReady: "가능", isSent: true }).tone).toBe("emerald");
  });

  it("fallback (blocker 있음) → red", () => {
    expect(buildBriefRationale({ blocker: "차단 있음 — 정보 누락", status: null, replyCount: 0, totalItems: 0, isSent: false, nextAction: "확인" }).tone).toBe("red");
  });
});
