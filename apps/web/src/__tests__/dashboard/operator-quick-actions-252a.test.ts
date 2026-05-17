/**
 * §11.252a — 운영 바로가기 모바일 2x2 컴팩트 그리드 + 설명 1줄 축약.
 *
 * 호영님 spec (모바일 대시보드 최적화 #1):
 *   - 4 카드 세로 1열 풀너비 → 모바일에서도 2x2 또는 가로 캐러셀.
 *   - 카드당 높이 과도 → min-h 모바일 축소.
 *   - 설명 텍스트 1줄 축약 (line-clamp-1 또는 truncate), 상세는 진입 후.
 *
 * canonical truth lock:
 *   - OperatorQuickActions props 시그니처 보존 (counts/quoteDispatchReadiness).
 *   - ACTIONS 4 entry (견적등록/발주전환/입고처리/재고점검) 보존.
 *   - 견적 발송 카드 Progressive Disclosure (§11.247) 보존.
 *   - count > 0 badge + href 모두 보존.
 *
 * canonical reference: ≥800px 에서 기존 auto-fit grid 유지 (desktop 4 carriers
 * 가 동일 row 안 배치). 모바일 (<800px) 만 2x2 강제.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const COMPONENT_PATH = resolve(
  __dirname,
  "../../components/dashboard/operator-quick-actions.tsx",
);

const code = safeRead(COMPONENT_PATH);

describe("§11.252a #1 — 모바일 2x2 grid (1열 fallback 제거)", () => {
  it("grid 안 모바일 grid-cols-2 명시 (1열 fallback 차단)", () => {
    // 호영님 spec 충족: 모바일 viewport <800px 에서 1열 → 2열 (2x2).
    // grid-cols-2 가 default 또는 모바일 분기로 명시.
    expect(code).toMatch(/grid-cols-2/);
  });

  it("≥800px 또는 sm/md/lg breakpoint 에서 기존 auto-fit 또는 4열 분기 보존", () => {
    // 데스크탑 4열 또는 auto-fit 보존 — sm: 또는 md: 또는 lg: 분기 안.
    expect(code).toMatch(/(sm:|md:|lg:)(grid-cols|grid)/);
  });

  it("§11.252a trace marker (mobile 2x2 정합 표시)", () => {
    expect(code).toMatch(/§11\.252a|11\.252a/);
  });
});

describe("§11.252a #2 — 카드 높이 모바일 축소 + 설명 1줄 축약", () => {
  it("설명 텍스트 line-clamp-1 또는 truncate (1줄 강제)", () => {
    expect(code).toMatch(/(line-clamp-1|truncate)/);
  });

  it("min-h 모바일 분기 (기존 min-h-[140px] 데스크탑만 + 모바일 축소)", () => {
    // min-h-[140px] 보존하되 모바일 분기 또는 작은 min-h 추가.
    //   sm:min-h-[140px] 또는 min-h-[100px] sm:min-h-[140px] 같은 분기.
    expect(code).toMatch(/(min-h-\[100px\]|min-h-\[110px\]|min-h-\[120px\]|sm:min-h-\[140px\]|md:min-h-\[140px\])/);
  });
});

describe("§11.252a #3 — invariant 보존 (props / ACTIONS / Progressive Disclosure)", () => {
  it("ACTIONS 4 entry 보존 (견적 등록 / 발주 전환 / 입고 처리 / 재고 점검)", () => {
    expect(code).toMatch(/견적\s*등록/);
    expect(code).toMatch(/발주\s*전환/);
    expect(code).toMatch(/입고\s*처리/);
    expect(code).toMatch(/재고\s*점검/);
  });

  it("OperatorQuickActions export + props 시그니처 보존", () => {
    expect(code).toMatch(/export\s+function\s+OperatorQuickActions/);
    expect(code).toMatch(/OperatorQuickActionsCounts/);
  });

  it("§11.247 견적 발송 Progressive Disclosure 보존 (isQuoteDispatchExpanded)", () => {
    expect(code).toMatch(/isQuoteDispatchExpanded/);
    expect(code).toMatch(/aria-expanded/);
  });

  it("count > 0 badge + href routing 보존", () => {
    expect(code).toMatch(/data-quick-action-badge/);
    expect(code).toMatch(/\/dashboard\/quotes/);
    expect(code).toMatch(/\/dashboard\/inventory/);
  });
});
