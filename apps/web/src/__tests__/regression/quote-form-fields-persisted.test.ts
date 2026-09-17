/**
 * §quote-form-fields-persisted (2026-09-18 · 릴레이 지시 5) · **제출 폼의 입력이 요청 본문에 실리고, 서버가 조용히 버리지 않는다.**
 *
 * ── 왜 ──
 * 워크스루(2026-09-17)에서 Step 2(견적 요청 위저드)에 넣은 값 4개가 하나도 저장되지 않았다.
 *   요청 목적 · 긴급도 · 공급 전략 → 본문에는 실리지만 **서버 zod 스키마에 키가 없어 파싱에서 탈락**
 *     (zod object 는 모르는 키를 조용히 버린다) → 라우트가 값을 보지도 못한다.
 *   품목별 대체품 허용(allowSubstitute) → 스키마에는 있으나 라우트의 itemsDetailed 매핑이 전달하지 않고
 *     QuoteListItem 에 열도 없다.
 *   그 결과 화면은 「제출 검토」에서 그 값들을 요약으로 보여준 뒤 버린다(front-only 성공).
 *   prod 실측: 견적 3건의 description 이 모두 서버 기본 템플릿(사용자 입력 아님).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① Step 2 폼의 상태값은 요청 본문 리터럴에 실린다(화면에서만 사는 입력 0).
 *   ② 본문 리터럴의 모든 키는 서버 스키마(quoteCreatePayloadSchema)가 **아는 키**다 — 조용한 탈락 0.
 *   ③ 공급사 발송 문구는 총액이 0일 때 금액 줄을 쓰지 않는다(§rfq-zero-amount-line).
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. **저장까지는 못 본다.** ②는 "서버가 키를 안다" 까지다. 스키마를 통과한 뒤 DB 열이 없어
 *      버려지는 경우(specialNotes 는 createQuote 파라미터로 받지만 Quote 에 열이 없어 기록되지 않는다)는
 *      별도 판정 대기 — 열 추가(DDL) vs 문구 합성 vs 화면에서 제거. 2026-09-18 현재 미결.
 *   2. 다른 제출 경로(products/[id] · quote-panel · ReorderReviewSheet · request-submission-work-window ·
 *      quotes-client · ReorderReviewSheet)의 본문은 세지 않는다. 이 파일은 위저드 축만 본다.
 *   3. 런타임 값(실제 전송 바이트). 소스 형태만 본다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const WIZARD = "app/_workbench/_components/request-wizard-modal.tsx";
const SCHEMA = "lib/validation/quote-create-schema.ts";
const ROUTE = "app/api/quotes/route.ts";

/** `const payload = { … }` 블록 — 중괄호 짝으로 연다(고정 폭 슬라이스 금지) */
function payloadBlock(src: string): string {
  const start = src.indexOf("const payload = {");
  expect(start, "위저드에서 payload 리터럴을 찾지 못함").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error("payload 리터럴의 닫는 중괄호를 찾지 못함");
}

/** 최상위 키만 — 중첩 객체(items 내부) 는 제외 */
function topLevelKeys(block: string): string[] {
  const body = block.slice(block.indexOf("{") + 1, block.lastIndexOf("}"));
  const keys: string[] = [];
  let depth = 0;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (depth === 0) {
      const m = trimmed.match(/^([A-Za-z_$][\w$]*)\s*[,:]/);
      if (m) keys.push(m[1]);
    }
    for (const ch of line) {
      if (ch === "{" || ch === "[" || ch === "(") depth++;
      else if (ch === "}" || ch === "]" || ch === ")") depth--;
    }
  }
  return [...new Set(keys)].sort();
}

describe("§quote-form-fields-persisted · 폼 입력은 본문에 실리고 서버가 안다", () => {
  it("① Step 2 폼의 상태값이 요청 본문에 실린다", () => {
    const block = payloadBlock(code(WIZARD));
    for (const field of ["purpose", "urgency", "supplierStrategy"]) {
      expect(block, `${field} 가 본문에 없다(화면에서만 사는 입력)`).toMatch(
        new RegExp(`(^|[{,\\s])${field}\\s*[,:]`),
      );
    }
    // 품목별 대체품 허용 — 라인 안에 실린다
    expect(block).toMatch(/allowSubstitute\s*:/);
  });

  /**
   * 🛑 래칫 — 서버가 **모르는** 본문 키 집합을 고정한다.
   * 지금 4개가 버려지고 있다(2026-09-17 워크스루에서 드러난 결함 그 자체). 처리 방향은 미결이라
   * (열 추가 DDL vs 발송 문구로 합성 vs 화면에서 제거 — 호영님/릴레이 판정 대기) 값을 0으로 단언하지 않고
   * **집합으로 고정**한다: 새 키가 조용히 탈락하면 RED, 고치면 목록에서 지운다.
   * 소유자: operator §quote-form-fields-persisted · 만료: 2026-10-18(지나면 ④ RED)
   */
  const KNOWN_DROPPED = ["purpose", "suppliers", "supplierStrategy", "urgency"].sort();
  const DROPPED_EXPIRES = "2026-10-18";

  it("② 서버가 모르는 본문 키 집합이 고정돼 있다 (새 조용한 탈락 0)", () => {
    const keys = topLevelKeys(payloadBlock(code(WIZARD)));
    expect(keys.length, "본문 키를 못 읽었다").toBeGreaterThan(2);
    const schema = code(SCHEMA);
    const unknown = keys.filter((k) => !new RegExp(`(^|[\\s{])${k}\\s*:`, "m").test(schema)).sort();
    expect(unknown, "스키마에 없는 키 = zod 가 조용히 버린다").toEqual(KNOWN_DROPPED);
  });

  it("④ 버려지는 키 목록은 만료 전이다", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today <= DROPPED_EXPIRES, `목록 만료(${DROPPED_EXPIRES}) · 처리하거나 재승인`).toBe(true);
  });

  it("③ 총액 0 이면 공급사 발송 문구에 금액 줄을 쓰지 않는다", () => {
    const src = code(ROUTE);
    expect(src).toMatch(/const amountLine = vendorTotalAmount > 0/);
    // 금액 줄은 amountLine 선언 **한 곳**에서만 만들어진다 — 다른 곳의 ₩ 보간 경로 0
    expect(src.match(/예상 금액: ₩\$\{vendorTotalAmount/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/품목 수: \$\{vendorProductCount\}개\$\{amountLine\}/);
  });
});
