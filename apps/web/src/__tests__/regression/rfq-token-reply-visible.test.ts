/**
 * §rfq-token-reply-invisible — 토큰 폼 회신이 견적 파이프라인에 보이는지 sentinel
 * (2026-08-18 프로덕션 실측 회귀)
 *
 * 실측: /vendor/[token] 폼 제출 → QuoteVendorResponseItem 1건 · vendorRequest.status=RESPONDED.
 *       그런데 견적 관리는 QuoteResponse(q.responses)만 읽어 "회신 0/1 · 회신 대기" 로 정지.
 *       제품이 실제로 보내는 회신 경로가 파이프라인에서 통째로 보이지 않았다.
 *
 * 잠그는 것: /api/quotes GET 이 두 경로를 합류시켜 responses 로 내려준다 · 총액은 Σ(단가×수량)
 *            · 단가 0건이면 totalPrice 창작 0원 금지 · 같은 공급사 중복 합류 금지.
 * 잠그지 못하는 것: 실 DB 응답 · UI 렌더 · 발주 전환 런타임.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ROUTE = "app/api/quotes/route.ts";
const src = readFileSync(join(ROOT, ROUTE), "utf8");
// 주석이 단언을 대신 통과시키는 자기함정 차단 — 부정 단언 전에 주석을 제거한다.
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("§rfq-token-reply-invisible — 토큰 회신 합류", () => {
  it("🛑 responses 가 포털 회신 단독이 아니다 — 토큰 회신 파생을 합류시킨다", () => {
    expect(code).toMatch(/projectTokenReplies\(q\)/);
    expect(code).toMatch(/responses:\s*\[/);
    // 회귀 형태: responses 를 q.responses 만으로 되돌리는 순간 RED.
    expect(code).not.toMatch(/responses:\s*\(q\.responses\s*\|\|\s*\[\]\)\.map/);
  });

  it("파생 소스는 responseItems 보유 vendorRequest (status 문자열 신뢰 아님)", () => {
    expect(code).toMatch(/\(vr\.responseItems \|\| \[\]\)\.length > 0/);
  });

  it("총액은 Σ(단가 × 품목 수량) — 수량 무시 합산 금지", () => {
    expect(code).toMatch(/it\.unitPrice \* \(qtyById\.get\(it\.quoteItemId\) \?\? 1\)/);
  });

  it("🛑 단가 회신 0건에 0원을 창작하지 않는다", () => {
    expect(code).toMatch(/totalPrice: priced > 0 \? total : undefined/);
  });

  it("같은 공급사 포털 회신이 있으면 중복 합류하지 않는다", () => {
    expect(code).toMatch(/portalVendorNames\.has/);
  });
});
