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
  /* 쓰기 3곳 — Phase 2-5 짝 이관 완료 (2026-09-02). 상한에서 제거됨:
   *   activity-logs POST(hint 있음) · budgets POST · team POST(둘 다 hint 없음 — 기존 입력 계약 보존)
   *   잠금: regression/write-org-scope-mutation-resolver.test.ts */
  /* 읽기 6곳 — Phase 2-4 치환 완료 (2026-09-02). 상한에서 제거됨:
   *   analytics/dashboard · budget/predict · budget/report · data-audit-logs ·
   *   recommendations/personalized · recommendations/purchase-patterns
   * 남은 6곳은 전부 **POST 핸들러**(+ enforce-plan-limit lib) — mutation 이라
   * §Phase 2 규칙에 따라 API·UI 짝 이관 대상이다. 읽기만 먼저 분리했다. */
  /* billing 6곳 — Phase 2-2 치환 완료 (2026-09-01). 상한에서 제거됨:
   *   billing/invoices(1) · billing/payment-methods(3) · billing(2) */
  /* organization-vendors 계열 4곳 — Phase 2-3 치환 완료 (2026-09-02). 상한에서 제거됨:
   *   vendors(1) · vendors/[id](1) · vendor-products(1) · vendor-products/[id](1) */
};

const KNOWN_UI_MAX: Record<string, number> = {
  "app/dashboard/settings/plans/page.tsx": 2,
  "components/workspace/workspace-switcher.tsx": 2,
  /* hooks/use-permission.ts — Phase 2 치환 완료 (2026-09-01, 첫 파일). 상한에서 제거됨. */
  /* settings/enterprise(1) · BulkImportModal(1) — Phase 2-10 이관 완료 (2026-09-03).
   *   잠금: regression/active-org-switcher-display-pairing.test.ts */
  /* dashboard/organizations/page.tsx(2) — **거짓 양성**. 아래 SINGLE_ORG_GUARDED 참조. */
};

/**
 * 거짓 양성 면제 — `organizations.length === 1` 가드 **안**의 `organizations[0]`.
 *
 * 래칫이 잡으려는 것은 "여러 조직 중 화면이 제 나름대로 첫 번째를 고르는 자리" 다.
 * 가드 안에서는 고를 것이 하나뿐이라 오선택 여지가 0 이고, 활성 조직으로 바꿔도
 * **같은 값**이다. 이관 대상이 아니라 정의상 대상이 아니었다.
 *
 * 🛑 면제는 주장이 아니라 **검증**이다. 아래 it 이 (a) 가드가 실재하는지 (b) 파일의
 *    `organizations[0]` 이 전부 그 가드 블록 안에 있는지 직접 센다. 가드 밖에
 *    한 건이라도 새로 생기면 즉시 RED — 면제가 구멍이 되지 않는다.
 */
const SINGLE_ORG_GUARDED: Record<string, number> = {
  "app/dashboard/organizations/page.tsx": 2,
};

