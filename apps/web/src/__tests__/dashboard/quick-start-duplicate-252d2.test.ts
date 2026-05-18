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

describe("§11.252d-2 #1 — 빠른 시작 카드 render 조건 강화", () => {
  it("§11.252d-2 trace marker 명시", () => {
    expect(code).toMatch(/§11\.252d-2|11\.252d-2/);
  });

  it("빠른 시작 카드 조건 — !isOnboardingMode 또는 onboardingDismissed 분기 추가", () => {
    // dashboardState === "zero" + (!isOnboardingMode || onboardingDismissed) 또는
    // (!isOnboardingMode || onboardingDismissed) + dashboardState === "zero".
    expect(code).toMatch(/dashboardState\s*===\s*["']zero["'][\s\S]{0,300}(!isOnboardingMode|onboardingDismissed)/);
  });

  it("'빠른 시작' 헤더 텍스트 보존", () => {
    expect(code).toMatch(/>\s*빠른\s*시작\s*</);
  });
});

describe("§11.252d-2 — invariant 보존", () => {
  it("dashboardState 분기 (zero/blocked/active) 보존", () => {
    expect(code).toMatch(/dashboardState\s*===\s*["']zero["']/);
    expect(code).toMatch(/dashboardState\s*===\s*["']active["']/);
  });

  it("빠른 시작 3 link href 보존", () => {
    // 두 token 모두 빠른 시작 카드 안 (line 902~924 인근) 존재 검증.
    expect(code).toMatch(/href:\s*["']\/dashboard\/inventory["']/);
    expect(code).toMatch(/href:\s*["']\/app\/compare["']/);
    expect(code).toMatch(/견적\s*요청\s*생성/);
  });

  it("OnboardingHero 3 step 보존 (품목 등록 / 견적 요청 / 비교 검토)", () => {
    // OnboardingHero 가 §11.252d-1 reuse — span 안 "품목 등록" / "견적 요청" / "비교 검토" 보존.
    expect(code).toMatch(/onboardingSteps\.inventoryDone/);
    expect(code).toMatch(/onboardingSteps\.quoteRequestDone/);
    expect(code).toMatch(/onboardingSteps\.compareDone/);
  });

  it("isOnboardingMode + onboardingDismissed state 보존 (§11.252d-1)", () => {
    expect(code).toMatch(/isOnboardingMode/);
    expect(code).toMatch(/onboardingDismissed/);
  });
});
