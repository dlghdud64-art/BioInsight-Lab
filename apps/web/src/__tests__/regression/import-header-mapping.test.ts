/**
 * §import-header-mapping (2026-09-26 · 호영님 실측)
 *
 * **한 소스 컬럼이 두 필드에 들어가면 안 된다. 인식 못 한 열을 말없이 버리지 않는다.**
 *
 * ── 실측 (호영님 · prod b3fa8042 · 7컬럼 2행 CSV) ──
 * 가짜 성공(§inventory-import-fake-success)을 닫아 서버에 실제로 연결한 **직후**,
 * 진짜 파일을 넣으니 새 결함 둘이 나왔다. 둘 다 확정을 누르면 **DB 에 들어간다.**
 * ```
 * ① 조용한 유실
 *    「카탈로그번호」(붙여 씀)  → 빈칸 (「카탈로그 번호」 띄어 쓴 것만 인식)
 *    「유효기한」               → 빈칸 (「유통기한」 만 인식)
 *    「로트번호」·「제조사」      → 스키마에 **컬럼 자체가 없음**
 *    그런데 화면은 「총 2개 중 2개를 등록할 수 있습니다」 로 **경고 0**
 *    → 연구실 재고에서 로트·유효기한은 핵심 정보다. 가짜 성공과 같은 등급의 조용한 유실이다(호영님).
 *
 * ② 한 컬럼이 두 필드에
 *    재고 수량 3 → 최소 주문 수량 3 · 5 → 5
 *    구 매칭이 **부분 문자열**을 허용해서 「수량」 이 「재고수량」·「최소주문수량」 둘 다에 걸렸다
 *    → 확정하면 틀린 재주문 기준이 DB 에 기록된다
 * ```
 *
 * ── 처방 (호영님 지시 1~4) ──
 *   1. 헤더 매칭은 **필드당 하나 · 컬럼당 하나.** 모호하면 매칭하지 않고 사용자가 고른다
 *   2. 동의어 사전으로 띄어쓰기·흔한 이름을 흡수
 *   3. 로트·제조사를 스키마에 추가 — 있는 필드로 매핑(ProductInventory.lotNumber · Product.manufacturer)
 *   4. 인식 못 한 열은 미리보기에 **명시**
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 매칭이 완전 일치다 (부분 문자열 0) · ② 한 컬럼이 두 필드에 가지 않는다 ·
 *   ③ 동의어 사전이 실측 헤더를 흡수한다 · ④ 미인식·모호 열이 화면에 뜬다 ·
 *   ⑤ 로트·제조사가 **실제로 저장된다** (스키마 필드 실재까지 확인)
 *
 * ── 자기 한계 ──
 *   1. 정적 검사 + 순수 함수 단위 검사다. 브라우저 렌더는 보지 않는다.
 *   2. 동의어 목록은 **열거 가능**하므로 집합으로 고정한다(§개수는 명제가 아니다).
 *      새 동의어를 넣는 것은 정당한 변경이고, 실측 헤더 4종은 계약으로 잠근다.
 *   3. 서버가 파싱한 컬럼명 자체(엑셀 병합셀 등)는 이 검사 밖이다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { matchHeaders, STANDARD_FIELDS } from "@/components/inventory/import-wizard";

const SRC = join(__dirname, "..", "..");
const APPS_WEB = join(SRC, "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const WIZARD = "components/inventory/import-wizard.tsx";
const COMMIT = "app/api/inventory/import/commit/route.ts";

/** 스키마에 그 필드가 실재하는가 — db 가 any 라 tsc 가 못 잡는다(§db=any). */
function schemaHas(model: string, field: string): boolean {
  const lines = readFileSync(join(APPS_WEB, "prisma/schema.prisma"), "utf8").split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `model ${model} {`);
  if (i < 0) return false;
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j].trim() === "}") return false;
    if (lines[j].trim().split(/\s+/)[0] === field) return true;
  }
  return false;
}

