/**
 * §11.137 #admin-user-bulk-action-toast
 *
 * Source-level regression guard — admin/users page 의 mutation 들에 sonner
 * toast 통합. console.warn 만이었던 부분 실패 가시성 향상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/admin/users/page.tsx",
);

describe("admin/users sonner toast — regression guard (§11.137)", () => {
  const source = readFileSync(PATH, "utf8");

  it("sonner toast import", () => {
    expect(source).toMatch(/from "sonner"/);
    expect(source).toMatch(/\btoast\b/);
  });

  it("bulkApprove onSuccess: toast.success / toast.warning / toast.error 분기", () => {
    expect(source).toMatch(/toast\.success.*승인/);
    expect(source).toMatch(/toast\.warning.*부분 성공/);
  });

  it("bulkReject onSuccess: toast 분기", () => {
    expect(source).toMatch(/toast\.success.*반려/);
  });

  it("approveMutation + rejectMutation + restoreMutation toast (single-item)", () => {
    expect(source).toMatch(/toast\.success.*승인되었습니다/);
    expect(source).toMatch(/toast\.success.*반려되었습니다/);
    expect(source).toMatch(/toast\.success.*복구되었습니다/);
  });

  it("error 분기 — toast.error onError handler", () => {
    expect(source).toMatch(/onError.*toast\.error|toast\.error.*err\.message/);
  });

  it("§11.135 회귀 0 — bulk action bar 유지", () => {
    expect(source).toMatch(/bulkApproveMutation/);
    expect(source).toMatch(/bulkRejectMutation/);
  });
});
