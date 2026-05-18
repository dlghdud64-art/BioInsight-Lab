/**
 * §11.252f — 소싱 액션 바 2행 분리 (1줄 강제 → 2행 독립 행 구조).
 *
 * 호영님 spec:
 *   - 비교/견적을 각각 독립된 1행으로 분리하여 총 2행 구조.
 *   - 1행 (비교): 아이콘 + "비교" + 건수 배지 + 경고 메시지 + 휴지통 (우측 끝).
 *   - 2행 (견적): 아이콘 + "견적" + 건수 배지 + 검토 배지 + 금액 + CTA 버튼 (우측 끝).
 *   - "전체 해제": 2행 하단 우측 텍스트 링크 또는 2행 내부 우측.
 *   - 각 행 높이 44px, 행 사이 구분선 1px (다크 바 내 subtle).
 *   - 비교 0건 → 1행 숨김, 견적 0건 → 2행 숨김.
 *   - 금액 flex-shrink-0 (절대 잘리지 않음).
 *   - CTA min-width 확보, 좁아지면 "견적 요청" 으로 축약 (sm:inline / hidden 분기).
 *   - iPhone SE (375px) 잘림 0.
 *
 * canonical truth lock:
 *   - 액션 바 기능 보존 (compareIds + quoteItems + clearCompare + removeQuoteItem +
 *     handleProtectedAction + setComparisonModalOpen + setRequestWizardOpen).
 *   - 비교 segment "비교 검토" CTA + "2개 이상 필요" 경고 메시지 보존.
 *   - 견적 segment "견적 요청 조립" + "견적 요청서 만들기" CTA + 금액 표시 보존.
 *   - 휴지통 (clearCompare + removeQuoteItem.forEach) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252f #1 — 2행 구조 (비교 행 + 견적 행 독립 분리)", () => {
  it("§11.252f trace marker 명시", () => {
    expect(code).toMatch(/§11\.252f|11\.252f/);
  });

  it("비교 segment 0건 시 행 숨김 분기 (compareIds.length > 0 조건부)", () => {
    // 호영님 spec "비교 0건일 때 1행 숨김".
    expect(code).toMatch(/compareIds\.length\s*>\s*0\s*&&/);
  });

  it("견적 segment 0건 시 행 숨김 분기 (quoteItems.length > 0 조건부)", () => {
    // 호영님 spec "견적 0건일 때 2행 숨김".
    expect(code).toMatch(/quoteItems\.length\s*>\s*0\s*&&/);
  });

  it("각 행 min-h-[44px] 또는 h-11 (44px 표준)", () => {
    // 호영님 spec "각 행 높이 44px".
    expect(code).toMatch(/(min-h-\[44px\]|h-11)[\s\S]{0,4000}(비교|견적)/);
  });
});

describe("§11.252f #2 — 행 사이 구분선 + 우측 정렬", () => {
  it("행 사이 border-b 또는 border-t 1px (subtle divider)", () => {
    // 다크 바 내 subtle 구분선 — border-b border-white/10 또는 유사 패턴.
    // Tailwind class 는 `border-b border-white/10` 처럼 공백 분리.
    expect(code).toMatch(/border-(b|t)\s+border-(white\/(5|10|20)|slate-(700|800))/);
  });

  it("우측 정렬 ml-auto 또는 justify-between 으로 우측 끝 배치", () => {
    // 휴지통/CTA 우측 끝 배치 패턴.
    expect(code).toMatch(/(ml-auto|justify-between)[\s\S]{0,3000}(Trash2|견적\s*요청)/);
  });
});

describe("§11.252f #3 — 금액 flex-shrink-0 + CTA 축약 라벨", () => {
  it("금액 텍스트 flex-shrink-0 또는 shrink-0 적용", () => {
    // 호영님 spec "금액 텍스트에 flex-shrink: 0 적용".
    expect(code).toMatch(/(flex-shrink-0|shrink-0)[\s\S]{0,500}(₩|totalAmount|toLocaleString)/);
  });

  it("CTA '견적 요청서 만들기' 보존 (긴 라벨)", () => {
    expect(code).toMatch(/견적\s*요청서\s*만들기/);
  });

  it("CTA 축약 라벨 '견적 요청' 별도 노출 또는 sm:inline / hidden 분기", () => {
    // 호영님 spec "좁아지면 '견적 요청' 으로 축약". sm:hidden + sm:inline 분기.
    expect(code).toMatch(/(sm:hidden[\s\S]{0,300}견적\s*요청|견적\s*요청[\s\S]{0,300}sm:hidden|hidden\s+sm:inline[\s\S]{0,300}견적\s*요청서)/);
  });
});

describe("§11.252f — invariant 보존", () => {
  it("비교 segment '2개 이상 필요' 경고 메시지 보존", () => {
    expect(code).toMatch(/2개\s*이상\s*필요/);
  });

  it("compareIds + quoteItems + clearCompare 보존", () => {
    expect(code).toMatch(/compareIds/);
    expect(code).toMatch(/quoteItems/);
    expect(code).toMatch(/clearCompare/);
  });

  it("removeQuoteItem.forEach 휴지통 동작 보존", () => {
    expect(code).toMatch(/removeQuoteItem/);
  });

  it("handleProtectedAction + setComparisonModalOpen + setRequestWizardOpen 보존", () => {
    expect(code).toMatch(/handleProtectedAction/);
    expect(code).toMatch(/setComparisonModalOpen/);
    expect(code).toMatch(/setRequestWizardOpen/);
  });

  it("전체 해제 button 보존", () => {
    expect(code).toMatch(/전체\s*해제/);
  });
});
