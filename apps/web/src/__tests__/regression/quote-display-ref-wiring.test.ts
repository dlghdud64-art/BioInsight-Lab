/**
 * §quote-table-sian-realign P1 — quoteDisplayRef 와이어링 (cuid internal-key 유출 제거)
 *
 * 견적 케이스 식별자 표시를 cuid 노출(`#${id.slice(0,8)}`)에서 공유 헬퍼로 전환.
 * 대상: quotes 페이지(테이블 ref·rail/sheet/detail 헤더) + 소싱 제출 확인(RFQ 번호).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");
const WIZARD = readFileSync(resolve(__dirname, "../../app/_workbench/_components/request-wizard-modal.tsx"), "utf8");

describe("§quote-table-sian-realign P1 — cuid 유출 제거(quotes 페이지)", () => {
  it("quoteDisplayRef import + 사용", () => {
    expect(PAGE).toMatch(/import \{ quoteDisplayRef \} from "@\/lib\/quote-management\/quote-display-ref"/);
    expect(PAGE).toMatch(/quoteDisplayRef\(quote\)/);
    expect(PAGE).toMatch(/quoteDisplayRef\(selectedQuote\)/);
  });
  it("raw cuid 표시(id.slice(0, 8).toUpperCase()) 부재", () => {
    expect(PAGE).not.toMatch(/\.id\.slice\(0, 8\)\.toUpperCase\(\)/);
  });
});

describe("§quote-table-sian-realign P1 — 소싱 제출 확인 RFQ 번호", () => {
  it("요청 ID(cuid 직접) → quoteDisplayRef(RFQ 번호) 전환", () => {
    expect(WIZARD).toMatch(/import \{ quoteDisplayRef \}/);
    expect(WIZARD).toMatch(/quoteDisplayRef\(\{ id: submittedRequestId \}\)/);
    expect(WIZARD).not.toMatch(/\{submittedRequestId \?\? "—"\}/);
  });
});