/** `if (organizations.length === 1) { ... }` 블록을 중괄호 깊이로 잘라낸다. */
function singleOrgGuardBlock(code: string): string {
  const m = /if\s*\(\s*organizations\.length === 1\s*\)\s*\{/.exec(code);
  if (!m) return "";
  const start = m.index + m[0].length - 1; // 여는 `{`
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return code.slice(start, i + 1);
    }
  }
  return "";
}

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
    /* 검증된 거짓 양성은 상한이 아니라 면제에서 뺀다 — 면제 자체는 아래 it 이 실측한다. */
    expect(overBudget(found, { ...KNOWN_UI_MAX, ...SINGLE_ORG_GUARDED })).toEqual([]);
  });

  it("거짓 양성 면제는 검증된다 — 면제 파일의 orgs[0] 은 전부 length===1 가드 안", () => {
    for (const [rel, allowed] of Object.entries(SINGLE_ORG_GUARDED)) {
      const code = stripComments(readFileSync(join(SRC_ROOT, rel), "utf8"));
      const total = (code.match(/\borganizations\[0\]/g) ?? []).length;
      const block = singleOrgGuardBlock(code);

      // 가드를 못 찾은 것을 통과로 읽지 않는다
      expect(block.startsWith("{")).toBe(true);

      const inside = (block.match(/\borganizations\[0\]/g) ?? []).length;
      expect(total).toBe(allowed);
      // 🔑 전부 가드 안 — 밖에 하나라도 생기면 여기서 즉시 RED
      expect(inside).toBe(total);
    }
  });

  it("래칫: 상한 총계는 Phase 2 진행에 따라 줄기만 한다 (현재 API 0 · UI 8)", () => {
    /* 이 수치가 Phase 2 의 진척도다. 치환한 파일을 상한 맵에서 지우면 여기가 내려간다.
     * 0/0 이 되는 순간 위 두 단언은 그대로 "직접 호출 0" 게이트가 된다.
     * 🛑 이 상한은 **내리기만** 한다 — 올리는 편집은 새 우회로를 정당화하는 것이다. */
    const apiTotal = Object.values(KNOWN_API_MAX).reduce((a, b) => a + b, 0);
    const uiTotal = Object.values(KNOWN_UI_MAX).reduce((a, b) => a + b, 0);
    expect(apiTotal).toBeLessThanOrEqual(0);
    /* UI 축은 이번 phase 에서 변화 없다 — suppliers 화면은 `orgs[0]` 을 쓰지 않아
     * 애초에 UI 인벤토리에 없었다(짝 이관 대상이었던 것은 mutation 이지 조직 선택이 아니다). */
    expect(uiTotal).toBeLessThanOrEqual(4);
  });

  it("§invite-flow P2 — usePermission 은 활성 조직을 읽는다 (orgs[0] 부활 시 RED)", () => {
    /* 첫 치환 파일의 역방향 잠금. 래칫만으로는 "orgs[0] 이 사라졌다" 는 알아도
     * "무엇으로 대체됐는가" 를 잠그지 못한다 — 직접 fetch 로 되돌아가는 것도 막는다. */
    const src = readFileSync(join(SRC_ROOT, "hooks", "use-permission.ts"), "utf8");
    const code = stripComments(src);
    expect(code).toMatch(/useActiveOrganization\(\)/);
    expect(code).not.toMatch(/orgs\[0\]/);
    expect(code).not.toMatch(/queryKey:\s*\["user-org-membership"\]/);
    /* 조직 생성 직후 권한 stale 방지 — 무효화 경로가 새 소스까지 닿아야 한다. */
    const prompt = stripComments(
      readFileSync(join(SRC_ROOT, "components", "onboarding", "organization-name-prompt.tsx"), "utf8"),
    );
    expect(prompt).toMatch(/queryKey:\s*\["user-organizations"\]/);
    expect(prompt).toMatch(/queryKey:\s*\["active-organization"\]/);
  });

  it("§invite-flow P2 — 무변경 불변식: orgs[0] 정렬 == resolver fallback 정렬", () => {
    /* Phase 2 전체가 "단일 조직 사용자 행동 변화 0" 에 기대고 있고, 그 근거는 **정렬 등식** 하나다:
     *   · GET /api/organizations  → organizationMember.findMany(orderBy createdAt asc) 순서로 매핑
     *   · resolver fallback ③     → organizationMember.findFirst(orderBy createdAt asc)
     * 둘이 같으므로 activeOrganizationId 가 없는 사용자에게 `orgs[0]` 과 resolver 결과가 같다.
     * 🛑 어느 한쪽 정렬이 바뀌면 등식이 **조용히** 깨진다 — 화면은 그냥 다른 조직을 보여줄 뿐
     *    아무것도 실패하지 않는다. 그래서 런타임이 아니라 여기서 잡는다.
     *
     * ⏳ 은퇴 조건 (리뷰 지적 2026-09-01 · Cowork):
     *    이 단언이 잠그는 것은 "두 쿼리 정렬이 createdAt asc 로 **같다**" 이지만, 실제 계약은
     *    **"fallback 경로에서 orgs[0] == resolver 결과"** 다. 지금은 둘이 일치하지만
     *    activeOrganizationId 가 채워지기 시작하면(Phase 3 수락 → Phase 4 switcher) 목록 API 정렬을
     *    "활성 조직 우선" 으로 바꾸는 것이 **정당한 변경**인데 이 단언이 그것을 막는다.
     *    → 목록 API 정렬을 바꾸려면 이 단언을 **승계 교체**할 것. 정렬 일치를 갱신해 맞추지 말고,
     *      계약(fallback 경로 동치)을 직접 단언하는 형태로 옮긴다. Phase 4 에서 activeOrganizationId
     *      소비가 시작되면 재판정한다. 그때까지 단언 자체는 옳다. */
    const api = stripComments(
      readFileSync(join(SRC_ROOT, "app", "api", "organizations", "route.ts"), "utf8"),
    );
    const resolver = stripComments(
      readFileSync(join(SRC_ROOT, "lib", "organizations", "active-org.ts"), "utf8"),
    );
    /* 목록 API: findMany 창 안에 createdAt asc */
    const findManyWindow = api.match(
      /organizationMember\s*\.\s*findMany\s*\(\s*\{[\s\S]{0,1200}?\n\s*\}\s*\)/,
    )?.[0];
    expect(findManyWindow).toBeTruthy();
    expect(findManyWindow!).toMatch(/orderBy:\s*\{\s*createdAt:\s*"asc"\s*\}/);
    /* resolver fallback: findFirst 창 안에 같은 정렬 */
    const fallbackWindow = resolver.match(
      /organizationMember\s*\.\s*findFirst\s*\(\s*\{[\s\S]{0,600}?\n\s*\}\s*\)/g,
    )?.find((w) => !/organizationId/.test(w.split("select")[0] ?? w));
    expect(fallbackWindow).toBeTruthy();
    expect(fallbackWindow!).toMatch(/orderBy:\s*\{\s*createdAt:\s*"asc"\s*\}/);
  });
});
