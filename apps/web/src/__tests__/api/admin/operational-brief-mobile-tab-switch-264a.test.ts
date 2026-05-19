/**
 * §11.264a #operational-brief-mobile-tab-switch — 모바일 운영 브리핑 바텀시트 탭 전환 버그 fix
 *
 * 호영님 spec (견적 모바일 #3-1 긴급): 4 탭 (상태 요약/회신 현황/리스크/발주 전환) 이
 * 클릭 시 아무 반응 없음 — onClick 핸들러 미연결 또는 탭 전환 컴포넌트 미구현.
 *
 * Root cause: chip onClick = scrollToBrief (scroll into view) — 탭이 아니라
 * anchor link 동작. 모든 4 section 이 항상 함께 표시 → 사용자가 탭 클릭해도
 * scroll 만 됨 (탭 인디케이터 없음, content 전환 없음).
 *
 * Fix (§11.264a):
 *   (1) activeTab state 추가 (useState<string>("summary"))
 *   (2) chip onClick: scrollToBrief → setActiveTab swap
 *   (3) 활성 chip 시각 (text-blue-700 border-b-2 border-blue-600)
 *   (4) 4 section render 분기 (activeTab === id 일 때만 display)
 *   (5) §11.183 chip scroll 정의 → §11.264a tab switch 으로 supersede 명시
 *
 * §11.142 lock 정합:
 *   - chip label / anchor ID / a11y (role=dialog, aria-modal, aria-label) 보존
 *   - 4 section (summary/facts/risks/next) 보존
 *   - props 시그니처 (open/onClose/objectLabel/chips/summary/facts/risks/next/primaryCta) 보존
 *   - Esc key + body scroll lock 보존
 *
 * canonical truth lock:
 *   - chips prop 으로 caller override 가능 (견적-specific label "회신 현황 / 발주 전환" 별도 cluster)
 *   - 컴포넌트 default chips ("상태 요약 / 핵심 근거 / 리스크 / 다음 조치") 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/operational-brief/mobile-bottom-sheet.tsx",
);
const source = readFileSync(PATH, "utf8");

describe("§11.264a #1 — 탭 전환 동작 (state + onClick swap)", () => {
  it("§11.264a trace marker comment 존재", () => {
    expect(source).toMatch(/§11\.264a/);
  });

  it("activeTab state 정의 (useState default 'summary')", () => {
    expect(source).toMatch(
      /const \[activeTab,\s*setActiveTab\]\s*=\s*useState[<(].*[)>]\(\s*["']summary["']\s*\)/,
    );
  });

  it("chip onClick: setActiveTab(c.id) — scrollToBrief 대체", () => {
    expect(source).toMatch(/onClick=\{\(\) => setActiveTab\(c\.id\)\}/);
  });

  it("scrollToBrief 함수 제거 또는 unused (탭 전환 시 scroll 불필요)", () => {
    // §11.264a — scrollToBrief 호출 없음 (탭 전환으로 supersede)
    expect(source).not.toMatch(/onClick=\{\(\) => scrollToBrief\(c\.id\)\}/);
  });

  it("활성 chip 시각 (text-blue-700 + border-blue-600, border-b-2 공통)", () => {
    // activeTab === c.id 일 때 active 시각 (text-blue-700 + border-blue-600)
    expect(source).toMatch(/activeTab === c\.id[\s\S]{0,200}text-blue-700/);
    expect(source).toMatch(/activeTab === c\.id[\s\S]{0,300}border-blue-600/);
    // border-b-2 는 활성/비활성 공통 (탭 indicator 위치 정합)
    expect(source).toMatch(/border-b-2/);
  });

  it("4 section render 분기 (activeTab === id 일 때만 display)", () => {
    expect(source).toMatch(/activeTab === ["']summary["']\s*&&\s*summary/);
    expect(source).toMatch(/activeTab === ["']facts["']\s*&&\s*facts/);
    expect(source).toMatch(/activeTab === ["']risks["']\s*&&\s*risks/);
    expect(source).toMatch(/activeTab === ["']next["']\s*&&\s*next/);
  });
});

describe("§11.264a #2 — invariant 보존 (§11.142 lock + §11.152)", () => {
  it("운영 브리핑 헤더 보존", () => {
    expect(source).toMatch(/운영 브리핑/);
  });

  it("4 default chip 라벨 보존 (상태 요약 / 핵심 근거 / 리스크 / 다음 조치)", () => {
    expect(source).toMatch(/상태 요약/);
    expect(source).toMatch(/핵심 근거/);
    expect(source).toMatch(/리스크/);
    expect(source).toMatch(/다음 조치/);
  });

  it("4 anchor IDs (mb-brief-summary/facts/risks/next) 보존", () => {
    expect(source).toMatch(/mb-brief-summary/);
    expect(source).toMatch(/mb-brief-facts/);
    expect(source).toMatch(/mb-brief-risks/);
    expect(source).toMatch(/mb-brief-next/);
  });

  it("a11y (role=dialog + aria-modal + aria-label) 보존", () => {
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal="true"/);
    expect(source).toMatch(/aria-label="운영 브리핑"/);
  });

  it("Esc key + body scroll lock 보존", () => {
    expect(source).toMatch(/Escape/);
    expect(source).toMatch(/document\.body\.style\.overflow/);
  });

  it("MobileOperationalBriefSheet props 시그니처 보존 (open/onClose/objectLabel/chips/summary/facts/risks/next/primaryCta)", () => {
    expect(source).toMatch(
      /open:\s*boolean;[\s\S]{0,80}onClose:\s*\(\)\s*=>\s*void;[\s\S]{0,80}objectLabel:\s*string;[\s\S]{0,80}chips\?:\s*MobileBriefChip\[\];[\s\S]{0,400}summary\?:\s*React\.ReactNode;[\s\S]{0,80}facts\?:\s*React\.ReactNode;[\s\S]{0,80}risks\?:\s*React\.ReactNode;[\s\S]{0,80}next\?:\s*React\.ReactNode;[\s\S]{0,80}primaryCta\?:/,
    );
  });

  it("DEFAULT_CHIPS 4 entry 보존 (summary/facts/risks/next)", () => {
    expect(source).toMatch(/id:\s*"summary"/);
    expect(source).toMatch(/id:\s*"facts"/);
    expect(source).toMatch(/id:\s*"risks"/);
    expect(source).toMatch(/id:\s*"next"/);
  });

  it("Primary CTA sticky bottom 보존 (조건부)", () => {
    expect(source).toMatch(/primaryCta && \(/);
    expect(source).toMatch(/primaryCta\.onClick/);
  });

  it("aria-pressed 또는 role=tab + aria-selected (탭 a11y)", () => {
    expect(source).toMatch(/aria-pressed=\{activeTab === c\.id\}|role="tab"[\s\S]{0,200}aria-selected=\{activeTab === c\.id\}/);
  });
});
