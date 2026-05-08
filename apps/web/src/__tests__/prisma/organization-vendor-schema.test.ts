/**
 * #user-supplier-registration Phase 1 RED — OrganizationVendor schema test
 *
 * Goal: prisma schema 에 OrganizationVendor model 신설.
 *       organization 단위 supplier-book — 한국 연구실 단위 거래처 명단 정합.
 *
 * canonical truth lock:
 *   - OrganizationVendor.id (cuid)
 *   - organizationId / createdById relation (Cascade)
 *   - vendorId optional (platform Vendor 와 연결 가능 + inline-only 도 가능)
 *   - vendorName / vendorEmail / vendorPhone / notes / isPrimary
 *   - @@unique([organizationId, vendorEmail]) — 동일 조직 중복 차단
 *   - @@index([organizationId]) / @@index([vendorId])
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const source = readFileSync(SCHEMA_PATH, "utf8");

describe("#user-supplier-registration — OrganizationVendor schema", () => {
  it("OrganizationVendor model 존재", () => {
    expect(source).toMatch(/model OrganizationVendor\s*\{/);
  });

  it("id cuid 자동 생성", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?id\s+String\s+@id\s+@default\(cuid\(\)\)/);
  });

  it("organizationId String (NOT NULL) + relation Cascade", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?organizationId\s+String\b/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?organization\s+Organization\s+@relation\([\s\S]*?onDelete:\s*Cascade/);
  });

  it("vendorId optional + relation SetNull (platform Vendor 연결 가능)", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?vendorId\s+String\?/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?vendor\s+Vendor\?\s+@relation\([\s\S]*?onDelete:\s*SetNull/);
  });

  it("createdById + createdBy User relation (audit)", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?createdById\s+String\b/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?createdBy\s+User\s+@relation/);
  });

  it("operator-input field — vendorName String NOT NULL + vendorEmail String NOT NULL", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?vendorName\s+String\b(?!\?)/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?vendorEmail\s+String\b(?!\?)/);
  });

  it("optional metadata field — vendorPhone / notes / isPrimary", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?vendorPhone\s+String\?/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?notes\s+String\?/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?isPrimary\s+Boolean\s+@default\(false\)/);
  });

  it("createdAt + updatedAt timestamp", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?updatedAt\s+DateTime\s+@updatedAt/);
  });

  it("@@unique([organizationId, vendorEmail]) — 동일 조직 중복 차단", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?@@unique\(\[organizationId,\s*vendorEmail\]\)/);
  });

  it("@@index([organizationId]) + @@index([vendorId]) — query 성능", () => {
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?@@index\(\[organizationId\]\)/);
    expect(source).toMatch(/model OrganizationVendor[\s\S]*?@@index\(\[vendorId\]\)/);
  });

  it("Organization model 에 organizationVendors back-relation", () => {
    // canonical: OrganizationVendor.organization → Organization.organizationVendors
    expect(source).toMatch(/model Organization[\s\S]*?organizationVendors\s+OrganizationVendor\[\]/);
  });

  it("Vendor model 에 organizationLinks back-relation (vendorId optional)", () => {
    expect(source).toMatch(/model Vendor[\s\S]*?organizationLinks\s+OrganizationVendor\[\]/);
  });

  it("User model 에 createdOrganizationVendors back-relation (audit)", () => {
    expect(source).toMatch(/model User[\s\S]*?createdOrganizationVendors\s+OrganizationVendor\[\]/);
  });

  it("#user-supplier-registration 주석 marker (cluster trace)", () => {
    expect(source).toMatch(/#user-supplier-registration|user supplier registration|OrganizationVendor/i);
  });
});
