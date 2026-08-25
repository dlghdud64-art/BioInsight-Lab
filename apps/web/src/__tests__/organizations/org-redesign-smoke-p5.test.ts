/**
 * §org-management-redesign P5 — 반응형 감사 + end-to-end smoke (최종 종결)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 5)
 *
 * P1~P4a 정합 land smoke + 신규 표면 반응형 불변(375px 잘림 0).
 *
 * ⚠️ 목록 요약의 375px 수단은 2026-08-24 에 교체됐다 — 접기(flex-wrap) → 숨기기(hidden md:flex).
 *   호영님 승인 · §org-management-web P5. 근거는 해당 it 주석에 있다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIST = readFileSync(resolve(__dirname, "../../app/dashboard/organizations/page.tsx"), "utf8");
const DETAIL = readFileSync(resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"), "utf8");
const ODROPDOWN = readFileSync(resolve(__dirname, "../../components/organizations/odropdown.tsx"), "utf8");

describe("§org-management-redesign P5 — end-to-end smoke(P1~P4a)", () => {
  it("P1 — ODropdown 컴포넌트", () => {
    expect(ODROPDOWN).toMatch(/export function ODropdown/);
  });
  it("P2 — 목록 ODropdown 소비 + 요약 3축 + 단일 CTA", () => {
    /* 승계 (§org-management-web P5 2026-08-24 · 줄바꿈 허용). 요약이 검색 행으로
     * 흡수되며 `개 조직 · 멤버` 가 같은 줄이 아니게 됐다 — 3축은 그대로다. */
    expect(LIST).toMatch(/<ODropdown/);
    expect(LIST).toMatch(/개 조직 ·[\s\S]{0,40}?멤버/);
    expect(LIST).not.toMatch(/새로운 조직이 필요한가요/);
  });
  it("P3 — 상세 요약 바 + 활동 honesty(가짜 0)", () => {
    expect(DETAIL).toMatch(/멤버 <b className="text-slate-900">\{totalMembers\}<\/b>/);
    expect(DETAIL).toMatch(/활동 내역이 아직 없습니다/);
    expect(DETAIL).not.toMatch(/actor: "이매니저"/);
  });
  it("P4a — 삭제 type-to-confirm(dead button 봉합)", () => {
    expect(DETAIL).toMatch(/data-testid="org-delete-confirm"/);
    expect(DETAIL).toMatch(/deleteOrgMutation = useMutation/);
  });
});

describe("§org-management-redesign P5 — 신규 표면 반응형(375px 잘림 0)", () => {
  it("목록 요약 = 좁은 화면에서 숨긴다 (hidden md:flex)", () => {
    /* 🛑 재조준 — **결정 교체** (호영님 승인 2026-08-24 · §org-management-web P5).
     *
     * 옛 결정 (§org-management-redesign P5): 별도 요약 바를 두고 375px 에서 **접어서**
     *   보여준다 — /flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl/
     * 새 결정 (§org-management-web P5): 요약을 검색 행 우측 1줄로 흡수하고 좁은 화면에서는
     *   **숨긴다** — hidden md:flex + whitespace-nowrap
     *
     * 왜 바뀌었나: "한 줄짜리 사실에 카드 한 장을 쓰지 않는다" 는 이 트랙의 다른 결정들
     *   (정적 3카드 흡수 · 우측 280px 패널 제거)과 같은 방향이고, 375px 에서 세 카운트를
     *   접어 보여주는 것보다 검색·필터에 자리를 주는 편이 낫다고 판정됐다.
     *
     * 🔑 목적(375px 잘림 0)은 유지되고 **수단만** 교체됐다. 접기 → 숨기기.
     *   이건 표현 완화가 아니라 결정 교체라 사무국이 자기 선에서 처리하지 않고 승인을 받았다.
     *   다음 세션이 "왜 접기에서 숨기기로 바뀌었나" 를 되묻지 않도록 여기 남긴다. */
    expect(LIST).toMatch(/hidden md:flex items-center[\s\S]{0,80}?whitespace-nowrap/);
    /* 역방향 잠금 — 별도 요약 바(rounded-xl 래퍼)로 되돌아가면 RED.
     * 은퇴만 하면 새 결정이 무잠금이 된다. */
    expect(LIST).not.toMatch(/flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl/);
  });
  it("상세 요약 바 = flex-wrap", () => {
    expect(DETAIL).toMatch(/flex flex-wrap items-center gap-x-5 gap-y-2/);
  });
  it("삭제 모달 = sm:max-w(모바일 w-full 축소)", () => {
    expect(DETAIL).toMatch(/sm:max-w-\[440px\]/);
  });
  it("ODropdown = w-full(컨테이너 맞춤)", () => {
    expect(ODROPDOWN).toMatch(/w-full items-center gap-2 rounded-lg border/);
  });
});
