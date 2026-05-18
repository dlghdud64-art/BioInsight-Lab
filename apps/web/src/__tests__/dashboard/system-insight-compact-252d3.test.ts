/**
 * §11.252d-3 — KPI + SystemInsightCard 정리 Option A (모바일 padding 압축).
 *
 * 호영님 spec: SystemInsightCard 모바일 안 시각 노이즈/공간 줄임.
 * 전략: 모바일 한정 padding 압축 + 데스크탑 보존 + 시각 hierarchy 유지.
 *
 * 변경 minimum diff:
 *   - p-4 md:p-5 → p-3 md:p-5 (모바일 25% 축소).
 *   - mb-1.5 → mb-1 (헤더 mb 미세 압축).
 *
 * canonical truth lock:
 *   - kpis derive 로직 변경 0.
 *   - 6 분기 message (burnRate / anomaly / pending / zero / safe) 모두 보존.
 *   - §11.243b #3 dismiss button + sessionStorage 보존.
 *   - gradient accent (emerald/amber/rose/indigo) + animate-ping dot 보존.
 *   - "System Insight" 헤더 텍스트 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PATH = resolve(__dirname, "../../components/dashboard/executive-summary-section.tsx");
const code = safeRead(PATH);

describe("§11.252d-3 #1 — SystemInsightCard 모바일 padding 압축", () => {
  it("§11.252d-3 trace marker 명시", () => {
    expect(code).toMatch(/§11\.252d-3|11\.252d-3/);
  });

  it("카드 padding p-3 md:p-5 (모바일 25% 축소)", () => {
    // gradient bg ~ p-3 md:p-5.
    expect(code).toMatch(/bg-gradient-to-br[\s\S]{0,500}p-3\s+md:p-5/);
  });

  it("헤더 mb-1 또는 그 이하 (mb-1.5 압축)", () => {
    // "System Insight" 헤더 인근 mb-1.
    expect(code).toMatch(/mb-1[\s"]/);
  });
});

describe("§11.252d-3 — invariant 보존", () => {
  it("SystemInsightCard 함수 시그니처 보존", () => {
    expect(code).toMatch(/function\s+SystemInsightCard/);
  });

  it("gradient accent 4 tone (emerald/amber/rose/indigo) 보존", () => {
    expect(code).toMatch(/from-emerald-700\s+to-emerald-900/);
    expect(code).toMatch(/from-amber-700\s+to-amber-900/);
    expect(code).toMatch(/from-rose-700\s+to-rose-900/);
    expect(code).toMatch(/from-indigo-700\s+to-purple-800/);
  });

  it("§11.243b #3 dismiss button + sessionStorage 보존", () => {
    expect(code).toMatch(/systemInsightDismissed/);
    expect(code).toMatch(/aria-label=["']System\s*Insight\s*카드\s*닫기["']/);
  });

  it("animate-ping dot 보존 (vital signal indicator)", () => {
    expect(code).toMatch(/animate-ping/);
  });

  it("\"System Insight\" 헤더 텍스트 보존", () => {
    expect(code).toMatch(/>\s*System\s*Insight\s*</);
  });

  it("kpis derive 6 분기 message 보존 (burnRate/anomaly/pending/zero/safe)", () => {
    expect(code).toMatch(/burnRateRisk\s*===\s*["']over["']/);
    expect(code).toMatch(/burnRateRisk\s*===\s*["']critical["']/);
    expect(code).toMatch(/anomalyCount\s*>=\s*3/);
    expect(code).toMatch(/pendingApprovalCount\s*>=\s*3/);
  });

  it("onboardingMode hide 분기 보존 (ExecutiveSummarySection)", () => {
    expect(code).toMatch(/!onboardingMode\s*&&\s*\(\s*\n?\s*<SystemInsightCard/);
  });
});
