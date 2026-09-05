/**
 * §scan-category-touched (호영님 2026-09-04, (D)) — 선채움 통과와 사람의 선택을 구분한다.
 *
 * 사고(prod 스모크 실측):
 *   분류를 **한 번도 건드리지 않은** 등록 3건이 전부 `categorySource = USER_SELECTED` 로
 *   기록됐다. 화면이 fallback(REAGENT)을 선채움해 payload 에 그대로 실어 보내므로,
 *   서버가 보기에 "사람이 REAGENT 를 골랐다" 와 "아무것도 안 골랐다" 가 완전히 같다.
 *   그러면 이 컬럼의 존재 이유(fallback 이 얼마나 무비판적으로 통과되는가)가 사라진다.
 *
 * 잠그는 것:
 *   1) 판정 축은 값이 아니라 "건드렸는가" — 클라이언트가 categoryTouched 를 보낸다
 *   2) 단품 1곳 · 다품목 라인별 — 경로 각각(하나가 끊기는 것도 회귀)
 *   3) 세 상태가 각각 존재: USER_SELECTED / FALLBACK / UNKNOWN (그리고 null 과도 다르다)
 *   4) 선채움 안내 문구는 **안 건드린 동안만** 노출
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const OPTIONS = "src/lib/inventory/product-category-options.ts";

/**
 * `items: includedLines.map((l) => ({ … }))` 블록 전체를 잡는다.
 * 🛑 고정 폭 슬라이스를 쓰지 않는다 — payload 에 필드가 하나 늘면 뒷 필드가 창 밖으로
 *    밀려 **구현은 계약을 지키는데 단언만 RED** 가 된다(2026-09-05 실측: brand 추가로 2건).
 *    그때 앵커를 갱신하면 fixture 가 구현을 따라가는 형태가 되므로, 창을 블록 단위로 연다.
 */
function multiItemsBlock(src: string): string {
  const start = src.indexOf("items: includedLines.map((l) => ({");
  if (start < 0) throw new Error("items payload 앵커를 찾지 못했다");
  const end = src.indexOf("})),", start);
  if (end < 0) throw new Error("items payload 닫는 자리를 찾지 못했다");
  return src.slice(start, end);
}

/**
 * 단품 `confirmedData: { … }` 블록 전체를 잡는다.
 * 🛑 고정 폭 슬라이스 금지 — payload 에 필드가 하나 늘면 뒷 필드가 창 밖으로 밀려
 *    **구현은 계약을 지키는데 단언만 RED** 가 된다(2026-09-05 실측: brand 1회 · specification 1회).
 *    그때 앵커를 갱신하면 fixture 가 구현을 따라간다 — 창을 블록 단위로 연다.
 */
function singleConfirmedBlock(src: string): string {
  const start = src.indexOf("confirmedData: {");
  if (start < 0) throw new Error("confirmedData 앵커를 찾지 못했다");
  const end = src.indexOf("\n          },", start);
  if (end < 0) throw new Error("confirmedData 닫는 자리를 찾지 못했다");
  return src.slice(start, end);
}


describe("§scan-category-touched — 서버가 touched 를 판정에 쓴다", () => {
  it("resolver 가 touched 인자를 받는다 (값 단독 판정 폐기)", () => {
    const src = read(OPTIONS);
    expect(src).toMatch(/export function resolveProductCategory\(\s*value: unknown,\s*touched\?: boolean,/);
  });

  it("단품 경로가 categoryTouched 를 넘긴다", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("const resolvedCategory = resolveProductCategory(");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 220)).toMatch(/confirmedData\.categoryTouched/);
  });

  it("다품목 라인 경로가 categoryTouched 를 넘긴다", () => {
    // ④ 경로는 OR 로 묶지 않는다.
    expect(read(ROUTE)).toMatch(
      /resolveProductCategory\(line\.category,\s*line\.categoryTouched\)/,
    );
  });

  it("요청 타입에 두 축 모두 선언돼 있다 (타입에서 탈락 방지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/categoryTouched\?: boolean;/);
    // 단품 body 와 라인 타입 두 곳.
    expect((src.match(/categoryTouched\?: boolean;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("🛑 값 단독 판정으로 회귀하지 않는다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/resolveProductCategory\(confirmedData\.category\)/);
    expect(code).not.toMatch(/resolveProductCategory\(line\.category\)/);
  });
});

describe("§scan-category-touched — 세 상태가 각각 존재한다", () => {
  it("UNKNOWN 이 열거값에 있다 (판단 근거 없음 · null 과 다르다)", () => {
    const src = read(OPTIONS);
    expect(src).toMatch(/UNKNOWN:\s*"UNKNOWN"/);
    expect(src).toMatch(/USER_SELECTED:\s*"USER_SELECTED"/);
    expect(src).toMatch(/FALLBACK:\s*"FALLBACK"/);
  });

  it("touched 미전달 → UNKNOWN 분기가 실재한다", () => {
    const src = read(OPTIONS);
    const idx = src.indexOf("export function resolveProductCategory(");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 900);
    expect(win).toMatch(/touched === undefined/);
    expect(win).toMatch(/CATEGORY_SOURCE\.UNKNOWN/);
  });

  it("Postgres enum 이 아니라 TEXT — UNKNOWN 추가에 DDL 이 필요 없다", () => {
    const schema = read("prisma/schema.prisma");
    const model = /^model Product \{([\s\S]*?)^\}/m.exec(schema);
    expect(model![1]).toMatch(/categorySource\s+String\?/);
  });
});

describe("§scan-category-touched — 화면이 조작을 기록한다", () => {
  it("단품 select 가 값 설정과 조작 기록을 함께 한다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[categoryTouched, setCategoryTouched\] = useState\(false\)/);
    expect(src).toMatch(
      /setForm\(\{ \.\.\.form, category: v \}\);[\s\S]{0,160}?setCategoryTouched\(true\)/,
    );
  });

  it("다품목은 그 행만 조작 기록한다", () => {
    expect(read(MODAL)).toMatch(
      /j === i \? \{ \.\.\.x, category: v, categoryTouched: true \} : x/,
    );
    // 라인 초기값은 미조작.
    expect(read(MODAL)).toMatch(/categoryTouched: false,/);
  });

  it("두 전송 경로가 각각 categoryTouched 를 싣는다", () => {
    const src = read(MODAL);
    expect(singleConfirmedBlock(src)).toMatch(/categoryTouched,/);
    expect(multiItemsBlock(src)).toMatch(/categoryTouched:\s*l\.categoryTouched/);
  });

  it("선채움 안내는 안 건드린 동안만 노출한다", () => {
    expect(read(MODAL)).toMatch(
      /!categoryTouched && form\.category === FALLBACK_PRODUCT_CATEGORY &&/,
    );
  });

  it("재시작 시 조작 기록이 초기화된다 (다음 등록에 새어나가지 않는다)", () => {
    expect(read(MODAL)).toMatch(/setCategoryTouched\(false\)/);
  });
});
