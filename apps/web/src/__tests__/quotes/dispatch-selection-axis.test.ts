/**
 * §purchased-falls-through-to-not-sent — 실행 축 분리 sentinel
 *
 * 카드: docs/handoff/CARD_purchased-falls-through-to-not-sent.md
 *
 * deriveRailState 는 PURCHASED·CANCELLED 분기가 없어 둘 다 request_not_sent 로 fallthrough 한다.
 * 표시 축(badge·CTA·색)의 문법 판정은 카드의 측정 5항목 뒤로 미뤘지만, **선택·일괄은 실행**이라
 * 지금 막았다 — 누르면 공급사 재전송이라는 되돌릴 수 없는 외부 부작용이 난다.
 *
 * 🛑 이 sentinel 이 잠그는 것은 "두 축이 다시 같은 함수를 쓰지 않는다" 이다.
 *    표시 축이 고쳐지더라도 실행 축은 자기 판정을 유지해야 한다 —
 *    표시가 옳아졌다고 실행 판정을 표시에 위임하면 결함의 원인이 그대로 돌아온다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const QUOTES_PAGE = "src/app/dashboard/quotes/page.tsx";

describe("실행 축 — isDispatchable 단일점", () => {
  it("isDispatchable 이 PURCHASED · CANCELLED 를 제외한다", () => {
    const code = stripComments(read(QUOTES_PAGE));
    expect(code).toMatch(/NON_DISPATCHABLE_STATUSES = new Set\(\["PURCHASED", "CANCELLED"\]\)/);
    expect(code).toMatch(
      /function isDispatchable\(q: Quote\): boolean \{[\s\S]{0,200}?NON_DISPATCHABLE_STATUSES\.has\(q\.status\)[\s\S]{0,80}?return false/,
    );
  });

  it("🛑 deriveRailState 직접 비교는 isDispatchable 내부 한 줄뿐이다", () => {
    /* 선택·일괄·집계가 deriveRailState(q) === "request_not_sent" 로 되돌아가면
     * 발주 완료 견적이 공급사 재전송 대상에 다시 섞인다. */
    const code = stripComments(read(QUOTES_PAGE));
    const hits = code.match(/deriveRailState\([^)]*\)\s*[!=]==\s*"request_not_sent"/g) ?? [];
    expect(hits).toHaveLength(1);
    expect(code).toMatch(
      /function isDispatchable\(q: Quote\): boolean \{[\s\S]{0,300}?deriveRailState\(q\) === "request_not_sent";/,
    );
  });

  it("행 선택 3곳이 전부 isDispatchable 을 쓴다 (긴급·진행·완료 섹션)", () => {
    const code = stripComments(read(QUOTES_PAGE));
    const hits = code.match(/isSelectable=\{isDispatchable\(quote\)\}/g) ?? [];
    expect(hits).toHaveLength(3);
  });

  it("전체 선택 · 일괄 집계 · 워크벤치 진입도 같은 축을 쓴다", () => {
    const code = stripComments(read(QUOTES_PAGE));
    expect(code).toMatch(/sortedQuotes\.filter\(\(q\) => isDispatchable\(q\)\)/); // ⌘A 전체 선택
    expect(code).toMatch(/filteredQuotes\.filter\(q => isDispatchable\(q\)\)/); // 전체 선택 CTA
    expect(code).toMatch(/if \(!isDispatchable\(q\)\) continue;/); // 발송 가능 집계
    expect(code).toMatch(/quotes\.find\(\(quote\) => isDispatchable\(quote\)\)/); // 초안 워크벤치 진입
  });

  it("표시 축은 건드리지 않았다 — railState 비교는 그대로 (문법 판정 대기)", () => {
    /* 🔑 이 단언은 "아직 안 고쳤다" 를 기록한다. 표시 축을 고치는 슬라이스가
     * 이 숫자를 바꾸게 되며, 그때 위의 실행 축 단언이 함께 GREEN 이어야 한다. */
    const code = stripComments(read(QUOTES_PAGE));
    const hits = code.match(/railState === "request_not_sent"/g) ?? [];
    expect(hits).toHaveLength(2);
  });
});
