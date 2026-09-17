/**
 * §fx-writeback-off (2026-09-17 · 릴레이 지시) · **환율로 계산한 원화 값을 원본(DB)에 기록하지 않는다.**
 *
 * ── 왜 ──
 * lib/api/products.ts searchProducts 가 `priceInKRW` 가 비어 있으면 convertToKRW(price, currency) 로 채우고
 * productVendor.update 로 **원본 열에 기록**했다. 그런데
 *   - prod 에 EXCHANGE_RATE_API_KEY 가 없어 lib/api/exchange-rate.ts 가 폴백 상수로 계산한다
 *     (prod `/api/exchange-rates` → 6통화 폴백 · 2026-09-17 비로그인 GET)
 *   - 그 폴백은 곱셈 방향이 뒤집혀 있다: `?from=USD&amount=52` → converted **0.039**
 * 오늘 발화 조건 행(price 있음 · priceInKRW 없음)은 0 이라 잠들어 있었지만, 공급사 가격이 들어오는 순간
 * 0원에 가까운 값이 원본에 영구 기록된다. 표시가 아니라 **쓰기**라 화면 수정으로 못 잡는다.
 * 방향만 고치는 것도 부족하다 — 기준일·출처 없는 환율로 원본을 채우는 구조 자체가 결함이다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 환율 함수(convertToKRW · getExchangeRates)를 **부르는 파일**은 읽기 전용 조회 API 하나뿐이다(집합 고정).
 *   ② 그 조회 API 는 DB 에 접근하지 않는다.
 *   ③ 제품 검색 경로는 priceInKRW 를 채우지도, productVendor 를 갱신하지도 않는다.
 *   ④ 소스 전체에서 priceInKRW 를 DB 에 쓰는 곳은 시드 리터럴 경로뿐이다(집합 고정 · 환산값 기록 0).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. src 밖(apps/web/scripts · prisma/*.ts). 2026-09-17 grep 기준 그쪽 환율 호출 0 — 새로 생기면 못 잡는다.
 *   2. raw SQL 로 priceInKRW 를 쓰는 경우(`$executeRaw`). 오늘 0.
 *   3. 환율 모듈 폴백의 방향 오류 자체 — 쓰기 경로를 끈 뒤 별도 단계에서 고친다(결함을 핀하지 않는다).
 *   4. priceInKRW 를 **읽어** 원화 단가로 복사하는 계산 축 — 이 검사가 세는 열 쓰기가 아니다.
 *      2026-09-17 발견: lib/api/quotes.ts:209 · app/api/protocol/bom/route.ts:151 (견적 품목 unitPrice 로 복사).
 *      price-currency-honesty 의 자기 한계 목록(비교·견적 공유·후보 최저가·스펙 비교)에 더해 D안 판정 후 함께 처리.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

function walk(): string[] {
  const out: string[] = [];
  const visit = (abs: string) => {
    for (const name of readdirSync(abs)) {
      if (name === "__tests__" || name === "node_modules" || name === "generated") continue;
      const p = join(abs, name);
      if (statSync(p).isDirectory()) visit(p);
      else if (/\.(ts|tsx)$/.test(name)) out.push(relative(SRC, p).split("\\").join("/"));
    }
  };
  visit(SRC);
  return out;
}

/**
 * priceInKRW 가 DB 쓰기 인자 안에서 **열 키**로 쓰이는가.
 * 글자 등장으로 세면 오탐이 난다(2026-09-17 첫 판본 실측): protocol/bom · lib/api/quotes 의 create 블록이
 * `vendor?.priceInKRW` 를 **읽어** 견적 단가로 복사한다 — 이건 열 쓰기가 아니다(계산 축 · 자기 한계 참조).
 * orderBy `priceInKRW: "asc"` 도 키지만 쓰기가 아니라 제외한다.
 */
function writesPriceInKRW(src: string): boolean {
  return /\.(update|upsert|create|createMany|updateMany)\s*\(\s*\{[\s\S]{0,600}?[{,\s]priceInKRW\s*:\s*(?!["'](asc|desc)["'])/.test(src);
}

describe("§fx-writeback-off · 환산값을 원본에 기록하지 않는다", () => {
  const files = walk();

  it("① 환율 함수를 부르는 파일은 읽기 전용 조회 API 하나뿐", () => {
    const callers = files
      .filter((rel) => rel !== "lib/api/exchange-rate.ts")
      .filter((rel) => /\b(convertToKRW|getExchangeRates)\s*\(/.test(code(rel)))
      .sort();
    expect(callers).toEqual(["app/api/exchange-rates/route.ts"]);
  });

  it("② 그 조회 API 는 DB 에 접근하지 않는다", () => {
    const src = code("app/api/exchange-rates/route.ts");
    expect(src).not.toMatch(/\bdb\s*\./);
    expect(src).not.toMatch(/from\s+["']@\/lib\/db["']/);
  });

  it("③ 제품 검색 경로는 priceInKRW 를 채우거나 productVendor 를 갱신하지 않는다", () => {
    const src = code("lib/api/products.ts");
    expect(src).not.toMatch(/convertToKRW/);
    expect(src).not.toMatch(/productVendor\s*\.\s*(update|upsert|updateMany)/);
    expect(src).not.toMatch(/\.priceInKRW\s*=/);
  });

  it("④ priceInKRW 를 DB 에 쓰는 곳은 시드 리터럴 경로뿐 (집합 고정)", () => {
    const writers = files.filter((rel) => writesPriceInKRW(code(rel))).sort();
    // 관리자 시드 라우트 — 리터럴 값(환산 아님). 시드 가격 행 정리(D안) 판정과 함께 재검토 대상.
    expect(writers).toEqual(["app/api/admin/seed/route.ts"]);
  });
});
