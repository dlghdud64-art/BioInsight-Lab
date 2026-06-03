/**
 * §11.298f #workbench-search-radix-removal — _workbench/search/page.tsx 의
 *   Radix DropdownMenu dead import cleanup + application-wide grep 0 회복.
 *
 * 배경:
 * §11.298e sentinel test 가 "application-wide Radix wiring 0 완성"으로
 * 통과했지만, 실제로는 _workbench/search/page.tsx 의 import 가 잔존
 * (햄버거 메뉴 자체는 §11.283b 에서 plain swap, import 만 dead 상태).
 * §11.298e sentinel 의 `|| true` silent fail 패턴이 grep 매치를 가렸음.
 *
 * §11.298f 의 회복:
 * 1. _workbench/search/page.tsx 의 Radix import 제거 (~10 line)
 * 2. backup file (.full / .full2) 는 별도 batch §11.302 dead file
 *    cleanup 에서 처리 (본 sentinel 은 .tsx/.ts 만 스캔)
 * 3. 새 sentinel test — readFileSync 직접 검증 + execSync grep 대신
 *    Node.js FS 재귀 스캔 (Windows 호환)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const SEARCH_PAGE_SRC = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

// Node.js FS 재귀 스캔 — Windows 에서 grep 명령 없을 때 대체
function findFilesWithPattern(
  dir: string,
  pattern: RegExp,
  exts: string[],
  skip: string[] = ["node_modules", ".next", ".git", "dist", ".turbo"],
): string[] {
  const results: string[] = [];
  function walk(current: string) {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.includes(entry)) continue;
      const fullPath = join(current, entry);
      let s;
      try {
        s = statSync(fullPath);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(fullPath);
      } else if (exts.includes(extname(entry))) {
        try {
          const content = readFileSync(fullPath, "utf8");
          if (pattern.test(content)) results.push(fullPath);
        } catch {
          continue;
        }
      }
    }
  }
  walk(dir);
  return results;
}

const SRC_DIR = resolve(__dirname, "../../");

describe("§11.298f — _workbench/search/page.tsx Radix dead import cleanup", () => {
  it("§11.298f trace marker", () => {
    expect(SEARCH_PAGE_SRC).toMatch(/§11\.298f/);
  });

  it("Radix DropdownMenu import 완전 제거 (햄버거 자체는 §11.283b 에서 plain swap)", () => {
    expect(SEARCH_PAGE_SRC).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
    expect(SEARCH_PAGE_SRC).not.toMatch(/^\s*DropdownMenu,\s*$/m);
    expect(SEARCH_PAGE_SRC).not.toMatch(/^\s*DropdownMenuTrigger,\s*$/m);
    expect(SEARCH_PAGE_SRC).not.toMatch(/^\s*DropdownMenuContent,\s*$/m);
  });

  it("Radix DropdownMenu JSX 사용 완전 부재 (§11.283b 후 사용 0 보장)", () => {
    expect(SEARCH_PAGE_SRC).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
  });

  it("§11.283b 햄버거 plain state trace 보존 (§11.283b swap 후)", () => {
    expect(SEARCH_PAGE_SRC).toMatch(/§11\.283b 햄버거 메뉴 plain state/);
  });
});

describe("§11.298f — application-wide Radix wiring 0 회복 (Node.js FS 스캔)", () => {
  it("apps/web/src 전체 .tsx/.ts 에서 Radix dropdown-menu import 0", () => {
    // execSync grep 대신 Node.js FS — Windows 호환
    const matches = findFilesWithPattern(
      SRC_DIR,
      /from "@\/components\/ui\/dropdown-menu"/,
      [".tsx", ".ts"],
      // §11.356 — __tests__ 제외 (test 파일 내 단언 regex false positive). JSX 스캔과 정합.
      ["node_modules", ".next", ".git", "dist", ".turbo", "__tests__"],
    );
    expect(matches).toHaveLength(0);
  });

  it("apps/web/src 전체 .tsx/.ts 에서 Radix DropdownMenu JSX 사용 0", () => {
    // __tests__ 제외 (test 파일 내 regex 패턴이 false positive 발생)
    // components/ui/dropdown-menu.tsx 제외 (Radix re-export 정의 파일)
    const matches = findFilesWithPattern(
      SRC_DIR,
      /<DropdownMenu(?:Trigger|Content|Item|Label|Separator|CheckboxItem)?\s/,
      [".tsx", ".ts"],
      ["node_modules", ".next", ".git", "dist", ".turbo", "__tests__"],
    ).filter((f) => !f.includes("dropdown-menu.tsx"));
    expect(matches).toHaveLength(0);
  });
});
