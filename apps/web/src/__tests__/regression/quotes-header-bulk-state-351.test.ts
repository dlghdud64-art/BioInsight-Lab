/**
 * §11.351 (회귀) — 견적 관리 헤더 정리(#1) + 일괄 집계 상태 정합(#3) sentinel
 *
 * #1: "견적 요청 초안 만들기" 헤더/드롭다운 진입로 제거(방안 a, 모달/핸들러 코드 잔존).
 * #3: 일괄 발송 대상 = canonical 상태 "요청 발송 전"(request_not_sent)만.
 *     - Ctrl+A 전체 선택이 request_not_sent 만 선택(회신 대기 등 제외)
 *     - dispatchableCount 가 request_not_sent 아닌 건 제외(중복 발송/거짓 집계 방지)
 * (#2 하단 고정 액션 바/layout shift = 별도 — 본 sentinel 범위 아님.)
 *   문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/quotes/page.tsx";

describe("§11.351 #1 — 초안 만들기 헤더 진입로 제거", () => {
  it("헤더 초안 버튼(quote-draft-workbench-cta) 제거", () => {
    const src = read(PAGE);
    expect(src).not.toContain('data-testid="quote-draft-workbench-cta"');
  });
  it("핸들러(openQuoteDraftWorkbench)는 잔존(방안 a — 복구 용이)", () => {
    const src = read(PAGE);
    expect(src).toContain("openQuoteDraftWorkbench");
  });
});

describe("§11.351 #1 회귀 0 — 유지 액션", () => {
  it("새 견적 요청 / 견적서 비교 / 견적서 스캔 보존", () => {
    const src = read(PAGE);
    expect(src).toContain("새 견적 요청");
    expect(src).toContain("견적서 비교");
    expect(src).toContain("견적서 스캔");
  });
});

describe("§11.351 #3 — 일괄 집계 canonical 상태 정합", () => {
  it("Ctrl+A 전체 선택이 발송 대상만 선택 (isDispatchable)", () => {
    /* 승계 (§purchased-falls-through-to-not-sent 실행 축 분리 2026-08-24):
     * 옛 축은 `deriveRailState(q) === "request_not_sent"` 구현 문자열을 핀했다.
     * 결정은 그대로다 — 발송 대상은 여전히 "요청 발송 전"만이고, isDispatchable 이
     * 거기에 PURCHASED·CANCELLED 제외를 더해 **더 좁게** 이행한다. 판정식만 교체됐다.
     * 🛑 역방향 잠금: 이 슬롯이 deriveRailState 직접 비교로 되돌아가면 RED. */
    const src = read(PAGE);
    expect(src).toContain("filter((q) => isDispatchable(q)).map((q) => q.id)");
    expect(src).not.toContain('filter((q) => deriveRailState(q) === "request_not_sent").map((q) => q.id)');
  });
  it("dispatchableCount 가 발송 비대상을 제외(회신 대기·발주 완료 카운트 차단)", () => {
    /* 승계 (§purchased-falls-through-to-not-sent 실행 축 분리 2026-08-24):
     * 옛 축은 `deriveRailState(q) === "request_not_sent"` 구현 문자열을 핀했다.
     * 결정은 그대로다 — 발송 대상은 여전히 "요청 발송 전"만이고, isDispatchable 이
     * 거기에 PURCHASED·CANCELLED 제외를 더해 **더 좁게** 이행한다. 판정식만 교체됐다.
     * 🛑 역방향 잠금: 이 슬롯이 deriveRailState 직접 비교로 되돌아가면 RED. */
    const src = read(PAGE);
    expect(src).toContain("if (!isDispatchable(q)) continue;");
    expect(src).not.toContain('if (deriveRailState(q) !== "request_not_sent") continue;');
  });
});
