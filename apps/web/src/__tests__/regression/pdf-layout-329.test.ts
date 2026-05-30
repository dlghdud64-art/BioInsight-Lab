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
  for (const [name, path] of [["quote", QUOTE], ["po", PO]] as const) {
    it(`${name}: contentWidth/contentLeft 레이아웃 상수 도입`, () => {
      const src = read(path);
      expect(src).toMatch(/contentWidth/);
      expect(src).toMatch(/contentLeft|CONTENT_LEFT/);
    });
  }
});

describe("§11.329 — 표 컬럼 width + align 명시", () => {
  it("quote: 수량/견적가 right-align", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/align:\s*["']right["']/);
  });
  it("po: 수량/단가/합계 right-align", () => {
    const src = read(PO);
    expect(src).toMatch(/align:\s*["']right["']/);
  });
});

describe("§11.329 — 요청 사유/비고 full-width + 푸터 center", () => {
  it("quote: 요청 사유 contentWidth 사용 (497 하드코딩 제거)", () => {
    const src = read(QUOTE);
    expect(src).toMatch(/요청 사유/);
    expect(src).toMatch(/width:\s*contentWidth/);
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
