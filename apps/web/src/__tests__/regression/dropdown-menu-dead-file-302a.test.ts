/**
 * §11.302a #dropdown-menu-dead-file — components/ui/dropdown-menu.tsx +
 *   @radix-ui/react-dropdown-menu package 제거 회귀 차단.
 *
 * 배경 (§11.298f 후속):
 * §11.298e application-wide Radix wiring 0 완성 → §11.298f silent fail
 * 회복 + _workbench/search/page.tsx import cleanup. 본 §11.302a 는
 * 그 위에서 dead file (components/ui/dropdown-menu.tsx) + dead package
 * (@radix-ui/react-dropdown-menu) 자체를 제거.
 *
 * 호영님 environment 에서:
 *   `git rm apps/web/src/components/ui/dropdown-menu.tsx`
 *   `npm install` (package-lock.json 자동 정리)
 *   `git commit` + push
 *
 * sandbox 는 파일 삭제 0 (CLAUDE.md prohibited actions — permanent
 * deletions 은 호영님 명시적 OK 필요). 본 sentinel test 는 호영님
 * push 후에만 통과.
 *
 * Out of Scope (§11.302b 별도 batch):
 * - backup file (inventory-content.tsx.full / .full2) 삭제 — 호영님
 *   명시적 OK 필요
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const DROPDOWN_MENU_FILE = resolve(
  REPO_ROOT,
  "apps/web/src/components/ui/dropdown-menu.tsx",
);
const PACKAGE_JSON_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/package.json"),
  "utf8",
);

describe("§11.302a — dropdown-menu.tsx dead file + package 제거", () => {
  it("§11.302a trace marker (commit draft 또는 sentinel 자체)", () => {
    // 본 sentinel file 자체에 trace marker 포함 (self-referential).
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.302a/);
  });

  it("apps/web/src/components/ui/dropdown-menu.tsx 파일 자체 부재", () => {
    expect(existsSync(DROPDOWN_MENU_FILE)).toBe(false);
  });

  it("apps/web/package.json 에서 @radix-ui/react-dropdown-menu entry 부재", () => {
    expect(PACKAGE_JSON_SRC).not.toMatch(/"@radix-ui\/react-dropdown-menu"/);
  });

  it("application-wide @/components/ui/dropdown-menu import 0 (silent fail 제거)", () => {
    let matches = "";
    try {
      matches = execSync(
        `grep -rE 'from "@/components/ui/dropdown-menu"' apps/web/src --include='*.tsx' --include='*.ts' -l`,
        { cwd: REPO_ROOT, encoding: "utf8" },
      ).trim();
    } catch (err: any) {
      // grep exit code 1 = no match (success). 다른 exit code 만 fail.
      if (err.status !== 1) throw err;
      matches = "";
    }
    expect(matches).toBe("");
  });

  it("application-wide @radix-ui/react-dropdown-menu import 0", () => {
    let matches = "";
    try {
      matches = execSync(
        `grep -rE 'from "@radix-ui/react-dropdown-menu"' apps/web/src --include='*.tsx' --include='*.ts' -l`,
        { cwd: REPO_ROOT, encoding: "utf8" },
      ).trim();
    } catch (err: any) {
      if (err.status !== 1) throw err;
      matches = "";
    }
    expect(matches).toBe("");
  });
});
