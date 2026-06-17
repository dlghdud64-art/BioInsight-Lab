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
 * §dashboard-shifan-fidelity P-fid3 진화 — 라이브 실측 결과 auto-fit minmax(280px) 가
 * side-col 반폭(~540px)에서 1×4 로 무너짐(시안 2×2 위반). grid-cols-2 고정으로 전환:
 * 모바일·데스크탑 일관 2×2. 과대 sm:min-h-[140px] → 컴팩트 단일 min-h 로 전환.
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

describe("§11.252a → §dashboard-rightcol-rebalance — 우측 단독 세로 1열(호영님)", () => {
  it("grid-cols-1 세로 1열 (구 2×2 side-col 폐지)", () => {
    // 우측 = 빠른작업 단독(최근활동 풀폭 분리) → 세로 1열로 좌측(예산+도넛) 높이까지 채움.
    expect(code).toMatch(/grid grid-cols-1/);
    expect(code).not.toMatch(/grid grid-cols-2/);
  });

  it("auto-rows-fr + flex-1 로 컬럼 높이 균등 분할(좌측 정합)", () => {
    expect(code).toMatch(/auto-rows-fr/);
    expect(code).toMatch(/flex h-full flex-col/);
  });

  it("auto-fit 회귀 차단", () => {
    expect(code).not.toMatch(/grid-cols-\[repeat\(auto-fit/);
  });
});

describe("§11.252a #2 — 카드 높이 모바일 축소 + 설명 1줄 축약", () => {
  it("설명 텍스트 line-clamp-1 또는 truncate (1줄 강제)", () => {
    expect(code).toMatch(/(line-clamp-1|truncate)/);
  });

  it("§P-fid3 — 타일 컴팩트 단일 min-h (2×2 정합, 과대 min-h-[140px] 폐지)", () => {
    // 2×2 고정 후 타일 컴팩트화: 단일 min-h (96~120px). 과대 sm:min-h-[140px] 폐지.
    expect(code).toMatch(/(min-h-\[96px\]|min-h-\[100px\]|min-h-\[104px\]|min-h-\[110px\]|min-h-\[120px\])/);
    expect(code).not.toMatch(/sm:min-h-\[140px\]/);
  });
});

describe("§11.252a #3 — invariant 보존 (props / ACTIONS / Progressive Disclosure)", () => {
  it("ACTIONS 4 entry 보존 (견적 발송 / 발주 전환 / 입고 처리 / 재고 점검)", () => {
    // §11.364 D-1 — "견적 등록" → "견적 발송"(워크벤치 진입) 강등 정합.
    expect(code).toMatch(/견적\s*발송/);
    expect(code).toMatch(/발주\s*전환/);
    expect(code).toMatch(/입고\s*처리/);
    expect(code).toMatch(/재고\s*점검/);
  });

  it("OperatorQuickActions export + props 시그니처 보존", () => {
    expect(code).toMatch(/export\s+function\s+OperatorQuickActions/);
    expect(code).toMatch(/OperatorQuickActionsCounts/);
  });

  it("§11.364 D-1 — Progressive Disclosure 폐기 (순수 네비 강등)", () => {
    // §11.247 expand/aria-expanded 는 §11.364 D-1 역할 분리로 제거.
    expect(code).not.toMatch(/isQuoteDispatchExpanded/);
    expect(code).not.toMatch(/aria-expanded/);
  });

  it("count > 0 badge + href routing 보존", () => {
    expect(code).toMatch(/data-quick-action-badge/);
    expect(code).toMatch(/\/dashboard\/quotes/);
    expect(code).toMatch(/\/dashboard\/inventory/);
  });
});
