/**
 * §msds-version-validation P3 — classifyMsdsVersion 휴리스틱 단위 검증 (호영님 2026-06-27)
 *
 * 저장 메타 기반 분류(KOSHA 라이브 대조 아님): current / stale / unknown.
 */
import { describe, it, expect } from "vitest";
import {
  classifyMsdsVersion,
  summarizeMsdsVersions,
  MSDS_STALE_AFTER_MS,
} from "@/lib/safety/msds-version";

const NOW = new Date("2026-06-27T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe("§msds-version P3 — classifyMsdsVersion", () => {
  it("출처 없음(unknown): 개정일·버전 메타 전무", () => {
    expect(classifyMsdsVersion({}, NOW)).toBe("unknown");
    expect(classifyMsdsVersion({ issuedAt: null, docVersion: null }, NOW)).toBe("unknown");
  });

  it("최신본(current): 최근 개정일 + 미만료 + 미교체", () => {
    expect(classifyMsdsVersion({ issuedAt: daysAgo(30), docVersion: "1.2" }, NOW)).toBe("current");
    // 버전만 있어도(개정일 없어도) 메타 있음 → current
    expect(classifyMsdsVersion({ docVersion: "2.0" }, NOW)).toBe("current");
  });

  it("구버전 의심(stale): 교체됨", () => {
    expect(classifyMsdsVersion({ issuedAt: daysAgo(10), supersededAt: daysAgo(1) }, NOW)).toBe("stale");
  });

  it("구버전 의심(stale): 만료 경과", () => {
    expect(classifyMsdsVersion({ issuedAt: daysAgo(10), expiresAt: daysAgo(1) }, NOW)).toBe("stale");
  });

  it("구버전 의심(stale): 개정일 3년 초과", () => {
    const overThreeYears = new Date(NOW.getTime() - MSDS_STALE_AFTER_MS - 86400000).toISOString();
    expect(classifyMsdsVersion({ issuedAt: overThreeYears, docVersion: "0.9" }, NOW)).toBe("stale");
  });

  it("경계: 3년 직전은 current", () => {
    const justUnderThreeYears = new Date(NOW.getTime() - MSDS_STALE_AFTER_MS + 86400000).toISOString();
    expect(classifyMsdsVersion({ issuedAt: justUnderThreeYears }, NOW)).toBe("current");
  });
});

describe("§msds-version P3 — summarizeMsdsVersions (단일 카운트 소스)", () => {
  it("집계 합계 = total", () => {
    const docs = [
      {}, // unknown
      { issuedAt: daysAgo(5), docVersion: "1.0" }, // current
      { issuedAt: daysAgo(5), supersededAt: daysAgo(1) }, // stale
      { issuedAt: daysAgo(5), expiresAt: daysAgo(2) }, // stale
    ];
    const s = summarizeMsdsVersions(docs, NOW);
    expect(s).toEqual({ current: 1, stale: 2, unknown: 1, total: 4 });
    expect(s.current + s.stale + s.unknown).toBe(s.total);
  });

  it("빈 목록 = 0/0/0", () => {
    expect(summarizeMsdsVersions([], NOW)).toEqual({ current: 0, stale: 0, unknown: 0, total: 0 });
  });
});
