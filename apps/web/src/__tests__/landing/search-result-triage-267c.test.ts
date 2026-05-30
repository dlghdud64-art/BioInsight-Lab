/**
 * §11.267c search result triage source guard — ⚠️ OBSOLETE (§11.324 supersede)
 *
 * 원본 spec (Agent Board):
 *   비로그인 /search 랜딩에 Exact Match / Cross-Vendor Equivalent / Substitute /
 *   Blocked 4 카드 + Shortlist/Hold/Exclude + Step 2/3 + same-canvas compare
 *   진입로 노출.
 *
 * §11.324 supersede (호영님 P2, 2026-05-30, A안 정합):
 *   비로그인 랜딩 = 가치 제안 + 가입 유도 페이지. Triage 데모 (실제 사용 UI) 노출은
 *   인지 부하 + dead button 위험 + 가입 conversion 저해. 호영님 spec 결정:
 *   - Triage 4 카드 + Shortlist/Hold/Exclude + Step 2/3 button 전체 제거
 *   - 3단계 다이어그램 (검색/비교/견적) + 큰 가입 CTA "무료로 시작하기 — 30초 가입"
 *   - 본 §11.267c spec 의도 자체가 §11.324 와 정면 충돌 → describe.skip 처리
 *
 * 새 sentinel (§11.324 정합):
 *   `__tests__/regression/landing-search-triage-cleanup-324.test.ts`
 *   - search-result-triage / search-step-2/3 / publicTriage* 잔존 0 단언
 *   - landing-search-flow-steps + landing-search-primary-cta 신규 단언
 *   - 상단 띠 + 히어로 + 검색 예시 canonical 보존
 *
 * Rollback path (§11.324 revert 시):
 *   describe.skip → describe 로 복원 + §11.324 sentinel 삭제
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe.skip("§11.267c /search result triage — OBSOLETE (§11.324 supersede)", () => {
  it("pins the sourcing triage surface on the search page", () => {
    expect(page).toMatch(/data-testid="search-result-triage"/);
    expect(page).toMatch(/Sourcing Result Triage/);
    expect(page).toMatch(/검색 후보를 비교·보류·제외로 바로 분류합니다/);
  });

  it("shows the four required triage groups with counts", () => {
    expect(page).toMatch(/title: "Exact Match"[\s\S]{0,120}count: 4/);
    expect(page).toMatch(/title: "Cross-Vendor Equivalent"[\s\S]{0,120}count: 3/);
    expect(page).toMatch(/title: "Substitute"[\s\S]{0,120}count: 2/);
    expect(page).toMatch(/title: "Blocked"[\s\S]{0,120}count: 1/);
    expect(page).toMatch(/\{group\.count\}건/);
  });

  it("keeps blocked candidates visibly separated with a reason", () => {
    expect(page).toMatch(/badge: "차단"/);
    expect(page).toMatch(/blockedReason: "차단 사유:/);
    expect(page).toMatch(/data-testid="search-triage-blocked-reason"/);
    expect(page).toMatch(/border-red-200 bg-red-50 text-red-700/);
  });

  it("exposes direct candidate actions and same-canvas compare entry", () => {
    expect(page).toMatch(/"Shortlist", "Hold", "Exclude"/);
    expect(page).toMatch(/handleTriageAction\(action, group\.title\)/);
    expect(page).toMatch(/data-testid="search-triage-compare-panel"/);
    expect(page).toMatch(/비교 진입: 같은 캔버스 우측 패널 전환/);
    expect(page).toMatch(/같은 화면에서 비교 패널이 열리고/);
  });

  it("keeps Step 2 and Step 3 as inline CTAs without an active overlay", () => {
    expect(page).toMatch(/data-testid="search-triage-action-dock"/);
    expect(page).toMatch(/data-testid="search-step-2-compare"/);
    expect(page).toMatch(/Step 2 제품 비교/);
    expect(page).toMatch(/data-testid="search-step-3-request"/);
    expect(page).toMatch(/Step 3 견적 요청/);
    expect(page).toMatch(/data-testid="search-triage-live-state"/);
    expect(page).not.toMatch(/<Dialog open=/);
  });
});
