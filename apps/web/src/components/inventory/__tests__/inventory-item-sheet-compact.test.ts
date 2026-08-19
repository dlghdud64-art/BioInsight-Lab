/**
 * §inventory-item-sheet-compact — 재고 품목 시트 압축 sentinel (핸드오프 2026-08-04 · 배치만 채택)
 *
 * 실측(2026-08-19 프로덕션 414px): 값 없는 필드도 전부 행으로 렌더돼 상태·보관 조건·공급사·
 *   납기·용도 5개가 대시(-)로 깔렸고, 유일한 CTA 가 최하단이라 스크롤해야 나왔다.
 *
 * 잠그는 것: 대시 폴백 0 · 미입력은 건수 1줄로 접힘 · 경고+CTA 가 3수치/행 리스트보다 위
 *            · 권장 수량이 CTA 라벨에 표기 · 보관 위치 공백은 "미지정" 정직 표기.
 * 잠그지 못하는 것: 실브라우저 레이아웃(한 화면 여부) · 색 결정(별도 카드) · 핸드오프 §3 액션 2버튼(미구현).
 *
 * 색은 이 sentinel 의 범위가 아니다 — reorder 톤은 mobile-reco-tone.test.ts 가 잠근다(파랑 유지).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VIEW = join(__dirname, "..", "mobile-inventory-view.tsx");
const raw = readFileSync(VIEW, "utf8");
// 주석이 단언을 대신 통과/차단시키는 자기함정 차단.
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

// 시트 본문 창 — 여는 함수부터 다음 최상위 함수 전까지(§sentinel 4원칙: 여는 태그 기준 창).
const sheetStart = code.indexOf("function MobileDetailSheet(");
const sheetEnd = code.indexOf("export function MobileInventoryView");
const sheet = code.slice(sheetStart, sheetEnd);

describe("§inventory-item-sheet-compact — 빈 필드", () => {
  it("창이 잡힌다 — 못 잡으면 이 sentinel 은 무효다", () => {
    expect(sheetStart).toBeGreaterThan(-1);
    expect(sheetEnd).toBeGreaterThan(sheetStart);
  });

  it('🛑 대시 폴백 0 — `|| "-"` / `?? "-"` 가 시트에 없다', () => {
    expect(sheet).not.toMatch(/\|\|\s*"-"/);
    expect(sheet).not.toMatch(/\?\?\s*"-"/);
    expect(sheet).not.toMatch(/\{"-"\}/);
  });

  it("값 유무로 행/미입력을 가르는 단일 경로가 있다", () => {
    expect(sheet).toMatch(/const pushRow = /);
    expect(sheet).toMatch(/if \(filled\) rows\.push/);
    expect(sheet).toMatch(/else missing\.push\(label\)/);
  });

  it("미입력은 행이 아니라 건수 1줄로 접힌다 + 채우기 액션", () => {
    expect(sheet).toMatch(/미입력 \{missing\.length\}건/);
    expect(sheet).toMatch(/채우기/);
  });

  it("보관 위치 공백은 미지정으로 정직 표기한다", () => {
    expect(sheet).toMatch(/\{inv\.location \|\| "미지정"\}/);
  });
});

describe("§inventory-item-sheet-compact — 배치", () => {
  it("🛑 경고+CTA 가 3수치 그리드보다 위에 온다", () => {
    const cta = sheet.indexOf("AI 재발주 검토");
    const grid = sheet.indexOf("grid grid-cols-3");
    expect(cta).toBeGreaterThan(-1);
    expect(grid).toBeGreaterThan(-1);
    expect(cta).toBeLessThan(grid);
  });

  it("🛑 하단에 재발주 CTA 중복이 없다 — 상단 1곳", () => {
    /* 🛑 라벨 문자열이 아니라 **CTA 요소**를 센다.
     *    2026-08-19 실측: 라벨 count 로 재면 2 가 나오는데 그건 중복 CTA 가 아니라
     *    같은 한 줄의 삼항이 `AI 재발주 검토` 를 두 번 쓴 것이다(수량 유무 분기).
     *    잠글 대상은 "버튼이 두 곳에 있는가" 이지 "문자열이 몇 번 나오는가" 가 아니다.
     *    §정규식 sentinel ④ — 토큰이 아니라 분기/요소 단위로 센다. */
    expect((sheet.match(/onReorder\(inv\)/g) ?? []).length).toBe(1);
    // 그 1곳이 상단(3수치 그리드보다 위)임은 위 it 이 잠근다.
    expect(sheet).toMatch(/AI 재발주 검토/);
  });

  it("권장 수량이 CTA 라벨에 표기된다 (0 이면 라벨만)", () => {
    expect(sheet).toMatch(/const recommendedQty = Math\.max\(0, \(inv\.safetyStock \?\? 0\) - inv\.currentQuantity\)/);
    expect(sheet).toMatch(/recommendedQty > 0 \? `AI 재발주 검토 · 권장 \$\{recommendedQty\}\$\{inv\.unit\}`/);
  });

  it("Lot 은 별도 카드가 아니라 헤더 메타 1줄로 올라간다", () => {
    expect(sheet).toMatch(/inv\.lotNumber \? `Lot \$\{inv\.lotNumber\}` : null/);
    expect(sheet).not.toMatch(/Lot 정보/);
  });
});
