/**
 * §audit-reject-raw-4xx Phase 1 (호영님 2026-09-13 승인) —
 * **거부도 감사에 남는다.** enforceAction 이 handle 을 연 뒤 4xx 로 나가는 자리가 145 지점 있고,
 * 그 경로는 fail() 도 complete() 도 부르지 않아 거부 시도가 기록되지 않았다.
 *
 * ── 계약 ──
 *   enforcement.reject(status, body)
 *     ① fail() 을 **먼저** 부른다(lock 해제 · 감사 축 정리)
 *     ② 그 다음 응답을 만든다 — 내보내고 기록하면 실패 시 흔적이 없다(P0-b1 프록시와 같은 원칙)
 *     ③ status·body 는 **그대로 통과**한다. 부작용만 추가하고 계약은 안 건드린다.
 *
 * ── 왜 객체 메서드인가 (Phase 0 프로브) ──
 *   handle 이 없는 자리(enforceAction 이전 206 지점)에서 부르면 tsc 가 막는다:
 *     enforcement.fail()   → TS18048 'enforcement' is possibly 'undefined'   ✅
 *     enforcement?.fail()  → 통과                                            ❌ 우회 가능
 *   그래서 **두 겹**이다 — tsc 1차 + 이 파일의 우회 금지 단언 2차.
 *   🛑 전역 헬퍼(`import { reject }`)로 만들면 1차 보증이 사라진다.
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. 교체 진행분은 상한 sentinel 이 센다(별도 it · 145 → 0).
 *   2. 런타임 감사 기록은 prod 스모크가 판정한다(Phase 5 · result 값을 본다).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const MW = "src/lib/security/server-enforcement-middleware.ts";
const src = stripComments(readFileSync(join(WEB_ROOT, MW), "utf8"));

describe("§audit-reject-raw-4xx · reject() 계약", () => {
  it("🛑 InlineEnforcementHandle 에 reject(status, body) 가 있다", () => {
    expect(src).toMatch(/reject\(\s*status:\s*number,\s*body:/);
  });

  it("🛑 reject 는 응답을 만들기 **전에** lock 을 푼다 (순서가 곧 보증이다)", () => {
    /* 🛑 창은 **구현 블록**으로 연다 — 인터페이스 선언(`): NextResponse;`)이 먼저 나오므로
     *   단순 indexOf 는 선언을 잡는다(4원칙 ⑤ · 창 시작점). 구현은 `) {` 로 끝난다. */
    const m = src.match(/reject\(status: number, body: Record<string, unknown>\)\s*\{/);
    expect(m, "reject 구현을 못 찾았다").not.toBeNull();
    const body = src.slice(m!.index!, m!.index! + 600);
    const release = body.search(/failMutation\(|this\.fail\(\)/);
    const respond = body.indexOf("NextResponse.json");
    expect(release, "reject 안에서 lock 해제를 못 찾았다").toBeGreaterThan(-1);
    expect(respond, "reject 안에서 응답 생성을 못 찾았다").toBeGreaterThan(-1);
    expect(release).toBeLessThan(respond);
  });

  it("🛑 status·body 를 그대로 통과시킨다 (응답 계약 불변)", () => {
    const m = src.match(/reject\(status: number, body: Record<string, unknown>\)\s*\{/);
    const body = src.slice(m!.index!, m!.index! + 600);
    expect(body).toMatch(/NextResponse\.json\(\s*body,\s*\{\s*status\s*\}\s*\)/);
  });

  it("🛑 전역 헬퍼가 아니다 (handle 없는 자리에서 못 부르게 · tsc 1차 보증)", () => {
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+reject\s*\(/);
    expect(src).not.toMatch(/export\s+const\s+reject\s*=/);
  });
});

/** 닫는 시점의 잔량. **올릴 수 없다.** 도메인별로 교체하며 내린다 · 0 이 완료.
 *  🛑 153 은 **이 파일의 파서**(게이트 러너)가 잰 값이다. 예비 조사(별도 python 스크립트)는 144 였고
 *     미커버 파일에서 1을 더해 145 로 계획했는데, 게이트 파서는 153 을 센다.
 *     조항: **게이트 정본은 프로젝트 러너다** — 축이 다른 수치를 섞지 않는다.
 *     차이 9건의 정체는 Phase 2 부터 도메인 목록을 쓸 때 드러난다(그때 기록한다). */
