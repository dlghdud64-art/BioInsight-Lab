/**
 * §quotes-mobile-refine P2 — deriveReminderTargets unit tests
 *
 * 지시문(4a) 규칙 검증: 대상 = 미회신 공급사만 · 회신 완료 제외 · D+N 경과일 실값 파생.
 * 정직성: createdAt 미상 → daysSince null(가짜 경과일 0) · email 미상 → 목록 유지 + sendable=false.
 */

import { describe, it, expect } from "vitest";
import {
  deriveReminderTargets,
  hasVendorReplied,
  toReminderVendorsPayload,
} from "../reminder-targets";

const NOW = new Date("2026-07-21T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("hasVendorReplied — replied 단일 술어", () => {
  it("respondedAt 존재 → replied", () => {
    expect(hasVendorReplied({ respondedAt: daysAgo(1), status: null })).toBe(true);
  });
  it("status RESPONDED → replied (respondedAt 없어도)", () => {
    expect(hasVendorReplied({ respondedAt: null, status: "RESPONDED" })).toBe(true);
  });
  it("둘 다 없으면 미회신", () => {
    expect(hasVendorReplied({ respondedAt: null, status: "SENT" })).toBe(false);
  });
});

describe("deriveReminderTargets — 미회신 필터", () => {
  it("회신 완료 공급사 제외, 미회신만 반환", () => {
    const out = deriveReminderTargets(
      [
        { vendorName: "시그마텍", vendorEmail: "a@sigma.co", respondedAt: daysAgo(1), createdAt: daysAgo(5) },
        { vendorName: "바이오원", vendorEmail: "b@bioone.kr", respondedAt: null, status: "SENT", createdAt: daysAgo(3) },
        { vendorName: "코닝", vendorEmail: "c@corning.com", respondedAt: null, status: "RESPONDED", createdAt: daysAgo(4) },
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("바이오원");
  });

  it("빈 입력 → []", () => {
    expect(deriveReminderTargets(undefined, NOW)).toEqual([]);
    expect(deriveReminderTargets([], NOW)).toEqual([]);
  });
});

describe("deriveReminderTargets — D+N 경과일", () => {
  it("createdAt 3일 전 → daysSince 3", () => {
    const out = deriveReminderTargets([{ vendorEmail: "x@v.co", createdAt: daysAgo(3) }], NOW);
    expect(out[0].daysSince).toBe(3);
  });
  it("부분 일수는 내림 (2.5일 → 2)", () => {
    const out = deriveReminderTargets([{ vendorEmail: "x@v.co", createdAt: daysAgo(2.5) }], NOW);
    expect(out[0].daysSince).toBe(2);
  });
  it("createdAt 미상 → null (가짜 경과일 0)", () => {
    const out = deriveReminderTargets([{ vendorEmail: "x@v.co", createdAt: null }], NOW);
    expect(out[0].daysSince).toBeNull();
  });
  it("createdAt 이 미래(시계 왜곡) → null", () => {
    const out = deriveReminderTargets([{ vendorEmail: "x@v.co", createdAt: daysAgo(-2) }], NOW);
    expect(out[0].daysSince).toBeNull();
  });
});

describe("deriveReminderTargets — 표시명·sendable 정직성", () => {
  it("vendorName 우선, 없으면 email 도메인, 둘 다 없으면 '공급사'", () => {
    const out = deriveReminderTargets(
      [
        { vendorName: "시그마텍", vendorEmail: "a@sigma.co" },
        { vendorName: null, vendorEmail: "b@bioone.kr" },
        { vendorName: null, vendorEmail: null },
      ],
      NOW,
    );
    expect(out.map((t) => t.name)).toEqual(["시그마텍", "bioone.kr", "공급사"]);
    expect(out.map((t) => t.initial)).toEqual(["시", "b", "공"]);
  });

  it("email 미상 대상은 목록 유지 + sendable=false (카운트 정직)", () => {
    const out = deriveReminderTargets([{ vendorName: "미상사", vendorEmail: null }], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].sendable).toBe(false);
    expect(out[0].email).toBeNull();
  });
});

describe("toReminderVendorsPayload — 발송 계약 정합", () => {
  it("sendable 만 {email,name} 으로 (기존 vendor-requests 계약)", () => {
    const out = toReminderVendorsPayload([
      { email: "a@v.co", name: "A", initial: "A", daysSince: 2, sendable: true },
      { email: null, name: "B", initial: "B", daysSince: null, sendable: false },
    ]);
    expect(out).toEqual([{ email: "a@v.co", name: "A" }]);
  });
});
