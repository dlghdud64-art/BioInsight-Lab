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

  it("toast 어댑터 import (§global-toast — sonner 흡수)", () => {
    /* 🔄 재조준 (2026-08-21) — 옛 축은 `from "sonner"` 였다.
     *    8/21 핸드오프가 sonner 를 흡수해 @/lib/toast 어댑터로 1본화했다.
     *    잠글 것은 "토스트를 쓰는가" 이지 "어느 라이브러리를 쓰는가" 가 아니다 —
     *    라이브러리는 결정으로 바뀌었고 토스트 사용은 보존됐다. */
    expect(source).toMatch(/from ["']@\/lib\/toast["']/);
    expect(source).toMatch(/\btoast\b/);
    // 🛑 역방향 — sonner 직접 import 재유입 0
    expect(source).not.toMatch(/from ["']sonner["']/);
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
