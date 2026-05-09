/**
 * #api-inventory-mutation-info-leak — Phase 1 RED
 *
 * Goal: 2 mutation endpoint 의 inventory ownership check 0 — 어떤 user 든
 *       어떤 inventory 든 사용 기록 생성 / 알림 trigger 가능 (multi-tenant
 *       write leak 위험) 차단.
 *
 * canonical truth lock:
 *   - usage/route.ts POST: inventoryId 받은 후 inventory fetch + isOwner OR
 *     isOrgMember 검증 후 inventoryUsage.create + productInventory.update 진행.
 *     검증 실패 시 403.
 *   - alerts/send/route.ts POST: alertSetting fetch 후 alertSetting.inventory
 *     의 ownership 검증 (isOwner OR isOrgMember). 검증 실패 시 403.
 *   - 둘 다 vendor-requests cluster 패턴 (isOwner short-circuit, organizationId
 *     nullable graceful) mirror.
 *
 * Out of scope (별도 sub-trial):
 *   - read scope auto-org sweep (auto-reorder / reorder-recommendations /
 *     export-labels) — 별도 cluster.
 *   - inventoryAlertSetting 자체의 ownership check 추가 (alertSetting.userId
 *     검증) — 본 cluster 는 inventory 만 우선.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const USAGE_PATH = resolve(__dirname, "../../../app/api/inventory/usage/route.ts");
const ALERTS_PATH = resolve(__dirname, "../../../app/api/inventory/alerts/send/route.ts");
const usage = readFileSync(USAGE_PATH, "utf8");
const alerts = readFileSync(ALERTS_PATH, "utf8");

describe("#api-inventory-mutation-info-leak — usage POST ownership", () => {
  it("inventoryUsage.create 전에 productInventory.findUnique 호출 (ownership 검증용)", () => {
    // create call 위치 + findUnique 호출 위치 확인 — findUnique 가 먼저.
    const createIdx = usage.search(/inventoryUsage\.create/);
    const findIdx = usage.search(/productInventory\.findUnique/);
    expect(findIdx).toBeGreaterThan(0);
    expect(findIdx).toBeLessThan(createIdx);
  });

  it("OrganizationMember.findFirst 분기 추가 (multi-user organization 정합)", () => {
    expect(usage).toMatch(/organizationMember\.findFirst/);
  });

  it("isOwner OR isOrgMember 키워드 (cluster pattern)", () => {
    expect(usage).toMatch(/isOwner|isOrgMember/);
  });

  it("Forbidden 403 분기 추가", () => {
    expect(usage).toMatch(/status:\s*403/);
  });

  it("cluster trace marker", () => {
    expect(usage).toMatch(/#api-inventory-mutation-info-leak|info leak|조직 멤버|organization member/);
  });

  it("기존 inventoryUsage.create / productInventory.update 본 경로 보존", () => {
    expect(usage).toMatch(/inventoryUsage\.create/);
    expect(usage).toMatch(/productInventory\.update/);
  });
});

describe("#api-inventory-mutation-info-leak — alerts/send POST ownership", () => {
  it("alertSetting.inventory ownership check (OrganizationMember.findFirst)", () => {
    expect(alerts).toMatch(/organizationMember\.findFirst/);
  });

  it("isOwner OR isOrgMember 키워드", () => {
    expect(alerts).toMatch(/isOwner|isOrgMember/);
  });

  it("Forbidden 403 분기 추가", () => {
    expect(alerts).toMatch(/status:\s*403/);
  });

  it("cluster trace marker", () => {
    expect(alerts).toMatch(/#api-inventory-mutation-info-leak|info leak|조직 멤버|organization member/);
  });

  it("기존 alertSetting fetch + sendEmail 본 경로 보존", () => {
    expect(alerts).toMatch(/inventoryAlertSetting\.findUnique/);
    expect(alerts).toMatch(/sendEmail/);
  });
});
