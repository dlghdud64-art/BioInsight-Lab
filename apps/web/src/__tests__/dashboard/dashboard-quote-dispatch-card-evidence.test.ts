/**
 * #dashboard-quote-dispatch-card-evidence
 *
 * §11.308d-2 (2026-05-28) 재설계 → §11.364 D-1 (호영님 P1, 2026-06-04) supersede.
 *   §11.308d-2: dashboard 카드 in-card 발송 시뮬레이션 제거 + 펼침 요약 + 워크벤치 진입.
 *   §11.364 D-1: 액션존↔네비존 역할 분리 — 운영 바로가기 = 순수 네비.
 *     견적 발송 카드의 expand 패널·in-card primary CTA·접기 전부 폐기,
 *     다른 3 카드와 동형 Link 로 강등. 발송 진입 동선은 카드 href 로 보존.
 *   canonical truth: 카드 = count display-only, 발송 truth = 워크벤치 소유.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUICK_ACTIONS_PATH = resolve(
  __dirname,
  "../../components/dashboard/operator-quick-actions.tsx",
);
const quickActions = readFileSync(QUICK_ACTIONS_PATH, "utf8");

describe("§11.364 D-1 — 견적 발송 카드 균질 네비 강등", () => {
  it("발송 진입 동선 보존 — 워크벤치 href (real route, dead-end 0)", () => {
    expect(quickActions).toMatch(
      /href:\s*"\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/,
    );
    expect(quickActions).toMatch(/견적 발송/);
  });

  it("in-card expand 패널 / summary / primary CTA / 접기 폐기", () => {
    expect(quickActions).not.toContain("dashboard-quote-dispatch-card");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-summary");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-primary-cta");
    expect(quickActions).not.toMatch(/견적 워크벤치 열기/);
    expect(quickActions).not.toMatch(/aria-label="견적 발송 카드 접기"/);
  });

  it("canonical truth — in-card 발송 플로우 시뮬레이션 부재 (워크벤치 소유)", () => {
    expect(quickActions).not.toContain("dashboard-quote-dispatch-state-matrix");
    expect(quickActions).not.toContain("dashboard-quote-dispatch-preview-tracking");
    expect(quickActions).not.toMatch(/canSendToSupplier/);
    expect(quickActions).not.toMatch(/quoteDispatchReadiness/);
  });

  it("count display-only 보존 (mutation 0)", () => {
    expect(quickActions).toMatch(/count display-only/);
    expect(quickActions).toMatch(/counts\?\s*\[action\.countKey\]|counts\[action\.countKey\]/);
  });
});
