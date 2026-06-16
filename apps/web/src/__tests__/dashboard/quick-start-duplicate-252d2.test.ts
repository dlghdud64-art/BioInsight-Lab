/**
 * §11.252d-2 — 품목 등록 중복 제거 (빠른 시작 카드 vs OnboardingHero).
 *
 * 호영님 spec: 품목 등록 등 동일 액션이 두 영역에서 동시에 노출 → 한 곳만.
 *
 * 식별 중복:
 *   - OnboardingHero (line 564~): 3 step "품목 등록 → 견적 요청 → 비교 검토".
 *   - "빠른 시작" 카드 (line 902~, dashboardState === "zero"):
 *     "품목 등록 + 비교 시작 + 견적 요청 생성".
 *   → 같은 액션 (품목 등록 + 견적 요청) 중복.
 *
 * 해결: 빠른 시작 카드 render 조건 강화 — OnboardingHero 활성 시 hide.
 *   `dashboardState === "zero" && (!isOnboardingMode || onboardingDismissed)`.
 *
 * canonical truth lock:
 *   - dashboardState (zero/blocked/active) 분기 보존.
 *   - 빠른 시작 카드 3 link href 보존 (/dashboard/inventory, /app/compare, /dashboard/quotes).
 *   - OnboardingHero 3 step 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252d-2→shifan P-fid1 — 빠른시작/OnboardingHero 중복 부재-lock", () => {
  // §dashboard-shifan-fidelity P-fid1 — 원 의도: 빠른시작 카드 vs OnboardingHero 품목등록 중복 제거.
  //   둘 다 폐지(OnboardingHero=P2, 빠른시작 zero 분기=P-fid1 레거시 3상태 패널 360행 삭제) →
  //   중복 불가가 자연 충족. 파일 삭제 대신 둘 다 absent 강제(LabAxis retire 규율 — 되살아나면 중복 회귀 잡음).
  it("'빠른 시작' 카드 폐지(레거시 3상태 zero 분기 제거)", () => {
    expect(code).not.toMatch(/>\s*빠른\s*시작\s*</);
    expect(code).not.toMatch(/견적\s*요청\s*생성/);
  });
});

describe("§11.252d-2 — invariant 보존", () => {
  it("dashboardState 분기 (zero/blocked/active) 보존", () => {
    expect(code).toMatch(/dashboardState\s*===\s*["']zero["']/);
    expect(code).toMatch(/dashboardState\s*===\s*["']active["']/);
  });

  // §dashboard-shifan-fidelity P-fid1 — "빠른 시작 3 link" it 제거: 빠른시작 카드 폐지로
  //   해당 카드 안 link 자체 부재. 액션 도달성(품목/검색/견적)은 OperatorQuickActions +
  //   ActionInbox + NextStepBanner 가 흡수(각 sentinel 이 보호). 부재-lock 은 #1 describe 가 강제.

  // §dashboard-shifan-adopt P2 진화 — OnboardingHero 3-step 폐지(시안 채택)→ NextStepBanner.
  //   빠른시작 카드(위 assertions)는 유지 — hero 중복 제거 의도는 hero 자체 폐지로 자연 충족.
  it("OnboardingHero 3-step 폐지 → NextStepBanner 대체(빠른시작 중복 원천 제거)", () => {
    expect(code).not.toMatch(/onboardingSteps\.inventoryDone/);
    expect(code).toMatch(/<NextStepBanner/);
  });

  it("isOnboardingMode + onboardingDismissed state 보존 (§11.252d-1)", () => {
    expect(code).toMatch(/isOnboardingMode/);
    expect(code).toMatch(/onboardingDismissed/);
  });
});
