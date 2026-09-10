/**
 * §inventory-org-session-authority (호영님 2026-09-10 P0) —
 * **쓰기 핸들러는 조직을 요청 body 에서 받지 않는다. 세션이 유일한 권위다.**
 *
 * 🛑 이건 배선 결함이 아니라 **cross-tenant write** 였다.
 *   `POST /api/inventory` 는 같은 핸들러 안에서 조직을 두 곳에서 읽고 있었다:
 *     한도 판정 → 세션 (`resolveActiveOrganizationId`)
 *     저장      → `body.organizationId` (멤버십 검증 0)
 *   남의 조직 id 를 실으면 그 조직 재고로 들어갔다. 오늘 아침 `findCachedOcrJob` 의
 *   cross-tenant **read** 를 P0 로 올렸는데, 이쪽은 read 가 아니라 write 라 더 무겁다.
 *   "지금 클라이언트가 안 보낸다" 는 방어가 아니다 — API 가 열려 있으면 열려 있는 것이다.
 *
 * 닫은 라우트 4곳(2026-09-10):
 *   `/api/inventory` POST                            body → ProductInventory.organizationId
 *   `/api/po-candidates` POST                        `{...body}` 스프레드 → POCandidate.organizationId
 *   `/api/inventory/auto-reorder` POST               body → 재고 조회 OR 절 **및** createQuote
 *   `/api/ai-actions/.../reorder-suggestions` POST   body → detectInventoryIssues → AiActionItem
 *
 * ── 이 sentinel 을 만들면서 검출기가 **세 번 틀렸다.** 그 셋이 이 파일의 설계다 ──
 *
 *   1) 헬퍼 이름만 봤다 → 인라인 검증 3건을 무검증으로 **오판**
 *      category-budgets · spending-categories · me/active-organization 은
 *      `organizationMember.findFirst({ where: { userId, organizationId } })` 로 검증한다.
 *      → 검증을 **이름**이 아니라 **형태**로 묻는다. (CLAUDE.md 절차 A)
 *
 *   2) 스프레드 통과를 못 봤다 → `/api/po-candidates` 의 결함 판본이 **매칭 0**
 *      `const input = { ...body, userId }` 는 `organizationId` 라는 글자가 파일 어디에도
 *      없는데 body 의 그 필드가 prisma 까지 간다. **가장 위험한 판본**인데 안 잡혔다.
 *      → 이름이 아니라 **경로**를 본다. (CLAUDE.md "X 를 쓰는가 에 grep 으로 답하지 않는다")
 *
 *   3) "쓰기X" 로 분류한 2건이 실제로는 쓰기였다 → auto-reorder · reorder-suggestions
 *      쓰기가 `createQuote(...)` · `detectInventoryIssues(...)` **헬퍼를 통과**해서다.
 *      → 그래서 이 파일은 쓰기 여부로 면제하지 않는다. body 에서 조직을 받으면
 *        그 자체가 위반이다. 헬퍼 너머를 정적으로 따라갈 방법이 없기 때문이다.
 *
 * 🔑 검출력 실증(③): `git show HEAD:` 판본으로 프로브했고 1)은 오탐 3건, 2)는 매칭 0,
 *   3)은 오분류 2건으로 **각각 드러났다.** 통과만 봤으면 셋 다 land 됐다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");
const SEP = String.fromCharCode(92);

function routeFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") out.push(p);
    }
  })(API_ROOT);
  return out;
}

/** 쓰기 핸들러 본문. 창은 `export async function POST` ↔ 다음 `export function` (블록 경계). */
function writeHandlers(code: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  for (const m of code.matchAll(/export\s+async\s+function\s+(POST|PUT|PATCH)\b/g)) {
    const rest = code.slice((m.index ?? 0) + 1);
    const nxt = rest.search(/\nexport\s+(async\s+)?function\s/);
    out.push({ name: m[1], body: nxt < 0 ? rest : rest.slice(0, nxt) });
  }
  return out;
}

/** 축 1 — 조직을 **이름으로** 요청 body 에서 읽는가. */
function readsOrgByName(body: string): boolean {
  return (
    /body\.organizationId/.test(body) ||
    /const\s*\{[\s\S]{0,1500}?\borganizationId\b[\s\S]{0,1500}?\}\s*=\s*(body|await\s+req)/.test(
      body,
    )
  );
}

/**
 * 축 2 — **날것의 body 스프레드**. `...parsed.data`(zod object)는 제외한다:
 * zod 는 스키마에 없는 키를 기본으로 버리므로 그 경로로는 조직이 못 들어온다.
 * (이 구분이 없어 `organizations/[id]/billing-info` PUT 을 한 번 오판했다.)
 */
function readsOrgBySpread(body: string): boolean {
  return /\.\.\.\s*(body|json)\b/.test(body);
}

