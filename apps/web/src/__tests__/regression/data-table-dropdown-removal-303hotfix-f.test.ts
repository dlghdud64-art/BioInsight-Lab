/**
 * §11.303-hotfix-f #data-table-dropdown-removal — components/ui/data-table.tsx
 *   Radix DropdownMenu 의존 제거 + native checkbox + role="menu" swap.
 *
 * 🚨 Critical (§11.303-hotfix 시리즈 진짜 root cause):
 * §11.302a 으로 apps/web/src/components/ui/dropdown-menu.tsx + @radix-ui/
 *   react-dropdown-menu package 가 삭제됐는데, components/ui/data-table.tsx
 *   는 여전히 `import { DropdownMenu, ... } from "@/components/ui/dropdown-menu"`
 *   호출 → Vercel build 에서 TypeScript module resolution fail:
 *     Type error: Cannot find module '@/components/ui/dropdown-menu'
 *
 * §11.298e ActionMenu swap batch 에서 inventory / organizations / workspace 는
 *   ActionMenu shared component (apps/web/src/components/inventory/action-menu.tsx)
 *   으로 정리됐지만, data-table.tsx (generic reusable component) 는 누락.
 *
 * §11.298f sentinel 의 "application-wide Radix DropdownMenu grep 0" 검증이
 *   false-positive 였음 — data-table.tsx 가 빠져 있었음. 본 sentinel 으로
 *   재발 차단.
 *
 * Fix:
 *   - line 16: ChevronDown dead import 제거 (사용처 0)
 *   - line 19-24: Radix DropdownMenu* import 4 개 제거
 *   - line 89-115: <DropdownMenu>...</DropdownMenu> block 을
 *     plain <Button> + useState(viewOptionsOpen) + 조건부 backdrop +
 *     role="menu" + role="menuitemcheckbox" + native <input type="checkbox">
 *     으로 swap (§11.283b / §11.298e 패턴 정합)
 *   - column.toggleVisibility(!!value) 호출 보존
 *   - "보기 옵션" text / Settings2 icon / h-7 gap-1.5 text-xs 스타일 보존
 *
 * Test scope:
 *   1. data-table.tsx 에서 Radix import 0
 *   2. plain button + role="menu" + role="menuitemcheckbox" 사용
 *   3. column.toggleVisibility / column.getIsVisible 호출 보존
 *   4. §11.298f application-wide sentinel 보강 (data-table 포함)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
/* ⛔ 파일 종속 상수 은퇴 (2026-08-19) — data-table.tsx 를 삭제했다.
 *    삭제 사유: importer 0 · 대체물 없음 · UTF-16LE 로 저장돼 도구가 못 읽던 파일.
 *    🛑 삭제 전 실사를 했다 — UTF-8 로 변환한 뒤 아래 단언들을 돌려
 *       "숨어 있던 위반" 이 있는지 먼저 확인했고 **6/6 GREEN, 위반 0** 이었다.
 *       a857683d 의 수정은 제대로 land 했고 인코딩 때문에 검증만 못 되고 있었다.
 *       (변환 전 6 passed 는 공허 통과였다 — utf8 로 읽으면 /export/ 조차 매칭되지 않았다.)
 *    → 이 파일의 항구적 가치는 아래 **app-wide walk** 이고 그건 그대로 남는다. */

describe("§11.303-hotfix-f — data-table.tsx Radix DropdownMenu 제거", () => {
  it("§11.303-hotfix-f trace marker (self-referential sentinel)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.303-hotfix-f/);
  });

  // §suite-red-cleanup 재앵커: data-table.tsx 의 view-options(컬럼 가시성) 메뉴는
  //   후속 리팩터로 완전 제거됨(§11.303-hotfix-f trace 주석·plain-button 메뉴·
  //   column visibility toggle UI 모두 삭제). 본 sentinel 의 항구적 가치 =
  //   Radix DropdownMenu 의존 0(data-table + app-wide). 제거된 feature positive 는 은퇴.

  /* ⛔ 은퇴 (2026-08-19) — data-table.tsx 파일 종속 단언 3건
   *    (import 0 · JSX 0 · ChevronDown 0). 대상 파일이 없어졌으므로 지킬 것이 없다.
   *    정책(Radix DropdownMenu 의존 0)은 아래 app-wide walk 이 계속 잠근다 —
   *    그쪽이 더 넓고, 애초에 이 sentinel 이 §11.298f 의 누락을 고치려고 만든 축이다. */

  // §11.298e plain-button 메뉴 + column visibility toggle UI describe 는 view-options
  //   feature 제거로 은퇴(위 재앵커 주석 참조). anti-Radix guard 만 유지.

  describe("§11.298f application-wide Radix DropdownMenu sentinel 보강", () => {
    // §11.298f 의 grep 이 false-positive 였던 것을 보강.
    // apps/web/src 전체에서 @/components/ui/dropdown-menu import 0 + Radix
    // package import 0 검증 (node_modules / .next / dist 제외).
    const SCAN_ROOT = resolve(REPO_ROOT, "apps/web/src");
    const EXCLUDE_DIRS = new Set([
      "node_modules",
      ".next",
      "dist",
      "build",
      "coverage",
      "__tests__",
    ]);
    const TARGET_EXTS = [".ts", ".tsx", ".js", ".jsx"];

    function walk(dir: string, acc: string[] = []): string[] {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return acc;
      }
      for (const name of entries) {
        if (EXCLUDE_DIRS.has(name)) continue;
        const full = join(dir, name);
        let s;
        try {
          s = statSync(full);
        } catch {
          continue;
        }
        if (s.isDirectory()) {
          walk(full, acc);
        } else if (TARGET_EXTS.some((ext) => full.endsWith(ext))) {
          acc.push(full);
        }
      }
      return acc;
    }

    const files = walk(SCAN_ROOT);

    it("apps/web/src 전체에서 @/components/ui/dropdown-menu import 0", () => {
      const offenders: string[] = [];
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        if (/from\s+["']@\/components\/ui\/dropdown-menu["']/.test(src)) {
          offenders.push(f.replace(REPO_ROOT + "/", ""));
        }
      }
      expect(offenders).toEqual([]);
    });

    it("apps/web/src 전체에서 @radix-ui/react-dropdown-menu import 0", () => {
      const offenders: string[] = [];
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        if (/from\s+["']@radix-ui\/react-dropdown-menu["']/.test(src)) {
          offenders.push(f.replace(REPO_ROOT + "/", ""));
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
