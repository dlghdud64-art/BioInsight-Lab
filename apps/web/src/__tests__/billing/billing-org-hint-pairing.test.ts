/**
 * §invite-flow Phase 2-2 후속 — billing 대상 조직 **짝 계약** (리뷰 지적 2026-09-01 · Cowork)
 *
 * 잠그는 것: 돈이 움직이는 액션은 "화면이 보여준 조직" 에 적용된다.
 *   서버 축 — billing 라우트가 요청의 `organizationId` 를 resolver `hint` 로 읽는다
 *   화면 축 — /billing 화면이 GET 응답의 `organizationId` 를 mutation 에 그대로 싣는다
 *
 * 🛑 **짝으로 잠근다.** 한쪽만 있으면 계약이 조용히 깨진다:
 *   · 라우트만 hint 를 받고 화면이 안 보내면 → 서버가 그때의 활성 조직으로 다시 고른다.
 *     읽기와 쓰기 사이에 활성 조직이 바뀌면(다른 탭 switcher) 다른 조직의 구독이 바뀐다.
 *   · 화면만 보내고 라우트가 안 읽으면 → 파라미터가 그냥 무시된다.
 *   둘 다 **에러도 빈 화면도 없이** 조용히 틀리므로 런타임 QA 로 잡히지 않는다.
 *
 * 왜 hint 인가: resolver 가 이미 멤버십 검증 후 채택/무시한다(신규 검증 코드 0).
 *   남의 조직 id 를 넣어도 자기 활성 조직으로 떨어질 뿐 남의 데이터로 가지 않는다.
 *
 * 범위 밖(이미 조직이 명시된 경로라 이 계약이 필요 없다):
 *   · /api/organizations/[id]/subscription — 경로에 조직 (plans 화면 플랜 변경)
 *   · /api/billing/checkout · /portal — body 에 workspaceId (settings/billing 화면)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** resolver 호출 창을 brace 매칭으로 잘라낸다 (창은 호출부터 연다 — 원칙 ②). */
