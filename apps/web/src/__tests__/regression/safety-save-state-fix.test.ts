/**
 * §safety-save-state-fix — 안전 페이지 "서버 반영 실패" 오노출 버그 회귀 가드
 *
 * 버그(호영님 보고, bug-hunter 확정):
 *   - dashboard/safety/page.tsx 의 activeFrame PATCH effect 가 [activeFrame] 의존으로
 *     마운트 1회 + 서버 hydration(setActiveFrame) 시 다시 발사 → 사용자가 아무 동작도
 *     안 했는데 자동 PATCH 가 나가고, 실패 시 isPatchError 가 켜져 first-load 에
 *     "서버 반영 실패" 빨간 칩이 떴다(applied 0 / pending 0 모순 상태).
 *
 * 수정:
 *   1) PATCH effect 에 hydration 게이트(isLoading return) + 무변경/빈계정 default 차단.
 *   2) failure 칩을 isPatchError||isError 일 때만 렌더(정상 first-load 노이즈 제거).
 *
 * 방법: readFileSync + regex (격리 node 검증 → operator 실 vitest).
 * Out of scope: PATCH /api/user/preferences 실패의 서버측 근본(403 등) = 별도 트랙.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// __dirname = apps/web/src/__tests__/regression → up 3 = apps/web
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SAFETY_PATH = "src/app/dashboard/safety/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§safety-save-state-fix — 자동 PATCH 차단(mount/hydration echo)", () => {
  it("mount 무조건 PATCH 제거: [activeFrame] 단독 의존 effect 부재", () => {
    const src = read(SAFETY_PATH);
    // 기존 버그 패턴(단독 [activeFrame] deps)이 더는 없어야 함.
    expect(src).not.toMatch(/\}, \[activeFrame\]\);/);
  });

  it("PATCH effect 에 hydration 게이트(isLoading 시 차단) 존재", () => {
    const src = read(SAFETY_PATH);
    expect(src).toMatch(/if \(userPrefs\.isLoading\) return/);
  });

  it("무변경 / 빈계정 default 차단(serverFrame ?? default 비교 후 return)", () => {
    const src = read(SAFETY_PATH);
    expect(src).toMatch(/serverFrame \?\? "balanced_ops"/);
    expect(src).toMatch(/if \(activeFrame === \(serverFrame[\s\S]{0,40}\) return/);
  });

  it("실제 저장 경로(updateSafetyFilter)는 보존", () => {
    const src = read(SAFETY_PATH);
    expect(src).toMatch(/userPrefs\.updateSafetyFilter\(\{ activeFrame \}\)/);
  });
});

describe("§safety-save-state-fix — failure 칩 정상 first-load 미노출", () => {
  it("failure 칩은 isPatchError||isError 게이트 뒤에서만 렌더", () => {
    const src = read(SAFETY_PATH);
    expect(src).toMatch(
      /\(userPrefs\.isPatchError \|\| userPrefs\.isError\) &&[\s\S]{0,200}data-testid="safety-preferences-failure-reason"/,
    );
  });

  it("정상 상태 상시 slate '실패 사유 없음' 칩 노출 패턴 제거", () => {
    const src = read(SAFETY_PATH);
    // 기존: 칩이 항상 렌더되며 정상 시 slate 톤으로 "실패 사유 없음" 노출.
    //   조건부 렌더로 바뀌었으므로 무조건 노출 패턴(삼항 slate fallback className)이 없어야 함.
    expect(src).not.toMatch(
      /border-slate-200 bg-slate-50 text-slate-600"\s*\}`\}\s*>\s*\{safetySaveFailureReason\}/,
    );
  });
});
