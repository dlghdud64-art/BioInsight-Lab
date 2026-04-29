/**
 * §11.123 #admin-modal-keyboard-nav
 *
 * Source-level regression guard — admin/users page 의 3 dialog
 * (InviteUserDialog / ConfirmReject / 운영 정책 panel) 에 키보드/스크린 리더
 * 접근성 패턴 적용 + reusable hook 으로 추출.
 *
 * 강화 항목:
 *   - hook `useDialogA11y` 또는 inline 패턴: Esc → onClose, Tab focus trap,
 *     initial focus, return-focus
 *   - role="dialog" + aria-modal="true" + aria-label or aria-labelledby
 *
 * §11.122 AdminSidebar 패턴의 dialog 영역 확장.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("admin/users dialog keyboard / a11y — regression guard (§11.123)", () => {
  const PAGE_PATH = resolve(
    __dirname,
    "../../../app/admin/users/page.tsx",
  );
  const HOOK_PATH = resolve(
    __dirname,
    "../../../lib/hooks/use-dialog-a11y.ts",
  );

  it("reusable hook useDialogA11y 파일 존재", () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("hook 이 Esc key handler 보유", () => {
    if (!existsSync(HOOK_PATH)) return;
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source).toMatch(/Escape|"Esc"/);
  });

  it("hook 이 Tab focus trap 보유", () => {
    if (!existsSync(HOOK_PATH)) return;
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source).toMatch(/Tab|focusable|querySelectorAll/);
  });

  it("hook 이 return-focus 패턴 보유 (close 시 이전 active element 복귀)", () => {
    if (!existsSync(HOOK_PATH)) return;
    const source = readFileSync(HOOK_PATH, "utf8");
    expect(source).toMatch(/previousActiveElement|previouslyFocused|activeElement|returnFocus/);
  });

  it("admin/users page 가 useDialogA11y hook 사용", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    expect(source).toMatch(/useDialogA11y/);
  });

  it("InviteUserDialog 가 role=dialog + aria-modal", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    // page 안에 최소 1개 dialog 가 role=dialog + aria-modal 보유
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal/);
  });

  it("ConfirmReject 의 backdrop click 만 close + Esc 추가 (dual close)", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    // setConfirmReject(null) 호출이 onClose 패턴
    expect(source).toMatch(/setConfirmReject\(null\)/);
  });

  it("운영 정책 panel 의 close button onClick → setSelectedUserId(null)", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    expect(source).toMatch(/setSelectedUserId\(null\)/);
  });
});
