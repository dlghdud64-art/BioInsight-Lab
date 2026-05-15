/**
 * §11.248b #quote-header-actions-responsive — 호영님 P0 견적 관리 #2 상단 액션 버튼 반응형
 *
 * 호영님 spec:
 *   - 중간 breakpoint(≤1024px) — 버튼 4개 2행 줄바꿈 허용 (flex-wrap)
 *   - 좁은 화면(≤768px) — 주요 1-2개만 노출 + "더보기 ⋯" 드롭다운으로 접기
 *   - 버튼 min-width 설정하여 텍스트 잘림 방지
 *
 * 현재 상태:
 *   - 외부 컨테이너: `overflow-x-auto snap-x` 가로 스크롤 패턴 (모바일 swipe)
 *   - 모바일 (<sm) 라벨 축소 ("파싱"/"비교"/"새 요청") + "견적 요청 초안 만들기" hidden
 *   - min-width 없음
 *
 * canonical truth lock:
 *   - 4 버튼 onClick / 권한 (PermissionGate) / data-testid 모두 보존
 *   - 기존 "+ 새 견적 요청" 옆 DropdownMenu (BOM import 등) 보존
 *   - quotes/page.tsx 의 모든 invariant 보존 (§11.226 ~ §11.247 cluster)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.248b #1 — flex-wrap (≤1024px 2행 줄바꿈)", () => {
  it("상단 액션 버튼 컨테이너 flex-wrap 적용 (모바일+tablet 줄바꿈)", () => {
    // 견적 관리 헤더 div 우측 버튼 컨테이너에 flex-wrap (lg:flex-nowrap 옵션) 적용
    expect(page).toMatch(
      /<div className="[^"]{0,200}flex[^"]{0,100}flex-wrap[^"]{0,200}"[\s\S]{0,800}견적서 파싱 버튼/,
    );
  });

  it("기존 overflow-x-auto snap-x 가로 스크롤 패턴 제거", () => {
    // 외부 컨테이너 className 에 overflow-x-auto + snap-x 양쪽 없음
    // (다른 곳에서 overflow-x-auto 가능 — 견적서 파싱 직전 컨테이너만 확인)
    expect(page).not.toMatch(
      /<div className="[^"]{0,300}overflow-x-auto[^"]{0,200}snap-x[^"]{0,300}"[\s\S]{0,500}견적서 파싱 버튼/,
    );
  });
});

describe("§11.248b #2 — 모바일 더보기 ⋯ 드롭다운 (<768px)", () => {
  it("모바일 더보기 DropdownMenu 추가 — sm:hidden + 더보기 라벨", () => {
    // 모바일 한정 (sm:hidden 또는 md:hidden) 으로 노출되는 DropdownMenu 안에 "견적서 비교" / "초안" 항목
    expect(page).toMatch(/더보기|MoreHorizontal|MoreVertical/);
  });

  it("DropdownMenuTrigger 모바일 한정 노출 (sm:hidden)", () => {
    // mobile-only trigger className 에 sm:hidden 또는 md:hidden
    expect(page).toMatch(
      /DropdownMenuTrigger[\s\S]{0,500}(sm:hidden|md:hidden|hidden\s+max-)/,
    );
  });
});

describe("§11.248b #3 — min-width 텍스트 잘림 방지", () => {
  it("4 버튼 최소 1곳 min-w- 또는 min-width 적용", () => {
    // 버튼 영역 (line 1583~1640 근처) 안 min-w- Tailwind 또는 inline minWidth
    expect(page).toMatch(/(견적서 파싱[\s\S]{0,2000}|견적서 비교[\s\S]{0,2000})min-w-\[?(\d+)/);
  });
});

describe("§11.248b #4 — invariant 보존", () => {
  it("4 버튼 onClick 핸들러 보존", () => {
    expect(page).toMatch(/setAiParseModalOpen\(true\)/); // 견적서 파싱
    expect(page).toMatch(/runAiQuoteCompare/); // 견적서 비교
    expect(page).toMatch(/openQuoteDraftWorkbench/); // 견적 요청 초안 만들기
  });

  it("PermissionGate 'quotes.create' 보존 (+ 새 견적 요청)", () => {
    expect(page).toMatch(/PermissionGate permission="quotes\.create"/);
  });

  it("data-testid quote-draft-workbench-cta 보존", () => {
    expect(page).toMatch(/data-testid="quote-draft-workbench-cta"/);
  });

  it("기존 BOM import DropdownMenu 보존 (+ 새 견적 요청 옆)", () => {
    expect(page).toMatch(/setIntakeDockSource\("bom_import"\)/);
  });

  it("§11.248b trace marker comment", () => {
    expect(page).toMatch(/§11\.248b[\s\S]{0,300}(상단|action|header|반응형|flex-wrap|드롭다운|wrap|더보기)/i);
  });
});
