/**
 * §11.302e-1 #inventory-summary-block-dead — inventory-summary-block.tsx
 *   dead file 삭제 회귀 차단.
 *
 * 배경 (§11.302d 시리즈 종결 후 audit 발견):
 * InventorySummaryBlock component (apps/web/src/app/dashboard/inventory/
 * blocks/inventory-summary-block.tsx) 가 application-wide 사용처 0:
 *   - 자기 file 정의 + §11.302d-2 sentinel mention (comment trace) 만
 *   - import statement 0 매치
 *   - 4-card widget (전체 품목 / 부족 위험 / 만료 임박 / 최근 변동)
 *     — 호영님 spec "재고 KPI 3개" 와 라벨 불일치, 별도 widget
 *
 * 호영님 결정 (2026-05-25): "권장 고" — A (파일 삭제)
 *   §11.302a (dropdown-menu.tsx) / §11.302b (backup file) 패턴 정합.
 *
 * sandbox 자동 삭제 0 — CLAUDE.md prohibited actions (permanent
 * deletions). 호영님 환경 git rm 후 본 sentinel 통과.
 *
 * Out of Scope:
 *   inventory-main Lot 추적 widget (line 1885-1898) — "P2 개발 예정"
 *   placeholder, 호영님 spec 외 보존 (C 옵션).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const DEAD_FILE = resolve(
  REPO_ROOT,
  "apps/web/src/app/dashboard/inventory/blocks/inventory-summary-block.tsx",
);
const SRC_DIR = resolve(__dirname, "../../");

// Node.js FS 재귀 스캔 (§11.298f 패턴, Windows 호환)
function findFilesWithPattern(
  dir: string,
  pattern: RegExp,
  exts: string[],
  skip: string[] = ["node_modules", ".next", ".git", "dist", ".turbo", "__tests__"],
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

describe("§11.302e-1 — inventory-summary-block.tsx dead file 삭제", () => {
  it("§11.302e-1 trace marker (self-referential sentinel)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.302e-1/);
  });

  it("apps/web/src/app/dashboard/inventory/blocks/inventory-summary-block.tsx 파일 부재", () => {
    expect(existsSync(DEAD_FILE)).toBe(false);
  });

  it("application-wide InventorySummaryBlock import 0 (회귀 차단)", () => {
    const matches = findFilesWithPattern(
      SRC_DIR,
      /import\s*\{[^}]*InventorySummaryBlock[^}]*\}|from\s*"[^"]*inventory-summary-block"/,
      [".tsx", ".ts"],
    );
    expect(matches).toHaveLength(0);
  });

  it("application-wide <InventorySummaryBlock JSX 사용 0", () => {
    const matches = findFilesWithPattern(
      SRC_DIR,
      /<InventorySummaryBlock\s*\/?>/,
      [".tsx", ".ts"],
    );
    expect(matches).toHaveLength(0);
  });
});
