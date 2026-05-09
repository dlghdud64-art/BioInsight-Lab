/**
 * #pilot-organization-vendor-seed-missing — Phase 1 RED
 *
 * Goal: pilot 6 vendor 가 Vendor 테이블에는 있지만 OrganizationVendor 매핑이
 *       없어 settings/suppliers UI 에 노출 0 인 마찰 (M1) 차단.
 *
 * canonical truth lock:
 *   - pilot.ts: `PILOT_ORGANIZATION_VENDOR_LINKS` export — 6 mapping
 *     ({organizationId: PILOT_ORG_ID, vendorId: vendor-pilot-*}).
 *   - pilot-seed.ts: `tx.organizationVendor.upsert` call 존재 (source-level
 *     grep) — vendor.upsert 와 함께 6회 시드.
 *   - cleanup: OrganizationVendor 는 Organization onDelete: Cascade 로 자동
 *     정리 — pilot-cleanup.ts 별도 op 불필요 (schema lock 검증).
 *   - vendorEmail: PILOT_VENDOR_CATALOG.email 과 일치 (pilot vendor 6개 모두
 *     unique .invalid placeholder, conflict 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PILOT_VENDOR_CATALOG,
  PILOT_ORG_ID,
  PILOT_OWNER_USER_ID,
  PILOT_ORGANIZATION_VENDOR_LINKS,
} from "@/../scripts/pilot/pilot";

const SEED_PATH = resolve(__dirname, "../../../../scripts/pilot/pilot-seed.ts");
const SCHEMA_PATH = resolve(__dirname, "../../../../prisma/schema.prisma");

const seedSource = readFileSync(SEED_PATH, "utf8");
const schemaSource = readFileSync(SCHEMA_PATH, "utf8");

describe("#pilot-organization-vendor-seed-missing — pilot.ts spec", () => {
  it("PILOT_ORGANIZATION_VENDOR_LINKS export 존재", () => {
    expect(PILOT_ORGANIZATION_VENDOR_LINKS).toBeDefined();
    expect(Array.isArray(PILOT_ORGANIZATION_VENDOR_LINKS)).toBe(true);
  });

  it("PILOT_VENDOR_CATALOG 의 모든 vendor 가 1:1 매핑됨 (6 row)", () => {
    expect(PILOT_ORGANIZATION_VENDOR_LINKS.length).toBe(
      PILOT_VENDOR_CATALOG.length,
    );
  });

  it("모든 mapping 의 organizationId 가 PILOT_ORG_ID", () => {
    for (const link of PILOT_ORGANIZATION_VENDOR_LINKS) {
      expect(link.organizationId).toBe(PILOT_ORG_ID);
    }
  });

  it("모든 mapping 의 vendorId 가 PILOT_VENDOR_CATALOG 와 매칭", () => {
    const pilotVendorIds = new Set(PILOT_VENDOR_CATALOG.map((v) => v.id));
    for (const link of PILOT_ORGANIZATION_VENDOR_LINKS) {
      expect(pilotVendorIds.has(link.vendorId)).toBe(true);
    }
  });

  it("모든 mapping 의 createdById 가 PILOT_OWNER_USER_ID", () => {
    for (const link of PILOT_ORGANIZATION_VENDOR_LINKS) {
      expect(link.createdById).toBe(PILOT_OWNER_USER_ID);
    }
  });

  it("vendorEmail 이 PILOT_VENDOR_CATALOG.email 과 일치", () => {
    const emailByVendorId = new Map(
      PILOT_VENDOR_CATALOG.map((v) => [v.id, v.email]),
    );
    for (const link of PILOT_ORGANIZATION_VENDOR_LINKS) {
      const expected = emailByVendorId.get(link.vendorId);
      if (expected) {
        expect(link.vendorEmail).toBe(expected);
      }
    }
  });

  it("vendorEmail 이 unique (organizationId+vendorEmail compound unique 정합)", () => {
    const emails = PILOT_ORGANIZATION_VENDOR_LINKS.map((l) => l.vendorEmail);
    const unique = new Set(emails);
    expect(unique.size).toBe(emails.length);
  });
});

describe("#pilot-organization-vendor-seed-missing — pilot-seed.ts source", () => {
  it("organizationVendor.upsert call 존재", () => {
    expect(seedSource).toMatch(/organizationVendor\.upsert/);
  });

  it("PILOT_ORGANIZATION_VENDOR_LINKS import 또는 reference", () => {
    expect(seedSource).toMatch(/PILOT_ORGANIZATION_VENDOR_LINKS/);
  });

  it("compound unique key (organizationId_vendorEmail) where 절 사용", () => {
    expect(seedSource).toMatch(/organizationId_vendorEmail/);
  });
});

describe("#pilot-organization-vendor-seed-missing — schema lock", () => {
  it("OrganizationVendor.organization onDelete: Cascade (cleanup 자동)", () => {
    const orgVendorBlock = schemaSource.match(
      /model OrganizationVendor \{[\s\S]*?\n\}/,
    )?.[0];
    expect(orgVendorBlock).toBeDefined();
    expect(orgVendorBlock).toMatch(
      /organization\s+Organization[\s\S]*?onDelete:\s*Cascade/,
    );
  });

  it("compound unique (organizationId, vendorEmail) 존재", () => {
    const orgVendorBlock = schemaSource.match(
      /model OrganizationVendor \{[\s\S]*?\n\}/,
    )?.[0];
    expect(orgVendorBlock).toMatch(/@@unique\(\[organizationId,\s*vendorEmail\]\)/);
  });
});