describe("§import-header-mapping · 결함 ② 한 컬럼이 두 필드에 가지 않는다", () => {
  it("① 호영님이 넣은 「수량」 은 어느 쪽에도 자동 배정되지 않는다", () => {
    /* 구 판본은 부분 문자열을 허용해 「수량」 이 재고수량·최소주문수량 둘 다에 걸렸다.
       이제 완전 일치라 아무 필드에도 안 걸리고, 모호/미인식으로 올라간다 — 사용자가 고른다. */
    const r = matchHeaders(["제품명", "수량"]);
    expect(r.mapping.currentQuantity).toBeUndefined();
    expect(r.mapping.minOrderQty).toBeUndefined();
    // 사용자에게 보이는 자리로 올라간다 — 조용히 사라지지 않는다.
    const surfaced = [...r.unrecognized, ...r.ambiguous.map((a) => a.column)];
    expect(surfaced).toContain("수량");
  });

  it("② 어떤 컬럼도 두 필드에 동시에 배정되지 않는다 (전 컬럼 불변식)", () => {
    const r = matchHeaders([
      "제품명", "카탈로그번호", "제조사", "재고 수량", "단위",
      "로트번호", "유효기한", "안전재고", "최소주문수량", "보관위치", "비고",
    ]);
    const used = Object.values(r.mapping);
    expect(used.length).toBe(new Set(used).size);
  });

  it("③ 같은 필드에 두 컬럼이 걸리면 뒤엣것을 덮지 않고 고르게 한다", () => {
    const r = matchHeaders(["제품명", "품목명"]); // 둘 다 productName 동의어
    expect(r.mapping.productName).toBe("제품명");
    expect(r.ambiguous.map((a) => a.column)).toContain("품목명");
  });
});

