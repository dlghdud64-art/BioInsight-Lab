/**
 * §quotes-mgmt-enhance §1a (호영님 견적 고도화 §1) — 카드 스텝퍼 경량화 sentinel.
 *
 * 진단: 5단계 스텝퍼 전 라벨 반복 + "공급사 응답 ●●●" 라인 = 시각 소음.
 * 수정: readiness strip = 현재 단계만 라벨 · 완료=emerald·현재=blue·이후=slate 점 ·
 *       공급사 응답 ●●● 타임라인 제거 · 우측 요약(발송 전 / 회신 N/M).
 *       canonical = quote.status/responseCount 파생(저장 0), §11.264g collapse 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"), "utf8");

describe("§quotes-mgmt-enhance §1a — 카드 스텝퍼 경량화", () => {
  it("점 스텝퍼 신호: 현재 blue·완료 emerald·이후 slate", () => {
    expect(PAGE).toMatch(/current \? "bg-blue-500 ring-2 ring-blue-200" : active \? "bg-emerald-500" : "bg-slate-200"/);
  });

  it("현재 단계 라벨만 노출(14px bold), 전체 라벨 반복 제거", () => {
    expect(PAGE).toMatch(/<span className="text-sm font-bold text-blue-700 whitespace-nowrap">\{READINESS_LABELS\[signals\.readinessStage\]\}<\/span>/);
  });

  it("우측 요약 — 발송 전 / 회신 N/M (canonical 파생)", () => {
    expect(PAGE).toMatch(/quote\.status === "PENDING" \? "발송 전" : `회신 \$\{responseCount\}\/\$\{quote\.vendorRequests\?\.length \?\? itemCount\}`/);
  });

  it("공급사 응답 ●●● 타임라인 제거(시각 소음)", () => {
    expect(PAGE).not.toMatch(/aria-label="공급사 응답 진행"/);
    expect(PAGE).not.toMatch(/발송 → 대기 → 수신/);
  });

  it("canonical 보존 — READINESS_LABELS·readinessStage 파생, §11.264g collapse 분기", () => {
    expect(PAGE).toMatch(/READINESS_LABELS\.map\(/);
    expect(PAGE).toMatch(/signals\.readinessStage/);
    expect(PAGE).toMatch(/aria-label="진행 단계"[\s\S]{0,120}|\$\{isExpanded \? "" : "hidden md:block"\}[\s\S]{0,120}aria-label="진행 단계"/);
  });
});
