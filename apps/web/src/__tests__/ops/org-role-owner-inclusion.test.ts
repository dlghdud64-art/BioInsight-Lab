/**
 * §team-org-role-model Phase 1 — 조직 role 판정에서 `OWNER` 가 빠지지 않는다
 *
 * 배경 (실측 2026-08-12):
 *   `role: "OWNER"` 를 DB 에 쓰는 코드가 repo 전수 0 이라 OWNER 는 유령이었다.
 *   그 상태에서 **OWNER 를 빠뜨린 판정이 16곳** 자라났다(서버 13 · 클라이언트 3).
 *
 *   🛑 순서 역전 위험 — OWNER 부여를 먼저 하면, 그 순간부터 조직 생성자가
 *      안전지출·SDS·보안설정 표면에서 **403** 을 받는다. 지금은 ADMIN 이라 통과하므로
 *      **OWNER 도입이 곧 권한 상실**이 된다. 그래서 Phase 1(판정 확대)이 먼저다.
 *
 * 계약:
 *   O1. `in: [OrganizationRole...]` 배열에 ADMIN 이 있으면 OWNER 도 있다
 *   O2. `role: OrganizationRole.ADMIN` **단독 where** 가 없다 (최고 권한자를 막는 형태)
 *   O3. Phase 1 에서 고친 16곳이 되돌아가지 않는다 (파일별 OWNER 존재)
 *   O4. 수집이 실제로 동작한다 (공허 GREEN 방지)
 *
 * ⚠️ 이 sentinel 의 본체는 **재발 차단**이다. 다음에 누가 조직 role 판정을 추가할 때
 *   또 빠뜨린다 — 그때 여기서 걸린다.
 *
 * ⚠️ 범위: `OrganizationRole` 만 본다. `WorkspaceMember`(별도 모델·별도 enum)와
 *   `TeamRole` 은 대상이 아니다 — PLAN §1-I "대상 아님" 표 참조.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(WEB_ROOT, "src");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const rel = (f: string) => f.slice(WEB_ROOT.length + 1).split("\\").join("/");

const FILES = walk(SRC)
  .map((f) => ({ path: rel(f), code: stripComments(readFileSync(f, "utf8")) }))
  .filter((f) => f.code.includes("OrganizationRole"));

/**
 * 알려진 예외 — **dead file 이라 고치지 않았다.**
 *   `components/upgrade/upgrade-modal.tsx` 는 importer 0 이다(실측). 라이브 판본은
 *   `components/billing/upgrade-modal.tsx` 이며 그쪽에는 이 판정 자체가 없다.
 *   dead file 을 고치면 §render-reachability 위반(2026-08-06 재발 사고와 동형)이므로
 *   **손대지 않고 여기에 기록**한다. 파일이 되살아나면 예외에서 빼고 고쳐야 한다.
 */
const DEAD_FILE_EXCEPTIONS = ["src/components/upgrade/upgrade-modal.tsx"];

describe("§org-role-owner O4 — 수집이 실제로 동작한다", () => {
  it("OrganizationRole 을 쓰는 파일이 충분히 모인다", () => {
    expect(FILES.length).toBeGreaterThan(15);
  });
  it("예외 목록의 dead file 이 실재한다 (사라지면 예외를 지워야 한다)", () => {
    for (const p of DEAD_FILE_EXCEPTIONS) {
      expect(FILES.some((f) => f.path === p)).toBe(true);
    }
  });
});

describe("§org-role-owner O1 — in:[] 배열에 ADMIN 이 있으면 OWNER 도 있다", () => {
  it("OWNER 누락 배열 0", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (DEAD_FILE_EXCEPTIONS.includes(f.path)) continue;
      const arrays = f.code.match(/in:\s*\[[^\]]*OrganizationRole[^\]]*\]/g) ?? [];
      for (const arr of arrays) {
        if (arr.includes("OrganizationRole.ADMIN") && !arr.includes("OrganizationRole.OWNER")) {
          offenders.push(`${f.path} :: ${arr.replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§org-role-owner O2 — ADMIN 단독 where 가 없다", () => {
  it("role: OrganizationRole.ADMIN 단독 지정 0", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (DEAD_FILE_EXCEPTIONS.includes(f.path)) continue;
      // `role: OrganizationRole.ADMIN,` — 배열도 비교도 아닌 단일 값 지정
      if (/role:\s*OrganizationRole\.ADMIN\s*,/.test(f.code)) offenders.push(f.path);
    }
    expect(offenders).toEqual([]);
  });
});

describe("§org-role-owner O3 — Phase 1 교정 16곳 회귀 0", () => {
  /** 서버 13 + 클라이언트 3. 각 파일에서 OWNER 판정이 사라지면 RED. */
  const FIXED = [
    "src/app/api/safety-spend/route.ts",
    "src/app/api/safety-spend/unmapped/route.ts",
    "src/app/api/safety/spend/export/route.ts",
    "src/app/api/safety/spend/map/route.ts",
    "src/app/api/safety/spend/summary/route.ts",
    "src/app/api/safety/spend/unmapped/route.ts",
    "src/app/api/products/[id]/safety/route.ts",
    "src/app/api/products/[id]/sds/route.ts",
    "src/app/api/safety/products/route.ts",
    "src/app/api/safety/sds/route.ts",
    "src/app/api/sds/[id]/apply/route.ts",
    "src/app/api/sds/[id]/extract/route.ts",
    "src/app/api/organizations/[id]/security/route.ts",
    "src/app/admin/safety/page.tsx",
    "src/app/settings/audit/page.tsx",
    "src/app/settings/security/page.tsx",
  ];

  it("16곳 전부가 OrganizationRole.OWNER 를 판정에 포함한다", () => {
    const missing = FIXED.filter((p) => {
      const f = FILES.find((x) => x.path === p);
      return !f || !f.code.includes("OrganizationRole.OWNER");
    });
    expect(missing).toEqual([]);
  });

  it("목록이 16곳이다 (축소되면 은폐 — 늘리는 것은 허용)", () => {
    expect(FIXED.length).toBe(16);
  });
});