describe("§import-header-mapping · 결함 ① 조용한 유실이 없다", () => {
  it("④ 호영님 실측 헤더 4종이 흡수된다 (띄어쓰기·동의어)", () => {
    const r = matchHeaders(["제품명", "카탈로그번호", "제조사", "재고 수량", "단위", "로트번호", "유효기한"]);
    expect(r.mapping.catalogNumber).toBe("카탈로그번호"); // 붙여 쓴 것
    expect(r.mapping.expiryDate).toBe("유효기한");        // 「유통기한」 아닌 것
    expect(r.mapping.lotNumber).toBe("로트번호");         // 스키마에 없던 것
    expect(r.mapping.manufacturer).toBe("제조사");        // 스키마에 없던 것
    expect(r.mapping.productName).toBe("제품명");
    expect(r.mapping.currentQuantity).toBe("재고 수량");
    // 7컬럼 전부 인식 — 이 파일이면 미인식이 0이어야 한다.
    expect(r.unrecognized).toEqual([]);
    expect(r.ambiguous).toEqual([]);
  });

  it("⑤ 인식 못 한 열은 목록으로 돌아온다", () => {
    const r = matchHeaders(["제품명", "재고 수량", "담당자", "결재선"]);
    expect(r.unrecognized).toEqual(["담당자", "결재선"]);
  });

  it("⑥ 미인식·모호 열이 미리보기에 렌더된다 (호영님 지시 4)", () => {
    const src = code(WIZARD);
    // 화면이 그 목록을 읽는다 — 상태만 만들고 안 그리면 말없이 버리는 것과 같다.
    expect(src).toMatch(/headerMatch && \(headerMatch\.unrecognized\.length > 0 \|\| headerMatch\.ambiguous\.length > 0\)/);
    expect(src).toMatch(/data-testid="import-unrecognized-column"/);
    expect(src).toMatch(/data-testid="import-ambiguous-column"/);
    expect(src).toMatch(/가져오지 않습니다/);
    expect(src).toMatch(/후보:/);
  });

  it("⑦ 부분 문자열 매칭이 소스에 남아 있지 않다", () => {
    /* 결함 ② 의 뿌리다. 되살아나면 「수량」 이 다시 두 필드에 들어간다. */
    const src = code(WIZARD);
    /* 🛑 이름을 핀하면 형태만 바꿔도 통과한다 — 프로브 ① 이 잡았다(normalizeHeader(f.label).includes(n)).
       매칭 함수 **블록 안**에 부분 일치 연산자가 없다는 것으로 묻는다. */
    const mh = src.slice(src.indexOf("export function matchHeaders("), src.indexOf("const labelOf"));
    expect(mh).not.toMatch(/\.includes\(/);
    expect(mh).not.toMatch(/\.startsWith\(|\.endsWith\(|indexOf\(/);
    expect(mh).toMatch(/n === normalizeHeader/);
    // 판정은 한 함수에서만 — 화면이 자기 매칭을 다시 쓰지 않는다.
    expect(src).toMatch(/export function matchHeaders\(/);
    expect(src).toMatch(/const matched = matchHeaders\(data\.columns\)/);
  });
});

describe("§import-header-mapping · 로트·제조사가 실제로 저장된다", () => {
  it("⑧ commit 스키마가 두 필드를 받는다", () => {
    const src = code(COMMIT);
    // 컬럼 매핑 축 · 행 축 **둘 다** — 하나만 있으면 값이 중간에서 사라진다.
    const mapping = src.slice(src.indexOf("ColumnMappingSchema"), src.indexOf("InventoryRowSchema"));
    expect(mapping).toMatch(/lotNumber: z\.string\(\)\.optional\(\)/);
    expect(mapping).toMatch(/manufacturer: z\.string\(\)\.optional\(\)/);
    const row = src.slice(src.indexOf("InventoryRowSchema"), src.indexOf("interface CommitRequest"));
    expect(row).toMatch(/lotNumber: z\.string\(\)\.optional\(\)/);
    expect(row).toMatch(/manufacturer: z\.string\(\)\.optional\(\)/);
  });

  it("⑨ 저장 지점이 배선돼 있다 (create·update 두 자리 모두)", () => {
    const src = code(COMMIT);
    /* 경로가 둘이면 각각 단언한다 — 하나가 끊기는 것도 회귀다(4원칙 ③ 보강). */
    expect(src).toMatch(/lotNumber: validated\.lotNumber \?\? existingInventory\.lotNumber/);
    expect(src).toMatch(/lotNumber: validated\.lotNumber \|\| null/);
    expect(src).toMatch(/manufacturer: manufacturer \|\| null/);
    expect(src).toMatch(/findOrCreateProduct\([\s\S]{0,200}validated\.manufacturer/);
  });

  it("⑩ 그 필드가 스키마에 실재한다 (db 가 any 라 tsc 가 못 잡는다)", () => {
    /* §db=any → map 파라미터 명시 와 같은 뿌리 — 없는 필드에 쓰면 런타임에서만 터진다.
       「명제를 적기 전에 그 명제가 참인지 먼저 실측한다」(§관측 가능한 신호 확장). */
    expect(schemaHas("ProductInventory", "lotNumber")).toBe(true);
    expect(schemaHas("Product", "manufacturer")).toBe(true);
  });

  it("⑪ 동의어 집합이 서로 겹치지 않는다 (모호가 애초에 생기지 않는다)", () => {
    /* 컬럼 중복 차단 가드는 **방어선**이고, 겹치지 않는 사전이 1차 계약이다.
       누가 「수량」 을 두 필드에 넣으면 그 순간 RED — 결함 ② 가 정확히 그 형태였다.
       🔑 프로브 ①-b 가 이 축을 요구했다: 가드만 두면 겹칠 헤더가 없어서 **행동 검사가 성립하지 않는다**
          (가드를 지워도 테스트가 통과했다 · 4원칙 ⑥ 껍데기 프로브). */
    const norm = (x: string) => x.toLowerCase().replace(/[_\s\-.()[\]]/g, "");
    const seen = new Map<string, string>();
    for (const f of STANDARD_FIELDS) {
      for (const word of [f.key, f.label, ...f.synonyms]) {
        const n = norm(word);
        if (!n) continue;
        const prev = seen.get(n);
        expect(
          prev === undefined || prev === f.key,
          `동의어 충돌: "${n}" 이 ${prev} 와 ${f.key} 둘 다에 있다`,
        ).toBe(true);
        seen.set(n, f.key);
      }
    }
    // 사전이 실제로 읽혔는지 — 빈 배열이면 위 루프가 아무것도 검사하지 않는다.
    expect(seen.size).toBeGreaterThan(40);
    expect(STANDARD_FIELDS.length).toBe(11);
  });
});
