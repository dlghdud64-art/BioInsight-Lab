// §quote-brief-rail-tabs-sian — 운영 브리핑 desktop rail 시안 1:1 탭 구조 sentinel.
//   호영님(CEO) 결정: "시안 1:1 엄격(단순화)". rail preset chips(scroll anchor) →
//   탭 전환(상태 요약 / 회신 현황 / 비교 진행 / 발주 전환). 활성 탭 콘텐츠만 표시.
//   readFileSync + regex source-level 검증 (CLAUDE.md Sentinel Test 패턴).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// __dirname = apps/web/src/__tests__/dashboard/quotes → apps/web = 4 up.
const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
const QUOTES_PAGE = "src/app/dashboard/quotes/page.tsx";

describe("§quote-brief-rail-tabs-sian — 운영 브리핑 rail 탭 구조", () => {
  it("탭 4개 라벨이 모두 존재 (상태 요약 / 회신 현황 / 비교 진행 / 발주 전환)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/상태 요약/);
    expect(src).toMatch(/회신 현황/);
    expect(src).toMatch(/비교 진행/);
    expect(src).toMatch(/발주 전환/);
  });

  it("탭 id 집합이 summary/reply/compare/order 로 구성", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/\{ id: "summary", label: "상태 요약" \}/);
    expect(src).toMatch(/\{ id: "reply",\s+label: "회신 현황" \}/);
    expect(src).toMatch(/\{ id: "compare", label: "비교 진행" \}/);
    expect(src).toMatch(/\{ id: "order",\s+label: "발주 전환" \}/);
  });

  it("탭 selector 가 role=tablist + setActiveChipId 만 호출 (scroll·setBriefDetailExpanded 제거)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/role="tablist"/);
    // 탭 onClick 안에서 setActiveChipId 호출 보존.
    expect(src).toMatch(/setActiveChipId\(c\.id\)/);
  });

  it("lead 줄 3종 문구가 모두 존재", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/첫 액션이 필요합니다/);
    expect(src).toMatch(/회신을 기다리는 중입니다/);
    expect(src).toMatch(/비교할 견적이 모였습니다/);
  });

  it("탭 게이트 (summary/reply/compare/order) 조건부 렌더가 존재", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/activeChipId === "summary" && \(<>/);
    expect(src).toMatch(/activeChipId === "reply" &&/);
    expect(src).toMatch(/activeChipId === "compare" &&/);
    expect(src).toMatch(/activeChipId === "order" &&/);
  });

  it("회신 현황 탭 — kv 4칸 라벨 + 0건 강조 + 마감 D-N 형식", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/발송 공급사/);
    expect(src).toMatch(/회신 수신/);
    // 마감 D-N 표기.
    expect(src).toMatch(/`D-\$\{sqDaysToDeadline\}`/);
    // 0건 강조 (red 톤) 분기.
    expect(src).toMatch(/sqResponseCount === 0 \? "border-red-200/);
  });

  it("비교 진행 탭 — 2곳 미만 안내 + 2곳 이상 견적 비교 버튼", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/비교하려면 회신이 2곳 이상 필요합니다/);
    expect(src).toMatch(/견적 비교를 시작할 수 있습니다/);
    expect(src).toMatch(/견적 비교 열기/);
  });

  it("dead button 0 — 견적 비교 버튼 onClick 이 실제 핸들러(setActiveWorkWindow compare_review) 연결", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/data-testid="quote-brief-compare-open-cta"/);
    expect(src).toMatch(/setActiveWorkWindow\("compare_review"\)/);
    // compare 버튼 onClick 안에 실핸들러 존재 (no-op/placeholder 금지).
    expect(src).toMatch(
      /onClick=\{\(e\) => \{ e\.stopPropagation\(\); setActiveWorkWindow\("compare_review"\); \}\}/,
    );
  });

  it("IntersectionObserver 가 탭 클릭을 덮어쓰지 않음 (setActiveChipId(targetId) override 제거)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).not.toMatch(/setActiveChipId\(targetId\)/);
  });
});

describe("§quote-brief-rail-tabs-sian — 회귀 0 (기존 markup/testid/id 보존)", () => {
  it("기존 brief section id 보존 (brief-summary/brief-facts/brief-facts2/brief-next/brief-risks)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/id="brief-summary"/);
    expect(src).toMatch(/id="brief-facts"/);
    expect(src).toMatch(/id="brief-facts2"/);
    expect(src).toMatch(/id="brief-next"/);
    expect(src).toMatch(/id="brief-risks"/);
  });

  it("기존 핵심 data-testid 보존", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/data-testid="briefing-collapse-button"/);
    expect(src).toMatch(/data-testid="quote-dispatch-blocker-summary"/);
    expect(src).toMatch(/data-testid="quote-dispatch-readiness-strip"/);
  });

  it("기존 collapsible/rich 블록 보존 (factsExpanded / briefDetailExpanded)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/setFactsExpanded\(prev => !prev\)/);
    expect(src).toMatch(/\{briefDetailExpanded && \(<>/);
  });

  it("bottom sticky CTA wiring 보존 (selectedSignals.actionKey → setActiveWorkWindow)", () => {
    const src = readWeb(QUOTES_PAGE);
    expect(src).toMatch(/setActiveWorkWindow\(selectedSignals\.actionKey\)/);
  });
});
