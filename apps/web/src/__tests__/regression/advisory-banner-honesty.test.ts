/**
 * #advisory-banner-honesty — 비교/견적 advisory 배너 정직화 + 톤 단일소스 sentinel
 *   (§번호 호영님 배정 — 잔여 정리 큐, 2026-06-11)
 *
 * 호영님 결정: 삭제 아님 → 리스타일(규칙 보존) + 좌/우 비대칭 해소.
 *   - "권장 nag" → "시스템 규칙" 톤. 규칙 의미(비교 확정 → 견적 요청 순서) 보존.
 *   - 경고색 → 정보 톤 (blocker 아니라 advisory).
 *   - 톤은 엔진(flagTone) 단일 소스 — 한쪽만 바뀌는 drift 차단.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ENGINE = "src/app/_workbench/_components/request-readiness.ts";
const REVIEW_WINDOW = "src/app/_workbench/_components/request-review-window.tsx";
const CART_PANEL = "src/app/_workbench/_components/quote-cart-panel.tsx";
const SEARCH = "src/app/_workbench/search/page.tsx";

describe("#advisory-banner-honesty — 엔진 (카피·타입·게이트)", () => {
  it("advisory 타입 신설 + 비교 검토 flag 가 advisory", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/"advisory"/);
    expect(src).toMatch(/type: "advisory",\s*\n\s*label: "비교 검토 진행 중"/);
  });

  it("카피 — nag 제거, 시스템 규칙 톤 (규칙 의미 보존)", () => {
    const src = read(ENGINE);
    expect(src).not.toMatch(/최적 후보 확정 후 요청 권장/);
    expect(src).toMatch(/비교 확정 → 견적 요청 순서로 진행됩니다/);
  });

  it("status 게이트 보존 — advisory 도 review 상태 유지 (규칙 실효)", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/f\.type === "review_required" \|\| f\.type === "advisory"/);
  });

  it("flagTone 단일 소스 — 4타입 톤 매핑 (advisory=blue 정보)", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/export function flagTone/);
    expect(src).toMatch(/case "advisory":[\s\S]{0,120}blue/);
    expect(src).not.toMatch(/amber-/);
  });
});

describe("#advisory-banner-honesty — 소비처 합류 (drift 차단)", () => {
  it("검토 윈도 — flagTone 사용 (자체 색 분기 제거)", () => {
    const src = read(REVIEW_WINDOW);
    expect(src).toMatch(/flagTone\(flag\.type\)\.badge/);
  });

  it("견적함 패널 — tone 승계 + advisory=blue 보더 분기", () => {
    const src = read(CART_PANEL);
    expect(src).toMatch(/tone\?: "review_required" \| "advisory"/);
    expect(src).toMatch(/flag\.tone === "advisory" \? "border-l-blue-400" : "border-l-yellow-400"/);
  });

  it("search 전달부 — advisory 포함 + tone 승계 (견적함 노출 소실 drift 차단)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/f\.type === "review_required" \|\| f\.type === "advisory"/);
    expect(src).toMatch(/tone: nonPriceReview\.type === "advisory"/);
  });
});

describe("#advisory-banner-honesty — 회귀 0", () => {
  it("엔진 기존 flag 보존 (공급사 없음·가격 미확인·카탈로그·스펙)", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/공급사 없음/);
    expect(src).toMatch(/가격 미확인/);
    expect(src).toMatch(/카탈로그 번호 없음/);
    expect(src).toMatch(/스펙 미상세/);
  });

  it("hard_blocker red·review yellow 톤 보존", () => {
    const src = read(ENGINE);
    expect(src).toMatch(/case "hard_blocker":[\s\S]{0,120}red/);
    expect(src).toMatch(/case "review_required":[\s\S]{0,120}yellow/);
  });
});
