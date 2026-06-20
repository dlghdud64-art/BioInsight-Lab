/**
 * §quote-management P4-dispatch — 발송 모달 응답 기한 operator 선택 + s2 wiring 검증
 *
 * gap: BatchDispatchSheet 가 expiresInDays 를 14 로 하드코딩(operator 선택 불가)했음.
 *   서버(POST vendor-requests)는 이미 expiresInDays→expiresAt 완전 wiring → UI selector만 추가.
 *   expiresAt = s2 마감 = P4-core-A toQuoteCase(responseWindowDays) = computePriority 입력.
 * 0곳 발송 차단(disabled+사유)은 기존 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const SHEET = root("components/quotes/dispatch/batch-dispatch-sheet.tsx");
const ROUTE = root("app/api/quotes/[id]/vendor-requests/route.ts");

describe("§quote-management P4-dispatch — 응답 기한 selector", () => {
  it("expiresInDays state setter + select 배선", () => {
    expect(SHEET).toMatch(/const \[expiresInDays, setExpiresInDays\] = useState\(14\)/);
    expect(SHEET).toMatch(/id="batch-dispatch-window"/);
    expect(SHEET).toMatch(/onChange=\{\(e\) => setExpiresInDays\(Number\(e\.target\.value\)\)\}/);
  });
  it("선택값이 발송 body 로 전달(expiresInDays)", () => {
    expect(SHEET).toMatch(/expiresInDays,/);
  });
});

describe("§quote-management P4-dispatch — s2 wiring(서버) + 0곳 게이팅 보존", () => {
  it("서버 expiresInDays → expiresAt 반영(s2 마감 실값)", () => {
    expect(ROUTE).toMatch(/expiresInDays: z\.number\(\)\.int\(\)\.min\(1\)\.max\(90\)/);
    expect(ROUTE).toMatch(/expiresAt = new Date\(Date\.now\(\) \+ expiresInDays/);
  });
  it("공급사 0곳 발송 차단(사유) + dispatchableCount 0 disabled 보존", () => {
    expect(SHEET).toMatch(/연락 가능한 공급사 후보 없음/);
    expect(SHEET).toMatch(/disabled=\{isDispatching \|\| dispatchableCount === 0\}/);
  });
});
