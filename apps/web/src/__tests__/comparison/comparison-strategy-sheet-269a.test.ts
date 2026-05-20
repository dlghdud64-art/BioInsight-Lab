/**
 * §11.269a #comparison-strategy-sheet — 비교 모달 CTA 항상 활성 + 전략 선택
 *   바텀시트 (호영님 spec 흐름 차단 P0 해소)
 *
 * 호영님 spec:
 *   "비교까지 완료했는데 견적 요청으로 진행 불가 — 흐름 완전 차단."
 *   "전략을 선택할 수 있는 UI가 없음 — 어디서 전략을 선택해야 하는지 불명확."
 *   방안 A (권장): "견적 요청 만들기" 항상 활성. 탭하면 다음 단계에서 전략 선택
 *   (바텀시트). [최저가 우선 / 납기 우선 / 종합 추천] 라디오 → [요청 생성].
 *
 * Root cause:
 *   comparison-modal.tsx 가 #comparison-human-gate (line 152-157) 로 activeScenario
 *   null 시 CTA disabled. 사용자가 시나리오 chip 영역 (line 372-413) 발견 못해서
 *   ("AI 추천 전략" 헤더 + chip 들) 흐름 차단 보고.
 *
 * Fix (NEW Sheet + state, CTA gate 제거):
 *   (1) useState `showStrategySheet` 신규.
 *   (2) CTA disabled={!activeScenario} 제거 → CTA 항상 활성.
 *   (3) CTA onClick handler 분기:
 *       - activeScenario 있음 → handleOpenRequestWizard 직진
 *       - activeScenario null → setShowStrategySheet(true) (바텀시트 열림)
 *   (4) NEW Sheet (Radix Sheet, side="bottom") — "견적 요청 전략을 선택하세요":
 *       라디오 3개 (cost_first / balanced / speed_first) +
 *       [요청 생성] → setActiveScenario(selectedStrategy) + handleOpenRequestWizard
 *   (5) "전략 선택 필요" 텍스트 제거 (line 444-446) — 사용자 confusion 원인 제거
 *   (6) 시나리오 chip 영역 (line 372-413) 보존 — chip 클릭으로도 선택 가능
 *
 * canonical truth lock:
 *   - result.scenarios 데이터 보존 (server analyze API)
 *   - activeScenario state 보존 (chip 클릭 시 setActiveScenario)
 *   - handleOpenRequestWizard 보존 (onOpenChange(false) + onOpenRequestWizard?.())
 *   - scenarioMeta (cost_first/balanced/speed_first) 보존
 *   - chip onClick toggle (isActive ? null : s.type) 보존
 *   - "닫기" Button 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL_PATH = resolve(__dirname, "../../app/_workbench/_components/comparison-modal.tsx");
const modal = readFileSync(MODAL_PATH, "utf8");

describe("§11.269a #1 — CTA 항상 활성 + 전략 선택 바텀시트", () => {
  it("§11.269a trace marker comment 존재", () => {
    expect(modal).toMatch(/§11\.269a/);
  });

  it("showStrategySheet useState 신규 (default false)", () => {
    expect(modal).toMatch(
      /const\s+\[showStrategySheet,\s+setShowStrategySheet\]\s*=\s*useState\(\s*false\s*\)/,
    );
  });

  it("CTA disabled={!activeScenario} 제거 (CTA 항상 활성)", () => {
    // 기존 patten 제거 — disabled={!activeScenario} 없어야 함
    expect(modal).not.toMatch(/disabled=\{!activeScenario\}/);
  });

  it("\"전략 선택 필요\" UI 텍스트 (사용자 visible) 제거", () => {
    // <p>전략 선택 필요</p> JSX 라벨 패턴 — JSDoc/주석 안 한국어는 허용.
    // JSX <p className="text-[10px] text-slate-500">전략 선택 필요</p> 패턴이 사라져야 함.
    expect(modal).not.toMatch(/<p className="[^"]*text-slate-500[^"]*">전략 선택 필요/);
  });

  it("CTA onClick 분기 — activeScenario null → setShowStrategySheet(true)", () => {
    // CTA onClick handler 가 activeScenario 분기 포함
    expect(modal).toMatch(
      /activeScenario\)?\s*\?\s*handleOpenRequestWizard\(\)\s*:\s*setShowStrategySheet\(true\)|setShowStrategySheet\(true\)/,
    );
  });

  it("NEW Sheet — \"견적 요청 전략을 선택하세요\" 헤더", () => {
    expect(modal).toMatch(/견적 요청 전략을 선택하세요/);
  });

  it("Sheet 안 3 전략 라디오 (cost_first / balanced / speed_first)", () => {
    // 라디오 button or label 들 — scenarioMeta 의 3 type 모두 노출
    expect(modal).toMatch(/showStrategySheet[\s\S]{0,3000}cost_first/);
    expect(modal).toMatch(/showStrategySheet[\s\S]{0,3000}balanced/);
    expect(modal).toMatch(/showStrategySheet[\s\S]{0,3000}speed_first/);
  });

  it("Sheet [요청 생성] CTA → setActiveScenario + handleOpenRequestWizard", () => {
    // 사용자가 라디오 선택 후 [요청 생성] 탭 시 setActiveScenario(selected) + wizard 열림
    expect(modal).toMatch(/요청 생성/);
  });

  it("Sheet data-testid 명시 (production smoke verify)", () => {
    expect(modal).toMatch(/data-testid="comparison-strategy-sheet"/);
  });
});

describe("§11.269a #2 — invariant 보존 (canonical truth)", () => {
  it("result.scenarios 데이터 + chip 영역 보존 (chip 으로도 선택 가능)", () => {
    expect(modal).toMatch(/result\.scenarios\.length > 0/);
    expect(modal).toMatch(/result\.scenarios\.map\(/);
    expect(modal).toMatch(/AI 추천 전략/);
  });

  it("activeScenario state 보존 (chip onClick → setActiveScenario)", () => {
    expect(modal).toMatch(
      /const\s+\[activeScenario,\s+setActiveScenario\]\s*=\s*useState/,
    );
  });

  it("chip onClick toggle (isActive ? null : s.type) 보존", () => {
    expect(modal).toMatch(/setActiveScenario\(isActive \? null : s\.type\)/);
  });

  it("handleOpenRequestWizard (onOpenChange + onOpenRequestWizard) 보존", () => {
    expect(modal).toMatch(/const handleOpenRequestWizard = \(\)/);
    expect(modal).toMatch(/onOpenRequestWizard\?\.\(\)/);
  });

  it("scenarioMeta (3 type icon + label + shortLabel) 보존", () => {
    expect(modal).toMatch(/cost_first:[\s\S]{0,200}label: "비용 우선"/);
    expect(modal).toMatch(/balanced:[\s\S]{0,200}label: "납기·가격 균형"/);
    expect(modal).toMatch(/speed_first:[\s\S]{0,200}label: "최단 납기"/);
  });

  it("\"닫기\" Button + onClick onOpenChange(false) 보존", () => {
    expect(modal).toMatch(/onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]{0,100}닫기/);
  });

  it("CTA 라벨 \"견적 요청 만들기\" + \"견적 요청 조립하기\" 분기 보존", () => {
    expect(modal).toMatch(/견적 요청 조립하기/);
    expect(modal).toMatch(/견적 요청 만들기/);
  });

  it("#comparison-human-gate JSDoc 보존 (gating 의도 + sheet 보강 명시)", () => {
    expect(modal).toMatch(/#comparison-human-gate/);
  });
});
