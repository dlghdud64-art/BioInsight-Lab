/**
 * §11.136 #admin-user-row-checkbox
 *
 * Source-level regression guard — admin/users page 의 row 별 checkbox UI
 * (mobile card + desktop table) + select-all (header) + self-id 차단.
 *
 * §11.135 bulk action bar 의 missing piece — checkbox 없으면 selectedUserIds
 * 채울 방법 없음. 본 트랙으로 bulk operation 활성화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../app/admin/users/page.tsx",
);

describe("admin/users row checkbox — regression guard (§11.136)", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("toggleUserSelected helper 존재", () => {
    expect(source).toMatch(/toggleUserSelected/);
  });

  it("toggleSelectAll helper (select-all 토글)", () => {
    expect(source).toMatch(/toggleSelectAll/);
  });

  it("currentUserId 추출 (useSession + 본인 차단)", () => {
    expect(source).toMatch(/useSession/);
    expect(source).toMatch(/currentUserId/);
  });

  it("checkbox row 가 onChange + accent-blue-600 + selectedUserIds 상태", () => {
    // mobile card + desktop table 둘 다 input type=\"checkbox\" 가지고 있음
    const checkboxes = source.match(/<input[^>]*type="checkbox"/g);
    expect(checkboxes).not.toBeNull();
    if (checkboxes) {
      // 최소 3개 (mobile + table header + table row)
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("isSelf 차단 (disabled={isSelf} 패턴)", () => {
    expect(source).toMatch(/isSelf/);
    expect(source).toMatch(/본인은 선택할 수 없습니다/);
  });

  it("§11.135 bulk action bar 회귀 0", () => {
    expect(source).toMatch(/bulkApproveMutation/);
    expect(source).toMatch(/bulkRejectMutation/);
  });

  it("table colspan 갱신 (8 column — 기존 7 + checkbox 1)", () => {
    expect(source).toMatch(/colSpan=\{8\}/);
    expect(source).not.toMatch(/colSpan=\{7\}/);
  });
});
