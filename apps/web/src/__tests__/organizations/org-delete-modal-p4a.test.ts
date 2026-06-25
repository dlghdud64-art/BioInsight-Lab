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
  it("deleteOrgMutation = canonical DELETE /api/organizations/[id]", () => {
    expect(PAGE).toMatch(/deleteOrgMutation = useMutation/);
    expect(PAGE).toMatch(/fetch\(`\/api\/organizations\/\$\{params\.id\}`, \{ method: "DELETE" \}\)/);
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