function resolverCalls(code: string, fn = "resolveActiveOrganizationId"): string[] {
  const out: string[] = [];
  const re = new RegExp(`${fn}\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const from = m.index;
    let depth = 0;
    for (let j = code.indexOf("(", from); j < code.length; j++) {
      if (code[j] === "(") depth++;
      if (code[j] === ")") {
        depth--;
        if (depth === 0) {
          out.push(code.slice(from, j + 1));
          break;
        }
      }
    }
  }
  return out;
}

describe("§invite-flow P2-2 — billing 대상 조직 짝 계약 (서버 축)", () => {
  /* 읽기(GET) 축만 센다 — 쓰기는 mutation 전용 resolver 로 옮겨갔고 아래 별도 describe 가 잠근다. */
  const ROUTES: [string, string[], number][] = [
    ["billing GET", ["app", "api", "billing", "route.ts"], 1],
    ["payment-methods GET", ["app", "api", "billing", "payment-methods", "route.ts"], 1],
    ["invoices GET", ["app", "api", "billing", "invoices", "route.ts"], 1],
  ];

  for (const [label, path, expectedCalls] of ROUTES) {
    it(`${label} — resolver 호출 전건이 hint 를 넘긴다`, () => {
      const code = stripComments(read(...path));
      const calls = resolverCalls(code);
      /* 호출 수가 줄면 치환이 되돌아간 것이고, 늘면 새 경로가 계약 밖에 생긴 것이다. */
      expect(calls.length).toBe(expectedCalls);
      for (const call of calls) {
        expect(call).toMatch(/hint\s*:/);
        /* hint 의 출처는 요청이어야 한다 — 상수나 활성값 재사용이면 계약이 아니다. */
        expect(call).toMatch(/organizationId/);
      }
    });
  }

  it("billing GET 응답이 organizationId 를 알려준다 (화면이 실어 보낼 값의 출처)", () => {
    const code = stripComments(read("app", "api", "billing", "route.ts"));
    expect(code).toMatch(/organizationId:\s*membership\?\.organization\?\.id/);
  });
});

/**
 * §invite-flow Phase 2-2 후속 2 (리뷰 지적 2026-09-01·02) — **쓰기는 명시값을 무시하지 않는다.**
 * hint 검증 실패 시 관대한 fallback(활성 조직으로 진행)을 쓰면 "화면이 보여준 조직 ≠ 적용된 조직"
 * 이 403 없이 되살아난다. mutation 3경로는 mutation 전용 resolver 를 쓰고 hint_forbidden → 403 이다.
 */
describe("§invite-flow P2-2 — 돈 액션은 hint 실패를 삼키지 않는다 (403)", () => {
  const MUTATION_ROUTES: [string, string[], number][] = [
    ["billing POST(플랜 변경)", ["app", "api", "billing", "route.ts"], 1],
    ["payment-methods POST·DELETE", ["app", "api", "billing", "payment-methods", "route.ts"], 2],
  ];

  for (const [label, path, expectedMutations] of MUTATION_ROUTES) {
    it(`${label} — mutation 전용 resolver 사용 + hint_forbidden 403`, () => {
      const code = stripComments(read(...path));
      const calls = resolverCalls(code, "resolveOrganizationIdForMutation");
      /* 수를 고정한다 — 하나가 관대한 resolver 로 되돌아가면 여기서 잡힌다. */
      expect(calls.length).toBe(expectedMutations);
      /* 명시값을 실제로 넘기는지 — hint 없는 mutation resolver 호출은 계약이 아니다. */
      for (const call of calls) expect(call).toMatch(/hint\s*:/);
      const guards = code.match(/reason\s*===\s*"hint_forbidden"/g) ?? [];
      expect(guards.length).toBe(expectedMutations);
      /* 403 이어야 한다 — 404·400 으로 뭉개면 "권한 없음" 이 "없는 조직" 으로 읽힌다. */
      expect(code).toMatch(/hint_forbidden"[\s\S]{0,400}?status:\s*403/);
    });
  }

  it("🛑 GET(읽기) 3곳은 관대한 resolver 를 유지한다 — 쓰기 규칙을 읽기에 옮기지 않는다", () => {
    /* 읽기까지 403 으로 만들면 stale hint 하나로 화면이 통째로 막힌다.
     * 두 계약이 **서로 다르다는 것** 자체를 잠근다. */
    for (const path of [
      ["app", "api", "billing", "route.ts"],
      ["app", "api", "billing", "payment-methods", "route.ts"],
      ["app", "api", "billing", "invoices", "route.ts"],
    ]) {
      const code = stripComments(read(...path));
      expect(code).toMatch(/resolveActiveOrganizationId\s*\(/);
    }
  });
});

describe("§invite-flow P2-2 — billing 대상 조직 짝 계약 (화면 축)", () => {
  const PAGE = ["app", "billing", "page.tsx"];

  it("GET 응답의 organizationId 를 붙잡는다", () => {
    const code = stripComments(read(...PAGE));
    expect(code).toMatch(/billingOrganizationId\s*[:=]/);
    expect(code).toMatch(/billingData\?\.organizationId/);
  });

  it("mutation 3경로가 그 값을 싣는다 — 플랜 변경 · 카드 등록 · 카드 삭제", () => {
    const code = stripComments(read(...PAGE));
    /* 경로를 OR 로 묶지 않는다 — 하나가 끊기는 것도 회귀다(각각 단언). */
    expect(code).toMatch(/action:\s*"upgrade"[\s\S]{0,120}?organizationId:\s*billingOrganizationId/);
    expect(code).toMatch(/isDefault:\s*true,\s*organizationId:\s*billingOrganizationId/);
    expect(code).toMatch(/organizationId=\$\{encodeURIComponent\(billingOrganizationId\)\}/);
  });
});
