/**
 * §ko-ux ② — settings 영문 대문자 라벨 한글화 회귀 가드 (호영님 P1)
 *
 * 규칙(호영님 확정):
 *   - topRightLabel 영문 배지 → 한글화(의미 보존: 누가 관리하는가).
 *       SELF-MANAGED→직접 관리 / ASSIGNED BY ADMIN→관리자 지정 /
 *       AUDIT TRAIL→감사 추적(메뉴 통일) / ADMIN ONLY→관리자 전용.
 *   - 본라벨과 중복되는 영문 보조부제(AUTO-GENERATED ID, FINANCIAL BASE) → 제거.
 *   - billing 영문(Current Plan / Next Billing Date / Monthly Cost) → 한글화.
 *   - 기술약어(CSV/MSDS/QR/COA/SDS/API/Lot/ID/KRW)는 영문 유지(검사 안 함).
 *   - 주석의 영문(§ 히스토리)은 보존 — prop 값 형태(topRightLabel="...")만 검사.
 *
 * 방법: readFileSync + regex (격리 node → operator 실 vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SETTINGS_PATH = "src/app/dashboard/settings/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§ko-ux ② — settings topRightLabel 한글화", () => {
  it("영문 배지 prop 제거 (주석 히스토리는 보존, prop 값만 검사)", () => {
    const src = read(SETTINGS_PATH);
    expect(src).not.toMatch(/topRightLabel="SELF-MANAGED"/);
    expect(src).not.toMatch(/topRightLabel="ASSIGNED BY ADMIN"/);
    expect(src).not.toMatch(/topRightLabel="AUDIT TRAIL"/);
    expect(src).not.toMatch(/topRightLabel="ADMIN ONLY"/);
  });

  it("한글 배지로 치환", () => {
    const src = read(SETTINGS_PATH);
    expect(src).toMatch(/topRightLabel="직접 관리"/);
    expect(src).toMatch(/topRightLabel="관리자 지정"/);
    expect(src).toMatch(/topRightLabel="감사 추적"/);
    expect(src).toMatch(/topRightLabel="관리자 전용"/);
  });
});

describe("§ko-ux ② — 중복 영문 보조부제 제거", () => {
  it("AUTO-GENERATED ID / FINANCIAL BASE 부제 제거 (본라벨로 충분)", () => {
    const src = read(SETTINGS_PATH);
    expect(src).not.toMatch(/AUTO-GENERATED ID/);
    expect(src).not.toMatch(/FINANCIAL BASE/);
  });

  it("승인 권한 (LIMITS) → 승인 한도", () => {
    const src = read(SETTINGS_PATH);
    expect(src).not.toMatch(/승인 권한 \(LIMITS\)/);
    expect(src).toMatch(/승인 한도/);
  });

  it("영문 eyebrow 'Workspace Canonical Identity' 렌더 제거 (라이브 smoke 발견)", () => {
    const src = read(SETTINGS_PATH);
    // 렌더 mixed-case 제거 (대문자 주석 § 히스토리는 보존).
    expect(src).not.toMatch(/Workspace Canonical Identity/);
  });
});

describe("§ko-ux ② — billing 영문 한글화", () => {
  it("Current Plan / Next Billing Date / Monthly Cost 제거", () => {
    const src = read(SETTINGS_PATH);
    expect(src).not.toMatch(/Current Plan/);
    expect(src).not.toMatch(/Next Billing Date/);
    expect(src).not.toMatch(/Monthly Cost/);
  });

  it("한글 치환", () => {
    const src = read(SETTINGS_PATH);
    expect(src).toMatch(/현재 플랜/);
    expect(src).toMatch(/다음 청구일/);
    expect(src).toMatch(/월 비용/);
  });
});

describe("§ko-ux ② GUARD — 회귀 0 (canonical 값·기술약어·본라벨 보존)", () => {
  it("canonical workspace 표시 보존 (§11.373 무회귀)", () => {
    const src = read(SETTINGS_PATH);
    expect(src).toMatch(/\{wsName\}/);
    expect(src).toMatch(/\{wsSlug\}/);
    expect(src).toMatch(/\{planSubLabel\}/);
    expect(src).toMatch(/워크스페이스 명칭/);
    expect(src).toMatch(/워크스페이스 코드/);
    expect(src).toMatch(/기본 통화/);
  });

  it("기술약어 KRW 통화 표기 보존", () => {
    const src = read(SETTINGS_PATH);
    expect(src).toMatch(/KRW \(₩\)/);
  });
});