const RAW_4XX_CEILING = 153;

const SEP = String.fromCharCode(92);

/** 핸들러 블록 — 🛑 **인자 괄호를 먼저 균형으로 닫은 뒤** 본문 중괄호를 연다.
 *  `{ params }: { params: … }` 구조분해 인자의 중괄호를 본문 시작으로 오인하면
 *  144 파일 중 54를 놓친다(2026-09-13 실측 · CLAUDE.md 조항). */
function handlerBlocks(code: string): string[] {
  const out: string[] = [];
  const re = /export\s+async\s+function\s+[A-Za-z]+\s*\(/g;
  for (const m of code.matchAll(re)) {
    const i = (m.index ?? 0) + m[0].length - 1;
    let d = 0;
    let close = -1;
    for (let j = i; j < code.length; j++) {
      if (code[j] === "(") d++;
      else if (code[j] === ")") { d--; if (d === 0) { close = j; break; } }
    }
    if (close < 0) continue;
    const open = code.indexOf("{", close);
    if (open < 0) continue;
    d = 0;
    for (let j = open; j < code.length; j++) {
      if (code[j] === "{") d++;
      else if (code[j] === "}") { d--; if (d === 0) { out.push(code.slice(open, j + 1)); break; } }
    }
  }
  return out;
}

function routeFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
      else if (e.name === "route.ts") out.push(p);
    }
  })(join(WEB_ROOT, "src", "app", "api"));
  return out;
}

/** enforceAction **이후**의 raw 4xx 반환 지점(= reject() 로 바꿀 자리). */
function rawAfterEnforce(): { rel: string; codes: string[] }[] {
  const out: { rel: string; codes: string[] }[] = [];
  for (const f of routeFiles()) {
    const code = stripComments(readFileSync(f, "utf8"));
    const rel = f.slice(f.indexOf("src")).split(SEP).join("/");
    for (const b of handlerBlocks(code)) {
      const ea = b.indexOf("enforceAction(");
      if (ea < 0) continue;
      const tail = b.slice(ea);
      const codes: string[] = [];
      for (const m of tail.matchAll(/return\s+NextResponse\.json\([\s\S]{0,400}?status:\s*(4\d\d)/g)) {
        const win = tail.slice(Math.max(0, (m.index ?? 0) - 260), m.index);
        if (!win.includes("fail()") && !win.includes("deny()") && !win.includes("complete(") && !win.includes("reject(")) {
          codes.push(m[1]);
        }
      }
      if (codes.length) out.push({ rel, codes });
    }
  }
  return out;
}

describe("§audit-reject-raw-4xx · 잔량 래칫", () => {
  it("축이 비어 있지 않다 (수집이 죽으면 아래 단언이 조용히 통과한다)", () => {
    expect(routeFiles().length).toBeGreaterThan(200);
  });

  it(`🛑 enforceAction 이후 raw 4xx 지점은 ${RAW_4XX_CEILING} 을 넘지 않는다 (내려가기만 한다)`, () => {
    const total = rawAfterEnforce().reduce((n, r) => n + r.codes.length, 0);
    expect(total).toBeLessThanOrEqual(RAW_4XX_CEILING);
  });

  it("🛑 2차 보증 · enforceAction **이전** 구간에서 handle 을 옵셔널 체이닝으로 부르지 않는다", () => {
    /* Phase 0 프로브: `enforcement.fail()` 은 TS18048 로 막히지만 `enforcement?.fail()` 은 통과한다.
     *   tsc 가 못 막는 그 우회를 여기서 잠근다(두 겹 · P0-b1 의 private+비결정적 키와 같은 원칙). */
    const bad: string[] = [];
    for (const f of routeFiles()) {
      const code = stripComments(readFileSync(f, "utf8"));
      const rel = f.slice(f.indexOf("src")).split(SEP).join("/");
      for (const b of handlerBlocks(code)) {
        const ea = b.indexOf("enforceAction(");
        if (ea < 0) continue;
        if (/enforcement\?\./.test(b.slice(0, ea))) bad.push(rel);
      }
    }
    expect(bad, `enforceAction 이전 옵셔널 체이닝: ${bad.join(" · ")}`).toEqual([]);
  });
});
