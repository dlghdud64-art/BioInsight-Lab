/**
 * §billing-redesign P2: 헤더 쉘 통일 · 폭 · 밑줄 탭 (호영님 핸드오프 2026-09-08).
 *
 * 닫는 결함 3건(전부 배포본 실측):
 *   ① 이 페이지만 구형 헤더(app/_components/page-header, 타이틀 아이콘 포함)를 써서
 *      기준 페이지(견적 관리 = components/layout AppPageHeader)와 쉘이 달랐다.
 *   ② 1000px 중앙 고정폭. 다른 페이지는 max-w-7xl 캔버스를 쓴다.
 *   ③ 칩형 3탭 중 2개가 Free 에서 빈 화면이었다. 들어가서 비어 있는 것을 보는 대신
 *      왜 못 들어가는지를 화면에 남긴다(비활성 + 사유 배지).
 *
 * 브레드크럼은 경로를 옮기지 않고 라벨 맵으로 닫는다(§11.337 audit 선례).
 *   경로에 없는 "대시보드" 단계를 지어내면 클릭할 곳이 없어 dead link 가 된다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const PAGE = read("src/app/billing/page.tsx");
const HEADER = read("src/components/dashboard/Header.tsx");

describe("§billing-redesign P2: 헤더 쉘", () => {
  it("기준 페이지와 같은 AppPageHeader, 구형 헤더 import 0", () => {
    expect(PAGE).toMatch(/import \{ AppPageHeader \} from "@\/components\/layout\/page-header"/);
    expect(PAGE).not.toMatch(/from "@\/app\/_components\/page-header"/);
  });

  it("타이틀 아이콘 0 (이 페이지에만 있던 장식)", () => {
    expect(PAGE).not.toMatch(/icon=\{CreditCard\}/);
    expect(PAGE).not.toMatch(/iconColor=/);
  });

  it("우측 보조 CTA = 영업팀 문의, 실경로로 이동(dead button 0)", () => {
    expect(PAGE).toMatch(/label: "영업팀 문의"/);
    expect(PAGE).toMatch(/router\.push\("\/support"\)/);
  });

  it("브레드크럼 라벨 = pathLabelMap 1줄 (경로 이동 0)", () => {
    expect(HEADER).toMatch(/billing: "청구 및 구독"/);
  });
});

describe("§billing-redesign P2: 폭", () => {
  it("중앙 고정폭 제거, 다른 페이지와 같은 max-w-7xl", () => {
    expect(PAGE).not.toMatch(/max-w-5xl mx-auto/);
    expect(PAGE).toMatch(/max-w-7xl mx-auto w-full/);
  });
});

describe("§billing-redesign P2: 밑줄 탭 + Free 잠금", () => {
  it("칩형(grid-cols-3) 제거, 밑줄 활성 표시", () => {
    expect(PAGE).not.toMatch(/grid w-full grid-cols-3/);
    expect(PAGE).toMatch(/border-b-2 border-transparent data-\[state=active\]:border-blue-600/);
  });

  it("탭 정의 단일점 + 첫 탭 라벨은 '플랜'", () => {
    expect(PAGE).toMatch(/const BILLING_TABS/);
    expect(PAGE).toMatch(/\{ value: "overview", label: "플랜" \}/);
    expect(PAGE).not.toMatch(/>개요</);
  });

  it("잠금은 entitlement 파생, 플랜명 하드코딩 분기 0", () => {
    expect(PAGE).toMatch(/const paidPlan = currentPlan !== "FREE"/);
    expect(PAGE).toMatch(/const locked = !paidPlan && tab\.paidOnly/);
    expect(PAGE).toMatch(/disabled=\{locked\}/);
  });

  it("사유 배지 2종이 잠긴 탭에 붙는다", () => {
    expect(PAGE).toMatch(/lockedReason: "유료 플랜부터"/);
    expect(PAGE).toMatch(/lockedReason: "청구 없음"/);
    expect(PAGE).toMatch(/\{tab\.lockedReason\}/);
  });
});
