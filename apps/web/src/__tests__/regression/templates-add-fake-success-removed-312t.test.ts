/**
 * §11.312-templates → §placeholder-success-cleanup P3 승계 (2026-09-11)
 *
 * 원 명제(§11.312-templates): /templates 표면이 사용자를 속이지 않는다.
 *   그때의 형태 = "목록에 추가" fake 성공 toast 제거 · 미완 버튼 disabled · export/delete 보존.
 *
 * 승계 사유: 표면을 통째로 삭제했다(호영님 판정 a · §placeholder-success-audit 종결).
 *   "보존" 대상이던 두 핸들러가 곧 결함이었다 —
 *     delete → 저장 0 인데 "삭제 완료" 를 내던 placeholder success
 *     export → 하드코딩 4품목으로 진짜 xlsx 를 내던 mock
 *   /templates 로 가는 링크는 레포에 0건이었다(URL 직접 입력만 도달).
 *
 * 명제는 살아 있으므로 형태를 바꿔 잠근다: 표면이 없으면 속일 수도 없다.
 * 되살릴 때는 이 파일이 RED 가 된다 → 그때 진짜 저장(모델·마이그레이션)과 함께 재설계한다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(APP_WEB_ROOT, "src");

const REMOVED = [
  "src/app/templates/page.tsx",
  "src/app/api/templates/route.ts",
  "src/app/api/templates/[id]/route.ts",
  "src/app/api/templates/[id]/export/route.ts",
  "src/hooks/use-templates.ts",
  "src/components/products/quote-list-table.tsx",
  "src/lib/export/excel-generator.ts",
  "src/components/export/column-mapping-row.tsx",
];

function collectSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "generated") continue;
      collectSources(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const rel = (abs: string) => abs.slice(APP_WEB_ROOT.length + 1).split(sep).join("/");

describe("§11.312-templates 승계 — templates 표면 부재", () => {
  it("삭제한 8파일이 되살아나지 않는다", () => {
    expect(REMOVED.filter((f) => existsSync(join(APP_WEB_ROOT, f)))).toEqual([]);
  });

  it("소스 어디에서도 /api/templates 를 호출하지 않는다 (주석 제외)", () => {
    const offenders = collectSources(SRC).filter((f) =>
      /["'`]\/api\/templates\b/.test(stripComments(readFileSync(f, "utf8"))),
    );
    expect(offenders.map(rel)).toHaveLength(0);
  });

  it("CSRF 레지스트리에 삭제된 라우트가 남지 않는다 (주석 제외)", () => {
    const reg = stripComments(readFileSync(join(SRC, "lib/security/csrf-route-registry.ts"), "utf8"));
    expect(reg).not.toMatch(/['"]\/api\/templates/);
  });
});

describe("§11.312-templates 승계 — 회귀 0 (인접 보존)", () => {
  it("레지스트리의 이웃 highRisk 항목은 그대로다", () => {
    const reg = readFileSync(join(SRC, "lib/security/csrf-route-registry.ts"), "utf8");
    expect(reg).toMatch(/'\/api\/team\/\[id\]\/members'/);
    expect(reg).toMatch(/'\/api\/quotes\/\[id\]'/);
  });
});
