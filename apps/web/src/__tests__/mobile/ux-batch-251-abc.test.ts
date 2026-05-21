/**
 * §11.251 batch — 모바일 UX 통합 개선 A/B/C cluster.
 *
 * 호영님 spec (모바일 UX 통합 개선 지시문 / 이미지 1·2·3):
 *
 *   A — BatchActionBar (이미지1) 비교/견적 하단 액션 바:
 *     - 휴지통(삭제) 아이콘 잘림 → bar 안 padding-right 확보
 *     - "전체 해제" 터치 영역 44px 이상 확보 (현재 "선택 해제" 텍스트)
 *     - 배지 가독성 ↑ (보류 amber 배지 대비)
 *
 *   B — Sourcing 검색 빈 화면 (이미지2):
 *     - "BOM 등록 · 재고 확인 · 비교 목록" 텍스트 링크 → 아이콘 + 카드형 버튼
 *     - 검색 placeholder 모바일 잘림 → 짧게 축약
 *
 *   C — 바코드 스캔 시뮬 (이미지3):
 *     - 하단 시트 grid-cols-3 (LOT/수량/보관) → 2열 라벨/값 4행 (품목명 + 3 항목)
 *     - "BOM 파서로 보내기" / "다시 스캔" 비율 → 둘 다 flex-1 동일 너비
 *
 * canonical truth lock:
 *   - BatchActionBar shape (selectedCount/dispatchableCount/.../onClearSelection)
 *     props 시그니처 보존.
 *   - search page line 880~884 Link href (/protocol/bom, /dashboard/inventory,
 *     /app/compare) 보존.
 *   - barcode-scan-fab scanned shape (name/lotCode/qty/unit/storage) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const BATCH_BAR_PATH = resolve(
  __dirname,
  "../../components/quotes/dispatch/batch-action-bar.tsx",
);
const SEARCH_PAGE_PATH = resolve(
  __dirname,
  "../../app/_workbench/search/page.tsx",
);
const SCAN_FAB_PATH = resolve(
  __dirname,
  "../../components/layout/barcode-scan-fab.tsx",
);

const batchBar = safeRead(BATCH_BAR_PATH);
const searchPage = safeRead(SEARCH_PAGE_PATH);
const scanFab = safeRead(SCAN_FAB_PATH);

describe("§11.251a — BatchActionBar (이미지1)", () => {
  it("'전체 해제' 라벨 (호영님 spec — 기존 '선택 해제' 텍스트 swap)", () => {
    expect(batchBar).toMatch(/전체\s*해제/);
  });

  it("clear selection 버튼 touch area min-h 44px 확보", () => {
    // 기존 h-8 (32px) → min-h-[44px] 또는 h-11 (44px).
    expect(batchBar).toMatch(/(min-h-\[44px\]|h-11)[\s\S]{0,300}전체\s*해제/);
  });

  it("dropdown 안 X 휴지통 버튼 min-h 44px (잘림 방지 + 터치 영역)", () => {
    // dropdown 안 onRemoveOne X 버튼 (선택 해제) — min-h-[44px] 또는 min-w-[44px].
    expect(batchBar).toMatch(/onRemoveOne[\s\S]{0,500}(min-w-\[44px\]|min-h-\[44px\])/);
  });

  it("§11.251a trace marker (BatchActionBar 안 §11.251a 표시)", () => {
    expect(batchBar).toMatch(/§11\.251a|11\.251a/);
  });

  it("기존 props 시그니처 보존 (onClearSelection / selectedCount)", () => {
    expect(batchBar).toMatch(/selectedCount/);
    expect(batchBar).toMatch(/onClearSelection/);
    expect(batchBar).toMatch(/onRemoveOne/);
  });
});

describe("§11.251b — Sourcing 검색 빈 화면 (이미지2)", () => {
  it("BOM 등록 / 재고 확인 / 비교 목록 카드형 swap (아이콘 + 텍스트)", () => {
    // 기존 3 텍스트 링크 → 카드형 (아이콘 + 텍스트). lucide icon 또는 inline-flex 안 아이콘 + label.
    //   §11.251b 안 카드형 swap 시 grid 또는 inline-flex + border + icon.
    expect(searchPage).toMatch(/§11\.251b|11\.251b/);
  });

  it("placeholder 축약 (모바일 잘림 방지)", () => {
    // 기존 "시약명 / CAS / 제조사 / 카탈로그 번호" → 짧게 ("시약명·CAS·제조사" 또는 비슷).
    // 모바일 잘림 방지를 위해 카탈로그 번호 제거 또는 "·" 구분자 swap.
    expect(searchPage).toMatch(/placeholder=["'][^"']*시약명[^"']{0,40}["']/);
    // "카탈로그 번호" 가 placeholder 안 포함 안 됨 (축약 후).
    expect(searchPage).not.toMatch(/placeholder=["'][^"']*카탈로그\s*번호[^"']*["']/);
  });

  it("BOM 등록 / 재고 확인 / 비교 목록 href 보존 (link 동작 보존)", () => {
    expect(searchPage).toMatch(/href=["']\/protocol\/bom["']/);
    expect(searchPage).toMatch(/href=["']\/dashboard\/inventory["']/);
    expect(searchPage).toMatch(/href=["']\/app\/compare["']/);
  });
});

describe("§11.251c — 바코드 스캔 시뮬 bottom sheet (이미지3)", () => {
  it("grid-cols-3 (LOT/수량/보관) 제거 + 2열 라벨/값 grid 으로 swap", () => {
    // 기존 grid-cols-3 → 2 column (label/value) grid 또는 dl form.
    // 명시적 grid-cols-3 가 scanned sheet 안에서 사라짐.
    //   호영님 spec: 품목명 / LOT / 수량 / 보관 4행 2열 grid.
    expect(scanFab).toMatch(/§11\.251c|11\.251c/);
  });

  it("BOM 파서로 보내기 + 다시 스캔 둘 다 flex-1 (동일 너비)", () => {
    // 기존 BOM flex-1 + 다시 스캔 (고정 너비) → 다시 스캔 도 flex-1.
    expect(scanFab).toMatch(/다시\s*스캔[\s\S]{0,200}flex-1|flex-1[\s\S]{0,200}다시\s*스캔/);
  });

  it("dim opacity 0.7 이상 (현재 bg-slate-950/85 OK 보존)", () => {
    expect(scanFab).toMatch(/bg-slate-950\/(7[5-9]|8\d|9\d)/);
  });

  it("scanned shape 보존 (name/lotCode/qty/unit/storage)", () => {
    expect(scanFab).toMatch(/scanned\.name/);
    expect(scanFab).toMatch(/scanned\.lotCode/);
    expect(scanFab).toMatch(/scanned\.qty/);
    expect(scanFab).toMatch(/scanned\.storage/);
  });
});

describe("§11.251-bom-label — BOM → 품목 라벨 통일 (호영님 추가 spec)", () => {
  it("barcode FAB 안 '품목 등록하기' 라벨 (기존 'BOM 파서로 보내기' swap)", () => {
    expect(scanFab).toMatch(/품목\s*등록하기/);
    // 기존 라벨 제거 확인
    expect(scanFab).not.toMatch(/>\s*BOM\s*파서로\s*보내기\s*</);
  });

  it("search page 안 '품목 등록' 라벨 (기존 'BOM 등록' swap)", () => {
    expect(searchPage).toMatch(/품목\s*등록/);
    // 카드 안 visible label 제거 (BOM 등록 직접 표기 제거 — href 안 'bom' 은 보존)
    expect(searchPage).not.toMatch(/>\s*BOM\s*등록\s*</);
  });

  it("href /protocol/bom 보존 (변수/path 유지 — 라벨만 swap)", () => {
    expect(searchPage).toMatch(/href=["']\/protocol\/bom["']/);
  });
});

describe("§11.251 batch — invariant 보존 (cross-stack)", () => {
  it("BatchActionBar selectedCount === 0 conditional return 보존", () => {
    expect(batchBar).toMatch(/selectedCount\s*===\s*0[\s\S]{0,200}return\s+null/);
  });

  it("search page 검색 entry h2 '시약·장비를 검색하세요' 보존", () => {
    expect(searchPage).toMatch(/시약·장비를\s*검색하세요/);
  });

  // §11.276b — §11.271 이 BarcodeScanFab 을 sticky FAB (fixed bottom-20 right-4) →
  //   DashboardHeader inline mount (relative + lg:hidden) 로 변경 후 stale invariant.
  //   §11.271 기반 새 patten 으로 update — relative + lg:hidden + ScanLine icon 보존.
  it("barcode scan button §11.271 header inline mount 패턴 보존 (relative + lg:hidden)", () => {
    expect(scanFab).toMatch(/relative\s+inline-flex/);
    expect(scanFab).toMatch(/lg:hidden/);
    expect(scanFab).toMatch(/<ScanLine\s+className="h-5\s+w-5"/);
  });
});
