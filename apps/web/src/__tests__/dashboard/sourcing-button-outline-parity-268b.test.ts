/**
 * §11.268b #sourcing-button-outline-parity
 * Operating Status Bar 3 button (정렬 select / 필터 / AI 분석) 시각 통일 테스트.
 *
 * Fix:
 *   (1) 정렬 select — min-h-[44px] 추가 (§11.266 family 44px 일관성).
 *   (2) AI 분석 button — violet → slate outline (필터 button 과 동일).
 *
 * 호영님 spec "파란색 강조 제거" — AI 분석 button 이 필터 button 과 동일
 * slate outline 이어야 함. §11.266e sibling invariant supersede.
 */

import { readFileSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/_workbench/search/page.tsx"
);
const ROW_PATH = join(
  process.cwd(),
  "src/app/_workbench/_components/sourcing-result-row.tsx"
);

function src(): string {
  return readFileSync(PAGE_PATH, "utf-8");
}

function rowSrc(): string {
  return readFileSync(ROW_PATH, "utf-8");
}

describe("§11.268b 정렬 select min-h-[44px] (§11.266 family 44px)", () => {
  it("§11.268b trace marker — JSDoc 존재", () => {
    expect(src()).toContain("§11.268b");
  });

  it("정렬 select data-testid=sourcing-sort-select 에 min-h-[44px] 적용", () => {
    const content = src();
    // sourcing-sort-select 와 min-h-[44px] 가 근접하게 존재해야 함 (속성 4줄 공백 감안 400자)
    expect(content).toMatch(
      /sourcing-sort-select[\s\S]{0,400}min-h-\[44px\]/
    );
  });

  it("정렬 select setSortBy onChange 보존", () => {
    expect(src()).toContain("setSortBy(e.target.value");
  });

  it("정렬 select 4 option 보존 (추천순 / 가격낮은순 / 가격높은순 / 배송기간순) — §1-2⑦ AI 데코 제거", () => {
    const content = src();
    // §1-2⑦ — "AI 추천순"→"추천순"(value=relevance 유지). AI 데코 라벨 supersede.
    expect(content).toContain("추천순");
    expect(content).not.toContain("AI 추천순");
    expect(content).toContain("가격 낮은순");
    expect(content).toContain("가격 높은순");
    expect(content).toContain("배송기간순");
  });
});

describe("§11.268b → §1-3 SUPERSEDE — AI 분석 button 제거", () => {
  // §1-3/§4 — 별도 "AI 분석" 버튼 폐기(ontology=inline 신호). 트리거·시트 제거 검증.
  it("AI 분석 트리거/시트 state 제거", () => {
    expect(src()).not.toContain('data-testid="sourcing-ai-analysis-trigger"');
    expect(src()).not.toContain("setAiAnalysisSheetOpen");
  });

  it("상단 우선 배너 1개로 대체", () => {
    expect(src()).toContain('data-testid="sourcing-top-banner"');
  });
});

describe("§11.268b invariant — 필터 button outline 보존(PRESERVE)", () => {
  it("필터 button §11.266a border-slate-200 outline 보존", () => {
    const content = src();
    expect(content).toContain("SlidersHorizontal");
    expect(content).toMatch(
      /SlidersHorizontal[\s\S]{0,100}필터|필터[\s\S]{0,200}border border-slate-200/
    );
  });
});

// §11.292 supersede — sourcing triage candidate evidence(Exact/Equivalent/Substitute/Blocked
//   배지 + shortlist/hold/exclude 분류)는 §11.292(호영님 P1 1단계, 검색 단순화)에서 의도적
//   제거됨. 해당 가드는 confirmed-stale → 삭제(sentinel-restore). candidate triage UI 부재가 정상.
