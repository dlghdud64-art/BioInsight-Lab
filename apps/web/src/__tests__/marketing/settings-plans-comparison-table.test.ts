/**
 * #settings-plans-comparison-table-redesign — RED test
 *
 * settings/plans 의 비교표 column 라벨 + 정량 swap 검증.
 * - column 라벨: "Team" / "Business" → "Lab Team" / "R&D Operations"
 *   (PLAN_DESCRIPTOR.label single source 정합)
 * - "팀원 수" row: 1명 / 5명 / 15명 / 무제한 (fake "무제한" 제거)
 * - "품목 등록 수" row: 10 / 50 / 200 / 무제한 (§pricing-redesign 2026-06-27, 표기=enforce 정합)
 *
 * canonical truth:
 *   - PLAN_DESCRIPTOR.{starter,team,business,enterprise}.seatsRecommended
 *     / operatingVolume.inventoryItems single source
 *   - SubscriptionPlan enum 변경 0 (display layer 만)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SETTINGS = "src/app/dashboard/settings/plans/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#settings-plans-comparison-table-redesign — column 라벨 정합", () => {
  it("'Lab Team' column header (Team → Lab Team swap)", () => {
    const src = read(SETTINGS);
    // <th>Lab Team</th> 또는 PLAN_DESCRIPTOR.team.label 사용
    expect(src).toMatch(/<th[^>]*>[\s\S]*?Lab\s*Team[\s\S]*?<\/th>|PLAN_DESCRIPTOR\.team\.label/);
  });

  it("'R&D Operations' column header (Business → R&D Operations swap)", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/<th[^>]*>[\s\S]*?R&D\s*Operations[\s\S]*?<\/th>|PLAN_DESCRIPTOR\.business\.label|\{"R&D\s*Operations"\}/);
  });

  it("영문 단독 'Team' / 'Business' column header 폐기", () => {
    const src = read(SETTINGS);
    // <th>Team</th> 단독 (Lab Team 의 일부 X — 강한 boundary)
    expect(src).not.toMatch(/<th[^>]*>\s*Team\s*<\/th>/);
    expect(src).not.toMatch(/<th[^>]*>\s*Business\s*<\/th>/);
  });
});

describe("#settings-plans-comparison-table-redesign — 정량 row 정합", () => {
  it("'팀원 수' row — descriptor.{intent}.seatsRecommended single source 통과", () => {
    const src = read(SETTINGS);
    // 팀원 수 row 안에 정량 4 값 또는 PLAN_DESCRIPTOR.X.seatsRecommended 직접 사용
    expect(src).toMatch(/팀원\s*수[\s\S]*?(1\s*명[\s\S]*?5\s*명[\s\S]*?15\s*명|PLAN_DESCRIPTOR\.starter\.seatsRecommended[\s\S]*?PLAN_DESCRIPTOR\.team\.seatsRecommended[\s\S]*?PLAN_DESCRIPTOR\.business\.seatsRecommended)/);
  });

  it("'품목 등록 수' row — descriptor.{intent}.operatingVolume.inventoryItems single source 통과", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/품목\s*등록\s*수[\s\S]*?(10[\s\S]*?50[\s\S]*?200|PLAN_DESCRIPTOR\.starter\.operatingVolume\.inventoryItems[\s\S]*?PLAN_DESCRIPTOR\.team\.operatingVolume\.inventoryItems[\s\S]*?PLAN_DESCRIPTOR\.business\.operatingVolume\.inventoryItems)/);
  });

  it("'팀원 수' Business column — fake '무제한' 폐기 (descriptor 정합)", () => {
    const src = read(SETTINGS);
    // 팀원 수 row 안에 정량 또는 descriptor 사용 (fake '무제한' 단독 0)
    expect(src).toMatch(/팀원\s*수[\s\S]*?(15\s*명|PLAN_DESCRIPTOR\.business\.seatsRecommended)/);
  });

  it("'품목 등록 수' Business column — 200 정량 (fake '무제한' 폐기, §pricing-redesign)", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/품목\s*등록\s*수[\s\S]*?(200|PLAN_DESCRIPTOR\.business\.operatingVolume\.inventoryItems)/);
  });
});

describe("#settings-plans-comparison-table-redesign — canonical 보호", () => {
  it("SubscriptionPlan enum 변경 0 (display layer 만)", () => {
    const src = read(SETTINGS);
    // SubscriptionPlan.FREE / TEAM / ORGANIZATION 그대로 사용
    expect(src).toMatch(/SubscriptionPlan\.FREE/);
    expect(src).toMatch(/SubscriptionPlan\.TEAM/);
    expect(src).toMatch(/SubscriptionPlan\.ORGANIZATION/);
  });

  it("PLAN_DESCRIPTOR import (single source)", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/PLAN_DESCRIPTOR/);
  });

  it("#settings-plans-comparison-table-redesign 코멘트 명시", () => {
    const src = read(SETTINGS);
    expect(src).toMatch(/#settings-plans-comparison-table-redesign|comparison-table-redesign|비교표.*4\s*column/);
  });
});
