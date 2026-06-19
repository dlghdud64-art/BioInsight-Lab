/**
 * §pricing-refresh P5b (PLAN_pricing-refresh) — "운영자"→"사용자" 사용자 노출 전수(ⓐ)
 *
 * 호영님 룰링 ⓐ: USER 티어 표시명·UI 텍스트 = "사용자". org 권한 role(소유자/관리자/…)은 별개 보존.
 *   - settings ROLE_LABELS.USER "운영자 (Operator)"→"사용자 (User)" + 식별/메뉴 UI 텍스트.
 *   - admin/orders·workbench·console role_operator·faq 사용자.
 *   - 주석의 "운영자"는 사용자 노출 0 이라 검사 제외(false positive 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const SET = read("app/dashboard/settings/page.tsx");
const FAQ = read("app/faq/page.tsx");
const ADMIN = read("app/admin/orders/page.tsx");
const WB = read("app/_workbench/quote/request/page.tsx");
const CONSOLE = read("lib/work-queue/console-v1-productization.ts");

describe("§pricing-refresh P5b — settings USER 티어 + UI 사용자", () => {
  it("ROLE_LABELS.USER + roleLabel fallback = 사용자 (User)", () => {
    expect(SET).toMatch(/USER: "사용자 \(User\)"/);
    expect(SET).toMatch(/\|\| "사용자 \(User\)"/);
  });
  it("메뉴/식별 UI 텍스트 = 사용자", () => {
    expect(SET).toMatch(/label: "사용자 및 워크스페이스"/);
    expect(SET).toMatch(/title="사용자 식별 정보"/);
    expect(SET).toMatch(/label="사용자 성명"/);
    expect(SET).toMatch(/사용자 권한, 온톨로지 엔진/);
  });
});

describe("§pricing-refresh P5b — 기타 사용자 노출 교체", () => {
  it("faq/admin/workbench/console 사용자", () => {
    expect(FAQ).toMatch(/조직 사용자 등/);
    expect(ADMIN).toMatch(/사용자 \/ 조직/);
    expect(WB).toMatch(/사용자가 직접 결정/);
    expect(CONSOLE).toMatch(/role_operator: "사용자"/);
  });
});

describe("§pricing-refresh P5b — org 권한 role 보존(별개 라벨셋)", () => {
  it("settings ROLE_LABELS — ADMIN/RESEARCHER 보존", () => {
    expect(SET).toMatch(/ADMIN: "관리자 \(Admin\)"/);
    expect(SET).toMatch(/RESEARCHER: "연구실 관리자/);
  });
  it("console work-queue role — 요청자/승인자 보존", () => {
    expect(CONSOLE).toMatch(/role_requester: "요청자"/);
    expect(CONSOLE).toMatch(/role_approver: "승인자"/);
  });
});
