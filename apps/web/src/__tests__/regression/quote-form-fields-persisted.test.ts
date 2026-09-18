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
 * ── A안 (2026-09-18 승인 · DB 변경 없음) ──
 *   요청 목적·긴급도·공급 전략 → 발송 문구(Quote.description) 「요청 조건」 블록 · 대체품 허용 → 품목 메모.
 *   🛑 **한계(릴레이 조건):** 구조화 값을 텍스트로 녹였다 → 긴급도별 필터·공급 전략별 집계 불가.
 *      실제 고객이 「긴급 건만 보기」 류를 요구하는 시점이 B안(Quote·QuoteListItem 열 추가 · prod DDL ·
 *      호영님 승인) 판단 시점이다. 지금 미리 하지 않는다. (lib/quotes/request-conditions.ts 헤더 동일)
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. **DB 에 실제로 남았는지는 못 본다.** 소스 형태 + 합성 함수 단위까지다. 저장 확인은 A안 배포 후
 *      릴레이 브라우저 워크스루(새 견적 1건 → description·notes 실측 → 정리)로 한다.
 *      specialNotes 는 여전히 createQuote 가 받고 기록하지 않는다(위저드는 안 보냄 · 다른 경로 별건).
 *   2. 다른 제출 경로(products/[id] · quote-panel · ReorderReviewSheet · request-submission-work-window ·
 *      quotes-client · ReorderReviewSheet)의 본문은 세지 않는다. 이 파일은 위저드 축만 본다.
 *   3. 런타임 값(실제 전송 바이트). 소스 형태만 본다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { buildRequestConditionLines, requestConditionBlock, mergeItemNotes } from "@/lib/quotes/request-conditions";

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
   * 🛑 서버가 **모르는** 본문 키 = 0.
   * 이력: 04af038d 는 이 목록을 [purpose · suppliers · supplierStrategy · urgency] 로 고정한 래칫이었다
   * (처리 방향 미결). A안 승인(2026-09-18)으로 스키마가 네 키를 받게 되어 목록이 비었다 →
   * CLAUDE.md §예외 목록 조항대로 **목록 대신 0을 단언**한다(만료일 테스트도 함께 은퇴).
   */
  it("② 본문의 모든 최상위 키를 서버 스키마가 안다 (조용한 탈락 0)", () => {
    const keys = topLevelKeys(payloadBlock(code(WIZARD)));
    expect(keys.length, "본문 키를 못 읽었다").toBeGreaterThan(2);
    const schema = code(SCHEMA);
    const unknown = keys.filter((k) => !new RegExp(`(^|[\\s{])${k}\\s*:`, "m").test(schema)).sort();
    expect(unknown, "스키마에 없는 키 = zod 가 조용히 버린다").toEqual([]);
  });

  it("④ 서버가 받은 요청 조건을 실제로 쓴다 (문구 합성 · 품목 메모)", () => {
    const src = code(ROUTE);
    // 구조 분해에 네 키가 있다 — 스키마만 받고 라우트가 안 쓰면 여전히 버려진다
    for (const k of ["purpose", "urgency", "supplierStrategy", "suppliers"]) {
      expect(src, `라우트가 ${k} 를 꺼내지 않는다`).toMatch(new RegExp(`^\\s*${k},\\s*$`, "m"));
    }
    expect(src).toMatch(/vendorMessage \+= requestConditionBlock\(\{ purpose, urgency, supplierStrategy, suppliers \}\)/);
    expect(src).toMatch(/notes: mergeItemNotes\(item\.notes, item\.allowSubstitute\)/);
  });

  it("③ 총액 0 이면 공급사 발송 문구에 금액 줄을 쓰지 않는다", () => {
    const src = code(ROUTE);
    expect(src).toMatch(/const amountLine = vendorTotalAmount > 0/);
    // 금액 줄은 amountLine 선언 **한 곳**에서만 만들어진다 — 다른 곳의 ₩ 보간 경로 0
    expect(src.match(/예상 금액: ₩\$\{vendorTotalAmount/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/품목 수: \$\{vendorProductCount\}개\$\{amountLine\}/);
  });
});

describe("§quote-form-fields-persisted · 요청 조건 합성 (lib/quotes/request-conditions)", () => {
  it("워크스루 입력 그대로 → 「요청 조건」 블록 3줄", () => {
    const block = requestConditionBlock({
      purpose: "[검증 · 삭제 예정] 워크스루 점검",
      urgency: "일반",
      supplierStrategy: "compare",
      suppliers: [],
    });
    expect(block).toBe(
      "\n\n[요청 조건]\n요청 목적: [검증 · 삭제 예정] 워크스루 점검\n긴급도: 일반\n공급 전략: 비교 견적 · 2~3곳 비교 후 선정",
    );
  });

  it("값이 없는 줄은 쓰지 않는다 · 전부 없으면 블록도 없다", () => {
    expect(buildRequestConditionLines({ purpose: "  ", urgency: null })).toEqual([]);
    expect(requestConditionBlock({})).toBe("");
    expect(buildRequestConditionLines({ urgency: "긴급" })).toEqual(["긴급도: 긴급"]);
  });

  it("지정·선호 공급사는 공급사 이름을 함께 쓴다 · 모르는 전략은 쓰지 않는다", () => {
    expect(buildRequestConditionLines({ supplierStrategy: "directed", suppliers: ["Gibco", "Sigma"] })).toEqual([
      "공급 전략: 지정 공급사만 진행 (Gibco, Sigma)",
    ]);
    expect(buildRequestConditionLines({ supplierStrategy: "unknown" })).toEqual([]);
  });

  it("대체품 허용 → 품목 메모 · 값이 없으면 추정하지 않는다", () => {
    expect(mergeItemNotes(null, false)).toBe("대체 불가");
    expect(mergeItemNotes("500mL 우선", true)).toBe("500mL 우선 · 대체품 허용");
    expect(mergeItemNotes(undefined, undefined)).toBeUndefined();
  });
});
