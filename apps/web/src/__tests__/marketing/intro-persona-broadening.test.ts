/**
 * §intro-persona-broadening — 마케팅 페르소나 직무명→포괄 역할 + 타겟 산업 폭 명시 sentinel
 *
 * 호영님 결정(2026-06-16): intro/landing 페르소나 "연구원"(직무, 학술 편향) → "연구·QC 담당"
 *   (포괄 역할, QC·실험실 포함). + intro 소개 섹션에 타겟 산업 폭 1줄(ICP 명시).
 *
 * 가드: 마케팅 페르소나(표시 레이어) ≠ ontology system role(요청자/승인권자/조직관리자).
 *   네이밍 변경은 display only — role enum 미변경.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const INTRO = read("src/app/intro/page.tsx");
const ROLE_VALUE = read("src/app/_components/role-value-section.tsx");
const ROLE_SUMMARY = read("src/app/_components/landing-role-summary.tsx");

describe("§intro-persona-broadening — 직무명→포괄 역할", () => {
  it("intro 섹션 D — '연구·QC 담당'로 포괄(직무명 role:\"연구원\" 제거)", () => {
    expect(INTRO).toMatch(/role: "연구·QC 담당"/);
    expect(INTRO).not.toMatch(/role: "연구원"/);
  });
  it("구매 담당 / 운영 관리자 페르소나 보존(회귀 0)", () => {
    expect(INTRO).toMatch(/role: "구매 담당"/);
    expect(INTRO).toMatch(/role: "운영 관리자"/);
  });
  it("landing 컴포넌트 2종 동일 포괄화", () => {
    expect(ROLE_VALUE).toMatch(/role: "연구·QC 담당"/);
    expect(ROLE_VALUE).not.toMatch(/role: "연구원"/);
    expect(ROLE_SUMMARY).toMatch(/role: "연구·QC 담당"/);
    expect(ROLE_SUMMARY).not.toMatch(/role: "연구원"/);
  });
});

describe("§intro-persona-broadening — 타겟 산업 폭(ICP)", () => {
  it("intro 소개 섹션에 산업 폭 1줄 명시", () => {
    expect(INTRO).toMatch(/바이오텍 · 제약 · 진단 · CRO · 대학\/병원 연구실의 구매 운영/);
  });
});

describe("§intro-persona-broadening — 가드(페르소나 ≠ system role)", () => {
  it("intro 페이지에 ontology role enum 재정의 0(표시 레이어만)", () => {
    expect(INTRO).not.toMatch(/REQUESTER|APPROVER|ORG_ADMIN/);
  });
});
