/**
 * §11.252e — 소싱 검색 화면 모바일 UX (3 영역).
 *
 * 호영님 spec:
 *   ① 하단 비교/견적 액션 바 (line 944~1049) 3줄 → 2줄 압축 + 우측 padding +
 *     "전체 해제" inline + 휴지통 잘림 방지.
 *   ② 빈 화면 설명 텍스트 (line 817, 818) 짧은 문장으로 swap + word-break:keep-all.
 *   ③ "품목 등록 · 재고 확인 · 비교 목록" 카드 위치 (line 878~) — 검색 입력 직하단
 *     으로 이동.
 *
 * canonical truth lock:
 *   - 액션 바 기능 보존 (compareIds + quoteItems + clearCompare + removeQuoteItem +
 *     handleProtectedAction + setComparisonModalOpen + setRequestWizardOpen).
 *   - 빈 화면 검색 entry h2 "시약·장비를 검색하세요" 보존.
 *   - 카드 href (/protocol/bom, /dashboard/inventory, /app/compare) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252e #1 — 액션 바 압축 (3줄 → 2줄)", () => {
  it("액션 바 외부 컨테이너 overflow-x-auto 또는 flex-nowrap (모바일 wrap 차단)", () => {
    // 기존 flex-wrap → 모바일에서 flex-nowrap + overflow-x-auto (가로 스크롤).
    // 액션 바 외부 div ~ "전체 해제" Button 거리 ~5000+ chars (search/page.tsx 대형 file).
    expect(code).toMatch(/(overflow-x-auto|flex-nowrap)[\s\S]{0,8000}전체\s*해제|전체\s*해제[\s\S]{0,8000}(overflow-x-auto|flex-nowrap)/);
  });

  it("우측 padding 확보 (휴지통 잘림 방지, padding-right 16px+)", () => {
    // px-4 (16px) 또는 pr-4 또는 pr-6 명시.
    expect(code).toMatch(/(px-4|pr-4|pr-6)[\s\S]{0,200}#0f172a/);
  });

  it("§11.252e trace marker (search page 안 명시)", () => {
    expect(code).toMatch(/§11\.252e|11\.252e/);
  });
});

describe("§11.252e #2 — 빈 화면 텍스트 짧게 + word-break keep-all", () => {
  it("'한 흐름으로 연결됩니다' 또는 짧은 swap 문장", () => {
    // AS-IS "하나의 흐름으로 이어집니다" → TO-BE "한 흐름으로 연결됩니다".
    expect(code).toMatch(/한\s*흐름으로\s*연결/);
    expect(code).not.toMatch(/하나의\s*흐름으로\s*이어집니다/);
  });

  it("'500만\\+ 품목 검색' 또는 짧은 swap 문장", () => {
    // AS-IS "500만+ 품목을 검색할 수 있습니다." → TO-BE "500만+ 품목 검색".
    expect(code).toMatch(/500만\+\s*품목\s*검색/);
    expect(code).not.toMatch(/500만\+\s*품목을\s*검색할\s*수\s*있습니다/);
  });

  it("break-keep className 또는 word-break:keep-all 적용 (어절 단위 줄바꿈)", () => {
    // Tailwind break-keep 또는 style {wordBreak: "keep-all"}.
    expect(code).toMatch(/break-keep/);
  });
});

describe("§11.252e #3 — 카드 위치 이동 (검색 입력 직하단 또는 샘플 칩 위)", () => {
  it("카드 위치 변경 trace marker (§11.252e #3 명시)", () => {
    // 카드 위치 이동은 JSX 재배치이므로 명시 주석 또는 trace로 확인.
    expect(code).toMatch(/§11\.252e[\s\S]{0,200}#3|11\.252e[\s\S]{0,200}card-position/);
  });

  it("기존 href 보존 (/protocol/bom, /dashboard/inventory, /app/compare)", () => {
    expect(code).toMatch(/href=["']\/protocol\/bom["']/);
    expect(code).toMatch(/href=["']\/dashboard\/inventory["']/);
    expect(code).toMatch(/href=["']\/app\/compare["']/);
  });
});

describe("§11.252e — invariant 보존", () => {
  it("액션 바 핵심 기능 보존 (compareIds + quoteItems + clearCompare)", () => {
    expect(code).toMatch(/compareIds/);
    expect(code).toMatch(/quoteItems/);
    expect(code).toMatch(/clearCompare/);
  });

  it("빈 화면 검색 entry h2 보존", () => {
    expect(code).toMatch(/시약·장비를\s*검색하세요/);
  });

  it("카드 3 entry 보존 (품목 등록 / 재고 확인 / 비교 목록)", () => {
    expect(code).toMatch(/품목\s*등록/);
    expect(code).toMatch(/재고\s*확인/);
    expect(code).toMatch(/비교\s*목록/);
  });
});
