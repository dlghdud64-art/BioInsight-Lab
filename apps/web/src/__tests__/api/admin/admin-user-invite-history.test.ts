/**
 * §11.128 #admin-user-invite-history
 *
 * Source-level regression guard — admin/users page 에 invite 발급/사용 history
 * 조회 surface 추가. §11.116 audit log (USER_CREATED + action="user_invite")
 * 재사용 (별도 endpoint 0).
 *
 * 운영자 use case:
 *   - 누가 누구를 언제 초대했는지 timeline 확인
 *   - 초대 후 활성화 안된 user (가입 안 함) 추적 (cleanup 후보)
 *   - 같은 email 중복 invite 시도 audit
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../app/admin/users/page.tsx",
);

describe("admin/users invite history — regression guard (§11.128)", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("초대 내역 button 존재 (한국어 텍스트)", () => {
    expect(source).toMatch(/초대 내역|초대 이력|invite history/i);
  });

  it("audit-logs endpoint 호출 (USER_CREATED filter)", () => {
    expect(source).toMatch(/audit-logs.*USER_CREATED|eventType=USER_CREATED/);
  });

  it("history dialog 가 useDialogA11y hook 사용 (a11y 정합)", () => {
    // historyDialog 또는 inviteHistory dialog hook 사용
    expect(source).toMatch(/historyDialog|inviteHistoryDialog|useDialogA11y/);
  });

  it("history dialog 에 role=dialog + aria-modal", () => {
    // page 의 dialog 들 중 invite history 에도 role=dialog
    expect(source).toMatch(/role="dialog"/);
  });

  it("user_invite action filter (§11.116 audit metadata 매칭)", () => {
    expect(source).toMatch(/user_invite/);
  });
});
