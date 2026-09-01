/**
 * §invite-flow Phase 1 — org-scope 호출자 인벤토리 센티널
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1 🔴 / Phase 2 종료 조건)
 *   정답지: docs/plans/inventory/org-scope-callers.md (Phase 0, origin/main ce14fa84 실측)
 *
 * 잠그는 것: "선택의 거처" 우회 금지.
 *   API 축 — organizationId 없는 `organizationMember.findFirst({ where: { userId } })` 직접 호출 0
 *            (활성 조직은 resolveActiveOrganizationId 경유)
 *   UI 축 — `orgs[0] | organizations[0] | memberships[0]` 직접 선택 0
 *            (활성 조직은 useActiveOrganization() 경유)
 *
 * RGR: **래칫(ratchet) 게이트** — baseline GREEN 을 유지하면서 Phase 2 를 지킨다.
 *   🛑 처음 판본은 `expect(violations).toEqual([])` 로 Phase 1 에서 의도된 RED 였다.
 *      그러면 Phase 2 (35파일 기계적 치환, 이 트랙에서 가장 위험한 구간) 내내 게이트가
 *      RED 라 **신규 위반이 섞여 들어와도 구분되지 않는다** — 상시 RED 는 다음 진짜 RED 를
 *      가린다(§11.163·§11.172 부채에서 방금 겪은 형태).
 *   그래서 정답지(Phase 0 실측)를 **파일별 상한**으로 들고, 그보다 늘면 RED 로 간다:
 *      ① 신규 unscoped 호출 · 새 파일 → 즉시 RED (Phase 2 중에도 살아 있는 가드)
 *      ② 총계는 줄기만 한다(래칫) — 치환이 진행될수록 상한을 내린다
 *      ③ Phase 2 종료 = 상한 전부 0 → 이 파일은 그대로 `[]` 게이트가 된다
 *   ⚠️ 키는 **파일 단위**다. 줄 번호로 잡으면 Phase 2 의 편집으로 무관한 항목까지 밀려
 *      오탐이 난다(치환 안 한 줄이 위로 밀리는 것은 위반이 아니다).
 *
 * 판별기 주의(Phase 0 실측): where 절은 **brace 매칭**으로 잘라야 한다.
 *   라인 창 휴리스틱은 `select:{organizationId}` 오인(과소)·where 밖 사용 오인(누락) 2회 오판했다.
 * 부정 단언은 주석 제거본에 건다(서술 축 오탐 방지 — CLAUDE.md · feedback_negative_sentinel_strip_comments).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..", "..");

/** 정당한 직접 호출 보유자 — resolver·훅 자신 (fallback 조회의 거처) */
const ALLOWLIST = [
  join("lib", "organizations", "active-org.ts"),
  join("hooks", "use-active-organization.ts"),
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

/** 행 번호 보존형 — 블록 주석은 개행만 남긴다 (violation 의 파일:줄 이 실제 소스와 일치). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/** findFirst 호출의 where 절을 brace 매칭으로 잘라 organizationId 부재를 판정한다. */
function unscopedFindFirstLines(src: string): number[] {
  const out: number[] = [];
  const re = /organizationMember\s*\.\s*findFirst/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const tail = src.slice(m.index, m.index + 1200);
    const w = tail.indexOf("where");
    if (w < 0 || w > 600) {
      out.push(lineOf(src, m.index)); // where 없는 findFirst 도 unscoped
      continue;
    }
    const ob = tail.indexOf("{", w);
    if (ob < 0) {
      out.push(lineOf(src, m.index));
      continue;
    }
    let depth = 0;
    let seg = "";
    for (let j = ob; j < tail.length; j++) {
      const ch = tail[j];
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          seg = tail.slice(ob, j + 1);
          break;
        }
      }
    }
    if (!/organizationId/.test(seg)) out.push(lineOf(src, m.index));
  }
  return out;
}

const FILES = walk(SRC_ROOT).filter(
  (p) => !ALLOWLIST.some((a) => p.endsWith(a)),
);

/**
 * Phase 0 정답지 → **파일별 상한** (docs/plans/inventory/org-scope-callers.md · origin/main ce14fa84).
 * Phase 2 가 파일을 치환할 때마다 해당 항목을 지운다. 전부 지워지면 상한 0 = `[]` 게이트.
 * 🛑 늘리지 않는다 — 상한을 올리는 편집은 "새 우회로를 정당화" 하는 것이다.
 */
