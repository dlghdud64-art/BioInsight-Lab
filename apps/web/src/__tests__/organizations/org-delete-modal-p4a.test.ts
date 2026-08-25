/**
 * §org-management-redesign P4a — 조직 삭제 type-to-confirm 모달 (dead button 봉합)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md Phase 4)
 *
 * ★ honesty: 기존 '조직 삭제' = disabled dead button(§10 위반) → canonical DELETE wire + type-to-confirm(오삭제 방지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§org-management-redesign P4a — 삭제 dead button 봉합 + canonical wire", () => {
  it("deleteOrgMutation = canonical DELETE /api/organizations/[id] (csrfFetch 경유)", () => {
    /* 승계 (2026-08-24 · 표현 완화 · 결정 무손상):
     * 옛 단언은 맨 `fetch(...)` 를 요구했다. 실물은 csrfFetch 로 **승격**됐다 —
     * 결정("canonical DELETE 를 부른다")은 그대로이고 CSRF 보호가 더해졌을 뿐이다.
     * 🛑 옛 단언을 그대로 두면 보호 없는 fetch 를 요구하는 셈이 된다.
     *    sentinel 이 깨지는 원인은 회귀만이 아니다 — 개선도 깨뜨린다. */
    expect(PAGE).toMatch(/deleteOrgMutation = useMutation/);
    expect(PAGE).toMatch(/csrfFetch\(`\/api\/organizations\/\$\{params\.id\}`, \{ method: "DELETE" \}\)/);
    /* 역방향 잠금 — 맨 fetch 로 되돌아가면 RED. 안 걸면 CSRF 승격이 무잠금이다.
     * (?<!csrf) 로 csrfFetch 자신은 제외한다 — §4원칙 ① 접두사 포함) */
    expect(PAGE).not.toMatch(/(?<!csrf)[Ff]etch\(`\/api\/organizations\/\$\{params\.id\}`, \{ method: "DELETE" \}\)/);
  });
  it("성공 시 목록 복귀(router.push)", () => {
    expect(PAGE).toMatch(/router\.push\("\/dashboard\/organizations"\)/);
  });
  it("삭제 버튼 = 모달 트리거 + 소유자 게이트(dead 아님)", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => \{ setDeleteConfirm\(""\); setDeleteModalOpen\(true\); \}\}/);
    expect(PAGE).toMatch(/disabled=\{!isOwner\}/);
  });
});

describe("§org-management-redesign P4a — type-to-confirm(오삭제 방지)", () => {
  it("조직명 정확 입력 시에만 영구 삭제 활성", () => {
    expect(PAGE).toMatch(/data-testid="org-delete-confirm"/);
    expect(PAGE).toMatch(/deleteConfirm\.trim\(\) !== \(organization\?\.name \?\? ""\)\.trim\(\)/);
  });
  it("삭제 확인 시 canonical mutation 호출(no-op 아님)", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => deleteOrgMutation\.mutate\(\)\}/);
  });
});