/** 조직을 **검증하는 형태**가 핸들러 안에 있는가. 이름이 아니라 형태로 묻는다. */
function verifiesMembership(body: string): boolean {
  return (
    /resolveOrganizationIdForMutation/.test(body) ||
    /isMember\s*\(/.test(body) ||
    /getCallerOrganizationId\s*\(/.test(body) ||
    /assertOrgMember|requireOrgMember|assertMembership/.test(body) ||
    // 인라인 멤버십 조회 — 필드 순서는 계약이 아니므로 양방향 모두 인정한다.
    /organizationMember\.(findFirst|findUnique|count)\s*\(\{[\s\S]{0,300}?userId[\s\S]{0,300}?organizationId/.test(
      body,
    ) ||
    /organizationMember\.(findFirst|findUnique|count)\s*\(\{[\s\S]{0,300}?organizationId[\s\S]{0,300}?userId/.test(
      body,
    )
  );
}

function violations(): string[] {
  const hits: string[] = [];
  for (const f of routeFiles()) {
    const code = stripComments(readFileSync(f, "utf8"));
    for (const h of writeHandlers(code)) {
      const byName = readsOrgByName(h.body);
      const bySpread = readsOrgBySpread(h.body);
      if (!byName && !bySpread) continue;
      if (verifiesMembership(h.body)) continue;
      const rel = f.slice(f.indexOf("src")).split(SEP).join("/");
      hits.push(`${rel} ${h.name} [${byName ? (bySpread ? "이름+스프레드" : "이름") : "스프레드"}]`);
    }
  }
  return hits;
}

describe("§inventory-org-session-authority — 쓰기의 조직은 세션에서만 온다", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    /* 🛑 경로·파일명 조건이 틀리면 스코프가 0이 되고 그 순간 영구 GREEN 이다.
     *   실측 2026-09-10: route.ts 313개 · 그중 body 에서 조직을 읽는 쓰기 핸들러 10개. */
    expect(routeFiles().length).toBeGreaterThan(250);
  });

  it("🛑 body 로 받은 조직을 멤버십 검증 없이 쓰는 쓰기 핸들러가 0이다", () => {
    const hits = violations();
    expect(
      hits,
      `조직을 body 에서 받고 검증하지 않는 쓰기 핸들러: ${hits.join(" · ")}`,
    ).toHaveLength(0);
  });

  it("🔑 닫은 4라우트가 세션 resolver 를 실제로 쓴다 (회귀 0)", () => {
    /* 위 단언은 "무검증 0" 이라 **다른 방식의 검증**으로도 통과한다.
     *   오늘 내린 판정은 그보다 좁다 — 이 4곳은 `resolveOrganizationIdForMutation` 이다
     *   (오늘 아침 OCR 5라우트 (C′) 판정과 같은 계약). 경로는 OR 로 묶지 않고 각각 단언한다. */
    const CLOSED = [
      "src/app/api/inventory/route.ts",
      "src/app/api/po-candidates/route.ts",
      "src/app/api/inventory/auto-reorder/route.ts",
      "src/app/api/ai-actions/generate/reorder-suggestions/route.ts",
    ];
    for (const rel of CLOSED) {
      const code = stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));
      const post = writeHandlers(code).find((h) => h.name === "POST");
      expect(post, `${rel} 에 POST 핸들러가 없다`).toBeTruthy();
      expect(
        /resolveOrganizationIdForMutation\s*\(/.test(post!.body),
        `${rel} POST 가 세션 resolver 를 쓰지 않는다`,
      ).toBe(true);
      expect(
        readsOrgByName(post!.body),
        `${rel} POST 가 다시 body 에서 organizationId 를 읽는다`,
      ).toBe(false);
    }
  });

  it("🔑 `/api/po-candidates` 는 스프레드 **뒤**에서 조직을 덮어쓴다 (순서가 계약이다)", () => {
    /* 앞에 두면 `{ ...body }` 가 세션 값을 덮는다 — 고친 것이 그 자리에서 원복된다.
     *   창은 객체 리터럴 블록으로 연다(4원칙 ⑤ — 고정 폭 슬라이스 금지). */
    const code = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/api/po-candidates/route.ts"), "utf8"),
    );
    const start = code.indexOf("const input: POCandidateCreateInput = {");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, code.indexOf("\n    };", start));
    const spreadAt = block.indexOf("...body");
    const orgAt = block.indexOf("organizationId:");
    expect(spreadAt).toBeGreaterThan(-1);
    expect(orgAt).toBeGreaterThan(-1);
    expect(orgAt, "organizationId 가 ...body 보다 앞에 있다 — body 가 덮는다").toBeGreaterThan(
      spreadAt,
    );
  });
});
