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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

// §suite-red-cleanup: execSync grep → readFileSync walk 전환 (vitest 환경 execSync
//   STACK_TRACE 회피, smoke 패턴 정합). app-wide import 스캔은 정적 walk 로 대체.
function importHits(needle: string): string[] {
  const SCAN = resolve(REPO_ROOT, "apps/web/src");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if ((full.endsWith(".ts") || full.endsWith(".tsx")) && readFileSync(full, "utf8").includes(needle)) {
        hits.push(full);
      }
    }
  };
  walk(SCAN);
  return hits;
}
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
    expect(importHits('from "@/components/ui/dropdown-menu"')).toHaveLength(0);
  });

  it("application-wide @radix-ui/react-dropdown-menu import 0", () => {
    expect(importHits('from "@radix-ui/react-dropdown-menu"')).toHaveLength(0);
  });
});
