/**
 * §11.284a #purchases-kpi-label-relabel — 구매 운영 KPI 4 라벨 + 모바일 1줄
 *   요약 바 라벨 일괄 변경 (호영님 P0 spec, §11.284 cluster A 단계).
 *
 * 호영님 P0 spec (대화 메시지, 2026-05-23):
 *   "구매 운영 KPI 라벨이 견적 단계 텍스트 그대로 (검토/발주/확정/만료) —
 *    구매 운영 실제 단계 (발주 전환 대기 / 발주 승인 대기 / 발주 확정 /
 *    공급사 통보 완료) 으로 변경."
 *
 * Fix (minimum diff, 1 file ~10 spot swap):
 *   STATUS_MAP (line 99-104):
 *     review_required: "검토 필요" → "발주 전환 대기"
 *     ready_for_po:    "발주 가능" → "발주 승인 대기"
 *     confirmed:       "확정됨"   → "발주 확정"
 *
 *   데스크탑 KpiCard 4 spot (line 600-640):
 *     "검토 필요" → "발주 전환 대기"
 *     "발주 가능" → "발주 승인 대기"
 *     "확정됨"   → "발주 확정"
 *     "만료"     → "공급사 통보 완료"
 *
 *   모바일 KPI 1줄 요약 바 4 spot (line 573-577):
 *     "검토" → "전환대기"
 *     "발주" → "승인대기"
 *     "확정" 보존
 *     "만료" → "통보완료"
 *
 * canonical truth 보존:
 *   - stats 4 field (review_required / ready_for_po / confirmed / expired) source 보존
 *   - setQueueTab 분기 보존
 *   - 4 KpiCard icon + iconBg + sub 보존
 *   - 모바일 요약 바 onClick / aria-pressed / aria-label 패턴 보존
 *   - text color (blue-600 / emerald-600 / purple-600 / rose-600) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

describe("§11.284a — 구매 운영 KPI 라벨 데스크탑 4 spot", () => {
  it("§11.284a trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.284a/);
  });

  it("STATUS_MAP.review_required label \"발주 전환 대기\"", () => {
    expect(PAGE).toMatch(/review_required:\s*\{\s*label:\s*"발주 전환 대기"/);
  });

  it("STATUS_MAP.ready_for_po label \"발주 승인 대기\"", () => {
    expect(PAGE).toMatch(/ready_for_po:\s*\{\s*label:\s*"발주 승인 대기"/);
  });

  it("STATUS_MAP.confirmed label \"발주 확정\"", () => {
    expect(PAGE).toMatch(/confirmed:\s*\{\s*label:\s*"발주 확정"/);
  });

  it("데스크탑 KpiCard 4 label 명시 (발주 전환 대기 / 발주 승인 대기 / 발주 확정 / 공급사 통보 완료)", () => {
    expect(PAGE).toMatch(/label="발주 전환 대기"/);
    expect(PAGE).toMatch(/label="발주 승인 대기"/);
    expect(PAGE).toMatch(/label="발주 확정"/);
    expect(PAGE).toMatch(/label="공급사 통보 완료"/);
  });

  it("이전 데스크탑 라벨 (검토 필요 / 발주 가능 / 확정됨 / 만료) KpiCard 잔존 부재", () => {
    expect(PAGE).not.toMatch(/label="검토 필요"/);
    expect(PAGE).not.toMatch(/label="발주 가능"/);
    expect(PAGE).not.toMatch(/label="확정됨"/);
    expect(PAGE).not.toMatch(/label="만료"(?!\s*\w)/);
  });
});

describe("§11.284a — 모바일 KPI 1줄 요약 바 라벨", () => {
  it("모바일 짧은 라벨 4 spot (전환대기 / 승인대기 / 확정 / 통보완료)", () => {
    expect(PAGE).toMatch(/short:\s*"전환대기"/);
    expect(PAGE).toMatch(/short:\s*"승인대기"/);
    expect(PAGE).toMatch(/short:\s*"확정"/);
    expect(PAGE).toMatch(/short:\s*"통보완료"/);
  });

  it("이전 모바일 짧은 라벨 (검토 / 발주 / 만료) 잔존 부재", () => {
    expect(PAGE).not.toMatch(/short:\s*"검토"/);
    expect(PAGE).not.toMatch(/short:\s*"발주"\s*,/);
    expect(PAGE).not.toMatch(/short:\s*"만료"/);
  });
});

describe("§11.284a — invariant 보존 (canonical truth)", () => {
  it("stats 4 field source 보존 (review_required / ready_for_po / confirmed / expired)", () => {
    expect(PAGE).toMatch(/stats\.review_required/);
    expect(PAGE).toMatch(/stats\.ready_for_po/);
    expect(PAGE).toMatch(/stats\.confirmed/);
    expect(PAGE).toMatch(/stats\.expired/);
  });

  it("setQueueTab 분기 4 spot 보존", () => {
    const matches = PAGE.match(/setQueueTab\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it("4 KpiCard icon (ListChecks / CircleCheck / AlertCircle / Clock) 보존", () => {
    expect(PAGE).toMatch(/ListChecks/);
    expect(PAGE).toMatch(/CircleCheck/);
    expect(PAGE).toMatch(/AlertCircle/);
    expect(PAGE).toMatch(/<Clock /);
  });

  it("모바일 요약 바 testid 보존 (purchases-kpi-mobile-summary-bar)", () => {
    expect(PAGE).toMatch(/data-testid="purchases-kpi-mobile-summary-bar"/);
  });
});
