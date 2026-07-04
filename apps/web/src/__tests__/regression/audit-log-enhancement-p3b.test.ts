/**
 * §audit-log-enhancement P3b (호영님 2026-07-04) — 감사 테이블→타임라인(목업 정합).
 * 시각(KST)+액션배지+대상+변경칩(전→후)+작업자·IP+시스템자동+실패 하이라이트. §11.345 확장상세 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const P = readFileSync(join(__dirname, "..", "..", "app/dashboard/audit/page.tsx"), "utf8");
const CODE = P.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§audit-log-enhancement P3b — 감사 타임라인", () => {
  it("타임라인 컨테이너 + 옛 720px 테이블 제거", () => {
    expect(CODE).toMatch(/data-testid="audit-timeline"/);
    expect(CODE).not.toMatch(/Table className="min-w-\[720px\]"/);
  });
  it("시각(KST) + 시스템 자동 배지 + 변경칩(전→후)", () => {
    expect(CODE).toMatch(/KST/);
    expect(CODE).toMatch(/시스템 자동/);
    expect(CODE).toMatch(/log\.before/);
    expect(CODE).toMatch(/log\.after/);
  });
  it("실패 하이라이트(빨강) + §11.345 확장상세·append-only 보존", () => {
    expect(CODE).toMatch(/isFail \? "bg-red-50"/);
    expect(CODE).toMatch(/data-testid="audit-row-detail"/);
    expect(CODE).toMatch(/append-only/);
  });
  it("이스케이프 리터럴(\\\\u2192 등) 잔재 0 — 실제 문자", () => {
    expect(P).not.toMatch(/\\\\u2192|\\\\u00b7/);
  });
});

describe("§audit-log-enhancement P3b — 날짜 네비 + 카테고리 칩 + 활동 KPI 제거", () => {
  it("날짜 네비게이터 + 카테고리 칩 + 하루 파생(shownRows)", () => {
    expect(CODE).toMatch(/data-testid="audit-day-nav"/);
    expect(CODE).toMatch(/data-testid="audit-cat-chips"/);
    expect(CODE).toMatch(/shownRows\.map/);
    expect(CODE).toMatch(/auditCategory/);
  });
  it("6개 카테고리(전체/생성/수정/삭제/권한·보안/실패만)", () => {
    for (const l of ["전체", "생성", "수정", "삭제", "권한·보안", "실패만"]) {
      expect(P).toContain(l);
    }
  });
  it("활동 뷰 옛 KPI 3카드(시스템 활동/AI 처리/경고) 제거 — 시안 정합", () => {
    expect(CODE).not.toMatch(/log-activity-kpi-grid/);
    expect(P).not.toMatch(/text-slate-500 break-keep">시스템 활동/);
  });
  it("타임라인 좌측 시각 = hm(HH:MM), 확장상세 = 전체 time(KST)", () => {
    expect(CODE).toMatch(/leading-none">\{log\.hm\}/);
    expect(CODE).toMatch(/label="일시 \(KST\)" value=\{log\.time\}/);
  });
});