const KNOWN_API_MAX: Record<string, number> = {
  "app/api/activity-logs/route.ts": 1,
  "app/api/analytics/dashboard/route.ts": 1,
  "app/api/billing/invoices/route.ts": 1,
  "app/api/billing/payment-methods/route.ts": 3,
  "app/api/billing/route.ts": 2,
  "app/api/budget/predict/route.ts": 1,
  "app/api/budget/report/route.ts": 1,
  "app/api/budgets/route.ts": 1,
  "app/api/data-audit-logs/route.ts": 1,
  "app/api/organization-vendor-products/[id]/route.ts": 1,
  "app/api/organization-vendor-products/route.ts": 1,
  "app/api/organization-vendors/[id]/route.ts": 1,
  "app/api/organization-vendors/route.ts": 1,
  "app/api/protocol/extract-pdf/route.ts": 1,
  "app/api/quotes/route.ts": 1,
  "app/api/recommendations/personalized/route.ts": 1,
  "app/api/recommendations/purchase-patterns/route.ts": 1,
  "app/api/team/route.ts": 1,
  "lib/billing/enforce-plan-limit.ts": 1,
};

const KNOWN_UI_MAX: Record<string, number> = {
  "app/admin/safety/page.tsx": 1,
  "app/dashboard/organizations/page.tsx": 2,
  "app/dashboard/safety-spend/page.tsx": 1,
  "app/dashboard/settings/enterprise/page.tsx": 1,
  "app/dashboard/settings/plans/page.tsx": 2,
  "app/settings/audit/page.tsx": 1,
  "app/settings/billing/page.tsx": 1,
  "app/settings/security/page.tsx": 1,
  "app/settings/workspace/page.tsx": 1,
  "components/inventory/BulkImportModal.tsx": 1,
  "components/workspace/workspace-switcher.tsx": 2,
  "hooks/use-permission.ts": 1,
};

/** 파일별로 세어 상한과 비교한다. 초과·미등록 파일이 위반이다. */
function overBudget(
  found: string[],
  budget: Record<string, number>,
): { file: string; found: number; allowed: number }[] {
  const counts = new Map<string, number>();
  for (const f of found) counts.set(f, (counts.get(f) ?? 0) + 1);
  const out: { file: string; found: number; allowed: number }[] = [];
  for (const [file, n] of counts) {
    const allowed = budget[file] ?? 0;
    if (n > allowed) out.push({ file, found: n, allowed });
  }
  return out;
}


describe("§invite-flow — org-scope 직접 호출 인벤토리 (래칫 · Phase 2 종료 조건)", () => {
  it("API 축: 정답지 밖 unscoped organizationMember.findFirst 0 (신규 우회로 즉시 RED)", () => {
    const found: string[] = [];
    for (const p of FILES) {
      const code = stripComments(readFileSync(p, "utf8"));
      const rel = relative(SRC_ROOT, p).replace(/\\/g, "/");
      for (const _ of unscopedFindFirstLines(code)) found.push(rel);
    }
    expect(overBudget(found, KNOWN_API_MAX)).toEqual([]);
  });

  it("UI 축: 정답지 밖 orgs[0]/organizations[0]/memberships[0] 0 (주석 제거본)", () => {
    const found: string[] = [];
    for (const p of FILES) {
      const code = stripComments(readFileSync(p, "utf8"));
      const rel = relative(SRC_ROOT, p).replace(/\\/g, "/");
      const re = /(?:\borgs\[0\]|\borganizations\[0\]|\bmemberships\[0\])/g;
      while (re.exec(code) !== null) found.push(rel);
    }
    expect(overBudget(found, KNOWN_UI_MAX)).toEqual([]);
  });

  it("래칫: 상한 총계는 Phase 2 진행에 따라 줄기만 한다 (현재 API 22 · UI 15)", () => {
    /* 이 수치가 Phase 2 의 진척도다. 치환한 파일을 상한 맵에서 지우면 여기가 내려간다.
     * 0/0 이 되는 순간 위 두 단언은 그대로 "직접 호출 0" 게이트가 된다. */
    const apiTotal = Object.values(KNOWN_API_MAX).reduce((a, b) => a + b, 0);
    const uiTotal = Object.values(KNOWN_UI_MAX).reduce((a, b) => a + b, 0);
    expect(apiTotal).toBeLessThanOrEqual(22);
    expect(uiTotal).toBeLessThanOrEqual(15);
  });
});
