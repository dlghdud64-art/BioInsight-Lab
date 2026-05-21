/**
 * §11.267c search result triage source guard
 *
 * Agent Board asked for the public /search results area to expose a real
 * sourcing triage surface: Exact Match, Cross-Vendor Equivalent, Substitute,
 * and Blocked, with visible counts, blocked reason, direct row actions, and a
 * same-canvas compare entry.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.267c /search result triage", () => {
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
