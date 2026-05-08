/**
 * #user-supplier-registration Phase 4 RED — Settings suppliers page contract
 *
 * Goal: `/dashboard/settings/suppliers` page 신설.
 *       OrganizationVendor 등록 / 편집 / 삭제 + table view.
 *
 * canonical truth lock:
 *   - 'use client' directive (mutation + dialog)
 *   - default export (Next.js page convention)
 *   - useQuery로 GET /api/organization-vendors 호출
 *   - useMutation으로 POST/PATCH/DELETE 호출 (invalidate 정합)
 *   - Dialog form (등록/편집) — vendorName / vendorEmail required
 *   - Table view: 이름 / 이메일 / 전화 / isPrimary / actions
 *   - 한국어 라벨 + 빈 상태 처리 + a11y
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/settings/suppliers/page.tsx");

describe("#user-supplier-registration Phase 4 — Settings suppliers page", () => {
  it("page file 존재", () => {
    expect(existsSync(PAGE_PATH)).toBe(true);
  });
});

describe("#user-supplier-registration Phase 4 — page contract", () => {
  if (!existsSync(PAGE_PATH)) return;
  const source = readFileSync(PAGE_PATH, "utf8");

  it("'use client' directive (mutation + dialog 필요)", () => {
    expect(source).toMatch(/^["']use client["']/);
  });

  it("default export (Next.js page convention)", () => {
    expect(source).toMatch(/export\s+default\s+function/);
  });

  it("useQuery로 /api/organization-vendors GET", () => {
    expect(source).toMatch(/useQuery/);
    expect(source).toMatch(/\/api\/organization-vendors/);
  });

  it("useMutation으로 POST / PATCH / DELETE", () => {
    expect(source).toMatch(/useMutation/);
    expect(source).toMatch(/method:\s*["']POST["']/);
    expect(source).toMatch(/method:\s*["']PATCH["']/);
    expect(source).toMatch(/method:\s*["']DELETE["']/);
  });

  it("queryClient.invalidateQueries (mutation 후 refetch)", () => {
    expect(source).toMatch(/invalidateQueries/);
  });

  it("Dialog 컴포넌트 사용 (등록/편집 form)", () => {
    expect(source).toMatch(/<Dialog/);
    expect(source).toMatch(/onOpenChange/);
  });

  it("vendorName / vendorEmail input field", () => {
    expect(source).toMatch(/vendorName/);
    expect(source).toMatch(/vendorEmail/);
  });

  it("vendorPhone / notes / isPrimary optional field", () => {
    expect(source).toMatch(/vendorPhone/);
    expect(source).toMatch(/notes/);
    expect(source).toMatch(/isPrimary/);
  });

  it("table view 또는 list view (이름 / 이메일 / actions)", () => {
    // canonical: 거래처 list 노출
    expect(source).toMatch(/<table|<ul|grid|map\(/);
  });

  it("한국어 라벨 ('공급사' / '거래처' / '추가' / '편집' / '삭제')", () => {
    expect(source).toMatch(/공급사|거래처/);
    expect(source).toMatch(/추가|등록/);
    expect(source).toMatch(/편집|수정/);
    expect(source).toMatch(/삭제/);
  });

  it("빈 상태 처리 (empty state — 첫 등록 유도)", () => {
    expect(source).toMatch(/등록된.*없|empty|아직|첫\s*공급사|거래처를 추가/);
  });

  it("toast 사용 (성공/실패 알림)", () => {
    expect(source).toMatch(/useToast|toast\(/);
  });

  it("#user-supplier-registration 주석 marker", () => {
    expect(source).toMatch(/#user-supplier-registration|user-supplier-registration|공급사 관리/i);
  });

  it("CSRF fetch 사용 (mutation 정합)", () => {
    expect(source).toMatch(/csrfFetch/);
  });
});
