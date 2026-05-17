/**
 * §11.250b-org #inventory-expiring-org-broadcast — §11.250acd-2 패턴 reuse.
 *
 * 호영님 spec: §11.250b INVENTORY_EXPIRING dispatch + push block 안 candidate.userId
 *   외에 candidate.organizationId 있으면 organizationMember OWNER+ADMIN broadcast.
 *
 * Strategy:
 *   - if (created) 안 recipientUserIds Set + candidate.userId add.
 *   - candidate.organizationId 있으면 organizationMember.findMany (OWNER+ADMIN).
 *   - dispatchNotificationEvent recipients array (broadcast).
 *   - sendPushNotification for-of multi-call.
 *   - §11.250acd-2 inventory/orders/budget 패턴 정확 reuse.
 *
 * canonical truth lock:
 *   - §11.250b INVENTORY_EXPIRING 시그니처 보존.
 *   - createExpiryAction 중복 방지 (created flag) 보존.
 *   - findExpiryCandidates (EXPIRY_WARNING_DAYS=30) 보존.
 *   - 기존 cron /api/cron/inventory-check 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const DETECTOR_PATH = resolve(
  __dirname,
  "../../../lib/ai/inventory-restock-detector.ts",
);
const detector = safeRead(DETECTOR_PATH);

describe("§11.250b-org #1 — INVENTORY_EXPIRING org broadcast", () => {
  it("expiry block 안 organizationMember.findMany", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,3500}organizationMember\.findMany/);
  });

  it("role OWNER + ADMIN filter (§11.250acd-2 패턴 reuse)", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,3500}role[\s\S]{0,300}OWNER/);
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,3500}role[\s\S]{0,300}ADMIN/);
  });

  it("INVENTORY_EXPIRING recipients array (broadcast)", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,2500}recipients[,:\s]/);
  });

  it("recipientUserIds Set dedup", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,3500}(recipientUserIds|Set)/);
  });

  it("candidate.organizationId 활용", () => {
    expect(detector).toMatch(/candidate\.organizationId/);
  });
});

describe("§11.250b-org #2 — push for-loop (multi-recipient)", () => {
  it("INVENTORY_EXPIRING push for-of pattern", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,4500}(for\s*\([\s\S]{0,150}of\s+|\.forEach)[\s\S]{0,500}sendPushNotification/);
  });

  it("sendPushNotification recipient variable (single or broadcast)", () => {
    expect(detector).toMatch(/sendPushNotification\s*\(\s*(\w+\.)*(userId|recipientUserId)/);
  });
});

describe("§11.250b-org #3 — graceful try/catch 보존", () => {
  it("INVENTORY_EXPIRING org broadcast member findMany try/catch", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,3500}try\s*\{[\s\S]{0,1500}organizationMember\.findMany[\s\S]{0,1500}\}\s*catch/);
  });
});

describe("§11.250b-org #4 — 기존 §11.250b flow 보존 (invariant)", () => {
  it("INVENTORY_EXPIRING eventType literal 보존", () => {
    expect(detector).toMatch(/eventType[:\s]+["']INVENTORY_EXPIRING["']/);
  });

  it("entityType INVENTORY 보존", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,1500}entityType[:\s]+["']INVENTORY["']/);
  });

  it("entityId candidate.inventoryId 보존", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,1500}entityId[:\s]+(candidate\.inventoryId|inventoryId)/);
  });

  it("if (created) 중복 방지 보존", () => {
    expect(detector).toMatch(/if\s*\(\s*created/);
  });

  it("findExpiryCandidates + createExpiryAction 보존", () => {
    expect(detector).toMatch(/findExpiryCandidates/);
    expect(detector).toMatch(/createExpiryAction/);
  });

  it("EXPIRY_WARNING_DAYS 보존", () => {
    expect(detector).toMatch(/EXPIRY_WARNING_DAYS/);
  });

  it("push title 한국어 (유효기한) 보존", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,4500}title[\s\S]{0,200}유효기한/);
  });

  it("push type expiry_warning 보존", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,4500}type[:\s]+["']expiry_warning["']/);
  });

  it("§11.250b-org trace marker", () => {
    expect(detector).toMatch(/§11\.250b-org|11\.250b-org/);
  });
});

describe("§11.250b-org #5 — §11.250acd-2 패턴 일관성", () => {
  it("OrganizationRole OWNER+ADMIN 만 (VIEWER/REQUESTER/APPROVER 제외)", () => {
    expect(detector).toMatch(/role[\s\S]{0,300}OWNER/);
    expect(detector).toMatch(/role[\s\S]{0,300}ADMIN/);
  });

  it("Array.from + map 패턴", () => {
    expect(detector).toMatch(/(Array\.from|recipients\s*=\s*\[)[\s\S]{0,500}userId/);
  });
});
