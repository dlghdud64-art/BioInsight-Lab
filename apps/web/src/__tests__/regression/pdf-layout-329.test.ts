/**
 * §11.329 (RED) — 견적서/발주서 PDF 레이아웃 정정 sentinel
 *
 * Pretendard swap(§11.326 Phase 4 lineage) 후 컬럼 좌표 하드코딩 + text width/align 누락으로
 * 우측 잘림·컬럼 어긋남·요청사유 끼임·푸터 잘림 발생. 본 sentinel 이 GREEN 전환되면 정정 완료.
 *
 * 의도된 RED: 현재 코드(width/align 누락, 페이지 넘김 없음) 기준 실패.
 * 시각 렌더는 호영님 env(다운로드) — sentinel 은 좌표 산식·옵션 명시 코드 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const QUOTE = "src/lib/quotes/quote-request-pdf-generator.ts";
const PO = "src/lib/orders/po-pdf-generator.ts";

describe("§11.329 — 공통 레이아웃 상수 (하드코딩 제거)", () => {
  it("po: contentWidth/contentLeft 레이아웃 상수 도입", () => {
    const src = read(PO);
    expect(src).toMatch(/contentWidth/);
    expect(src).toMatch(/contentLeft|CONTENT_LEFT/);
  });
  // supersede(cf104415 · §rfq-doc-redesign): quote generator 재작성으로 상수명이
  //   PAGE_MARGIN/L/R/W 로 바뀌었다. 잠그는 의도는 이름이 아니라 **폭·좌표가 페이지에서
  //   파생될 것(하드코딩 금지)** 이다.
  it("quote: 폭/좌표가 페이지에서 파생 (하드코딩 제거)", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/doc\.page\.width/);
    expect(src).toMatch(/const W = R - L/);
    expect(src).not.toMatch(/width:\s*\d{3}\b/); // 3자리 고정폭 하드코딩 0
  });
});

describe("§11.329 — 표 컬럼 width + align 명시", () => {
  // supersede(cf104415): 가격열 폐지로 right-align 대상이 사라졌다. 남은 숫자열(수량)은
  //   고정폭 44px 라 center 가 canonical. 의도(숫자열을 좌측 정렬로 흘리지 않을 것) 유지.
  it("quote: 수량열 정렬 명시 (좌측 흘림 금지)", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/label:\s*"수량"[\s\S]{0,40}align:\s*["'](center|right)["']/);
  });
  it("po: 수량/단가/합계 right-align", () => {
    const src = read(PO);
    expect(src).toMatch(/align:\s*["']right["']/);
  });
});

describe("§11.329 — 요청 사유/비고 full-width + 푸터 center", () => {
  // supersede(cf104415): "요청 사유" 자유 문단 → 조건 표(회신 방법/요청 조건/비고)로 교체.
  //   의도(장문 블록이 파생 폭을 쓸 것 · 497 류 하드코딩 금지) 유지.
  it("quote: 조건 표 장문 블록이 파생 폭 사용 (하드코딩 제거)", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/["']비고["']/);
    expect(src).toMatch(/width:\s*W - termLabelW/);
    expect(src).not.toMatch(/width:\s*497/);
  });
  it("quote: 푸터 align center + width", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/자동 생성[\s\S]{0,160}align:\s*["']center["']/);
  });
});

describe("§11.329 — 페이지 넘김 가드", () => {
  for (const [name, path] of [["quote", QUOTE], ["po", PO]] as const) {
    it(`${name}: addPage/ensureSpace 페이지 넘김 처리`, () => {
      const src = read(path);
      expect(src).toMatch(/addPage|ensureSpace|page\.height/);
    });
  }
});

describe("§11.329 회귀 0 — Pretendard 폰트(Phase 2) 보존", () => {
  for (const [name, path] of [["quote", QUOTE], ["po", PO]] as const) {
    it(`${name}: resolvePretendardPath + registerFont('Korean') 보존`, () => {
      const src = read(path);
      expect(src).toMatch(/resolvePretendardPath/);
      expect(src).toMatch(/registerFont\(["']Korean["']/);
      expect(src).toMatch(/font:\s*fontBuffer/);
    });
  }
});
