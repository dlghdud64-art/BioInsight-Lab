/**
 * §audit-org-required (호영님 2026-09-11) — `complete()` 는 조직을 **필수로** 받는다 · 미정 잔량은 내려가기만 한다.
 *
 * ── 왜 ──
 * MutationAuditEvent.orgId 가 예외 없이 null 이었고, 그 null 이 "조직 없음" 인지 "안 정함" 인지 갈리지 않았다.
 * 이제 세 값만 받는다: string(그 조직) · null(조직 없음, 명시) · UNRESOLVED_ORG(아직 안 정함).
 * 닫는 커밋은 호출 145곳 전부를 UNRESOLVED_ORG 로 두고, 채우기는 8곳 안팎씩 끊어 간다.
 * **외부 목록 없이 컴파일러와 이 파일이 잔량을 센다.** 0 이 완료 신호다.
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. 채운 값이 **맞는 조직**인지 — 여기서는 모른다. 채울 때 자리마다 근거를 적고, prod 1행으로 확인한다.
 *   2. complete() 를 아예 안 부르는 핸들러(enforceAction 169 vs complete 146) — §audit-missing-complete 별건.
 *   3. 감사 success 가 실제 변경을 뜻하는지 — §audit-intent-vs-effect 별건.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UNRESOLVED_ORG, resolveAuditOrg } from "@/lib/audit/audit-org";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SEP = String.fromCharCode(92);
const MIDDLEWARE = "src/lib/security/server-enforcement-middleware.ts";

/** 닫는 커밋 시점의 미정 잔량. **올릴 수 없다.** 채울 때마다 이 수를 내린다 · 0 이 완료.
 *  🛑 146 이 아니라 145 다. 앞선 형태 집계의 `.complete()` 2건 중 1건이 category-budget-release.ts 의
 *     JSDoc **주석**이었다(실제 호출 아님). 호출은 145 · 코드모드 144 + seed 수동 1. */
const UNRESOLVED_CEILING = 135; // 채우기 1단(조직 경로 파라미터 10) · 145 → 135

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        walk(p);
      } else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  })(join(WEB_ROOT, "src"));
  return out;
}

/** 여는 괄호 자리에서 짝이 맞는 닫는 괄호까지(블록 경계 · 4원칙 ⑤). */
function argBlock(code: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") {
      depth--;
      if (depth === 0) return code.slice(openParen, i + 1);
    }
  }
  return code.slice(openParen);
}

function completeCalls(): { rel: string; args: string }[] {
  const out: { rel: string; args: string }[] = [];
  for (const f of sourceFiles()) {
    const rel = f.slice(f.indexOf("src")).split(SEP).join("/");
    if (rel === MIDDLEWARE) continue;
    const code = stripComments(readFileSync(f, "utf8"));
    for (const m of code.matchAll(/enforcement\??\.complete\(/g)) {
      out.push({ rel, args: argBlock(code, (m.index ?? 0) + m[0].length - 1) });
    }
  }
  return out;
}

describe("§audit-org-required · 해석 규칙", () => {
  it("문자열은 그 조직 · null 은 조직 없음(명시) · 기호는 안 정함", () => {
    expect(resolveAuditOrg("org-1")).toEqual({ organizationId: "org-1", orgUnresolved: false });
    expect(resolveAuditOrg(null)).toEqual({ organizationId: null, orgUnresolved: false });
    expect(resolveAuditOrg(UNRESOLVED_ORG)).toEqual({ organizationId: null, orgUnresolved: true });
  });

  it("🛑 인자 없이 부른 옛 호출(undefined)과 빈 문자열은 안 정함으로 읽는다 (throw 0)", () => {
    expect(resolveAuditOrg(undefined)).toEqual({ organizationId: null, orgUnresolved: true });
    expect(resolveAuditOrg("")).toEqual({ organizationId: null, orgUnresolved: true });
  });

  it("🔑 기호는 Symbol.for 레지스트리 기호다 (모듈 사본이 달라도 같은 기호)", () => {
    expect(UNRESOLVED_ORG).toBe(Symbol.for("audit.org.unresolved"));
    expect(resolveAuditOrg(Symbol.for("audit.org.unresolved")).orgUnresolved).toBe(true);
  });
});

describe("§audit-org-required · 호출부", () => {
  it("축이 비어 있지 않다 (수집이 죽으면 아래 단언이 조용히 통과한다)", () => {
    expect(completeCalls().length).toBeGreaterThan(100);
  });

  it("🛑 모든 enforcement.complete() 가 organizationId 를 넘긴다", () => {
    const bad = completeCalls().filter((c) => !/\borganizationId\s*:/.test(c.args));
    expect(bad.map((b) => b.rel), `조직 인자 없는 complete(): ${bad.map((b) => b.rel).join(" · ")}`).toHaveLength(0);
  });

  it(`🛑 미정(UNRESOLVED_ORG) 잔량은 ${UNRESOLVED_CEILING} 을 넘지 않는다 (내려가기만 한다)`, () => {
    const left = completeCalls().filter((c) => /organizationId\s*:\s*UNRESOLVED_ORG\b/.test(c.args)).length;
    expect(left).toBeLessThanOrEqual(UNRESOLVED_CEILING);
  });
});

describe("§audit-org-required · 미들웨어", () => {
  const mw = stripComments(readFileSync(join(WEB_ROOT, MIDDLEWARE), "utf8"));

  it("🛑 complete() 의 조직 인자는 필수다 (선택 인자로 되돌리면 안 넘긴 호출이 조용히 null 이 된다)", () => {
    expect(mw).not.toMatch(/complete\(detail\?\s*:/);
    expect(mw).toMatch(/complete\(detail:\s*\{[\s\S]{0,200}?organizationId:\s*AuditOrganization/);
  });

  it("🔑 감사의 조직은 config 가 아니라 complete() 에서 온다", () => {
    expect(mw).toMatch(/resolveAuditOrg\(\s*detail\?\.organizationId\s*\)/);
    expect(mw).not.toMatch(/organizationId:\s*config\.organizationId\s*\?\?\s*null/);
    expect(mw).toMatch(/orgUnresolved:\s*auditOrg\.orgUnresolved/);
  });

  it("🔑 DB 에서도 '조직 없음' 과 '안 정함' 이 갈린다 (decisionBasis.orgUnresolved)", () => {
    const da = stripComments(readFileSync(join(WEB_ROOT, "src/lib/audit/durable-audit.ts"), "utf8"));
    expect(da).toMatch(/orgUnresolved:\s*input\.orgUnresolved\s*\?\?\s*false/);
  });
});
