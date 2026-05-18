/**
 * #comparison-human-gate — AI 비교 모달 자동 시나리오 선택 제거.
 *
 * 호영님 spec (Agent Board ai-auto-apply P0):
 *   - AI 분석 결과는 setResult(json.data)까지만.
 *   - activeScenario 는 항상 null 시작 (자동 set 0).
 *   - 사용자 클릭 시에만 setActiveScenario(s.type).
 *   - "AI 추천" 배지/점 표시는 active 와 무관하게 유지.
 *   - 다음 CTA ("견적 요청 조립하기/만들기") 는 activeScenario null 시 disabled
 *     + "전략 선택 필요" 사유 1줄.
 *   - "자동 선택", "자동 적용", "자동 전송", "자동 확정" 주석/문구 제거.
 *
 * canonical truth lock:
 *   - useState<string | null>(null) 초기값 보존.
 *   - 사용자 클릭 setActiveScenario(isActive ? null : s.type) 보존 (toggle).
 *   - reset 경로 (refresh / close) 의 setActiveScenario(null) 보존.
 *   - fetchAnalysis 의 setResult(json.data) 보존.
 *   - AI 추천 배지 (s.isRecommended) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MODAL_PATH = resolve(__dirname, "../../app/_workbench/_components/comparison-modal.tsx");
const code = safeRead(MODAL_PATH);

describe("#comparison-human-gate #1 — 자동 선택 제거", () => {
  it("trace marker — comparison-human-gate 또는 ai-auto-apply", () => {
    expect(code).toMatch(/comparison-human-gate|ai-auto-apply/);
  });

  it("'추천 시나리오 자동 선택' 주석 제거", () => {
    expect(code).not.toMatch(/추천\s*시나리오\s*자동\s*선택/);
  });

  it("fetchAnalysis 안 setActiveScenario(rec?.type) 패턴 제거", () => {
    // setActiveScenario(rec?.type ?? null) 같은 자동 set 호출 금지.
    expect(code).not.toMatch(/setActiveScenario\s*\(\s*rec(\.|\?\.)\s*type/);
  });

  it("'자동 선택|자동 적용|자동 전송|자동 확정' 문구 모두 제거", () => {
    expect(code).not.toMatch(/자동\s*선택|자동\s*적용|자동\s*전송|자동\s*확정/);
  });
});

describe("#comparison-human-gate #2 — CTA gating (activeScenario 필수)", () => {
  it("'견적 요청' CTA 가 activeScenario 없으면 disabled (disabled={!activeScenario} 또는 동치 분기)", () => {
    // disabled={!activeScenario} 또는 disabled={activeScenario == null} 또는 동치.
    expect(code).toMatch(/disabled=\{!activeScenario\}|disabled=\{activeScenario\s*==\s*null\}|disabled=\{activeScenario\s*===\s*null\}/);
  });

  it("'전략 선택 필요' 안내 라벨 1줄 (activeScenario null 시)", () => {
    expect(code).toMatch(/전략\s*선택\s*필요|시나리오\s*선택\s*필요/);
  });
});

describe("#comparison-human-gate — invariant 보존", () => {
  it("useState<string | null>(null) 초기값 보존 (자동 set 의 source 보호)", () => {
    expect(code).toMatch(/useState<string\s*\|\s*null>\(null\)/);
  });

  it("사용자 클릭 onClick={() => setActiveScenario(isActive ? null : s.type)} 보존 (toggle)", () => {
    expect(code).toMatch(/onClick=\{[^}]*setActiveScenario\(isActive\s*\?\s*null\s*:\s*s\.type\)/);
  });

  it("fetchAnalysis 의 setResult(json.data) 보존 (분석 결과 반영)", () => {
    expect(code).toMatch(/setResult\(json\.data\)/);
  });

  it("AI 추천 배지 (s.isRecommended) 보존", () => {
    expect(code).toMatch(/s\.isRecommended/);
  });

  it("refresh/close reset 경로의 setActiveScenario(null) 최소 2회 보존", () => {
    const matches = code.match(/setActiveScenario\(null\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("'견적 요청 조립하기' + '견적 요청 만들기' (모바일 축약) 보존", () => {
    expect(code).toMatch(/견적\s*요청\s*조립하기/);
    expect(code).toMatch(/견적\s*요청\s*만들기/);
  });
});
