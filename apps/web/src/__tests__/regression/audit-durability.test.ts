/**
 * §audit-durability (호영님 2026-09-07 승인) —
 * **감사는 내구 저장소에 남고, 응답 경로를 막지 않으며, 실패해도 요청을 깨뜨리지 않는다.**
 *
 * 사고: `enforceAction().complete()` → `appendAuditEnvelope` → 모듈 최상위 `let auditStore`
 *   (**인스턴스 메모리**). 서버리스에서 요청이 끝나면 사라진다.
 *   prod 실측 2026-09-07: `MutationAuditEvent` 0행 · `GovernanceAuditLog` 0행 —
 *   (후자는 2026-09-10 에 테이블째 제거됐다. 이 줄은 **그때의 실측**으로 보존한다.) —
 *   `enforceAction` 을 쓰는 라우트 147곳 중 `complete()` 를 부르는 116곳의 감사가
 *   **존재한 적이 없다.** 감사의 외형만 있고 실체가 없었다.
 *
 * 🔑 호영님 지시: "148번째 라우트가 조용히 옛 형태로 돌아가는 것"을 막는 것이 이 파일의 목적이다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

const MIDDLEWARE = "src/lib/security/server-enforcement-middleware.ts";
const LIB = "src/lib/audit/durable-audit.ts";

/** `enforceAction` 을 쓰는 API 라우트 전량 — 파일명을 손으로 적지 않는다. */
function enforcingRoutes(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") {
        const code = stripComments(readFileSync(p, "utf8"));
        if (/\benforceAction\s*\(/.test(code)) out.push(p);
      }
    }
  })(join(WEB_ROOT, "src", "app", "api"));
  return out;
}

/** `complete(` 의 여는 괄호 ↔ 대응 닫는 자리 (고정 폭 슬라이스 0 · 4원칙 ⑤). */
function completeBody(code: string): string {
  const anchor = code.indexOf("complete(detail)");
  expect(anchor).toBeGreaterThan(-1);
  const open = code.indexOf("{", anchor);
  let i = open,
    depth = 0;
  while (i < code.length) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  return code.slice(open, i + 1);
}

describe("§audit-durability — 감사가 내구 저장소로 간다", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    /* 🛑 경로·확장자 조건이 틀리면 스코프가 0이 되고 그때 이 파일은 영구 GREEN 이다. */
    expect(enforcingRoutes().length).toBeGreaterThan(100);
  });

  it("complete() 가 내구 기록을 호출한다", () => {
    const body = completeBody(stripComments(read(MIDDLEWARE)));
    expect(body).toMatch(/recordDurableAudit\(/);
  });

  it("🛑 감사 쓰기가 **응답 경로 밖**이다 (await 금지)", () => {
    /* `await` 로 가면 감사 대상 요청 전량이 왕복 1회만큼 느려진다.
     * 실측(2026-09-07): prod iad1 단독 왕복 737~770ms · 한국↔도쿄 풀러 196ms.
     * 어느 리전이든 받을 수 없다. */
    const body = completeBody(stripComments(read(MIDDLEWARE)));
    expect(body).toMatch(/waitUntilCompat\(/);
    expect(body).not.toMatch(/await\s+recordDurableAudit/);
  });

  it("🛑 complete() 는 여전히 **동기**다 (호출부 146곳 무변경의 근거)", () => {
    /* async 로 바뀌는 순간 호출부 전량이 `await` 없이 프라미스를 떨어뜨리게 된다 —
     * 그러면 유실이 되돌아온다. 동기 유지가 이 설계의 전제다. */
    const src = stripComments(read(MIDDLEWARE));
    expect(src).not.toMatch(/async\s+complete\(/);
    expect(src).toMatch(/complete\(detail\)\s*\{/);
  });

  it("🛑 내구 기록기는 절대 throw 하지 않는다 (삼키되 기록한다)", () => {
    const lib = stripComments(read(LIB));
    // 쓰기는 try/catch 안에 있어야 한다
    expect(lib).toMatch(/try\s*\{[\s\S]*?db\.mutationAuditEvent\.create/);
    // 그리고 실패를 **조용히** 삼키지 않는다
    expect(lib).toMatch(/console\.error\(/);
    expect(lib).toMatch(/내구 감사 기록 실패/);
    // catch 가 다시 던지면 계약 위반이다
    expect(lib).not.toMatch(/catch[\s\S]{0,200}?throw /);
  });

  it("🛑 조직을 유도하지 않는다 — 없으면 null (틀린 조직보다 정직하다)", () => {
    /* `resolveActiveOrganizationId(userId)` 로 채우면 감사 시점의 활성 조직이
     * 대상 조직과 다를 수 있다(§invite-flow "보여준 조직 != 적용된 조직"). */
    const lib = stripComments(read(LIB));
    expect(lib).not.toMatch(/resolveActiveOrganizationId/);
    expect(lib).toMatch(/organizationId\s*\?\?\s*null/);
    // 왜 비었는지를 값과 함께 남긴다
    expect(lib).toMatch(/orgIdOmitted/);
  });

  it("🛑 없는 값을 지어내지 않는다 (waitUntil 컨텍스트도 형태만 본다)", () => {
    /* `@vercel/functions` 를 import 하지 않고 같은 심볼을 직접 읽는다 —
     * 그 설치가 락파일에서 next-auth 다운그레이드를 끌고 왔기 때문이다(2026-09-07 실측). */
    const lib = stripComments(read(LIB));
    expect(lib).toMatch(/Symbol\.for\("@vercel\/request-context"\)/);
    expect(lib).not.toMatch(/from ["']@vercel\/functions["']/);
  });
});

describe("§audit-durability — 승계된 명제 (SH15·SH17 이관)", () => {
  /* 🔑 `security-hardening-batch0.test.ts` 의 SH15~18 은 메모리 해시 체인을 잠갔고,
   *   그 체인은 2026-09-07 (가) 로 제거됐다. 지우기 전에 각 단언이 **무엇을 지키려 했는지**
   *   확인했다(§11.303-hotfix 교훈 — 이름만 보고 지우면 명제를 잃는다).
   *     SH15 "append-only 로 기록됨"        → 저장소가 바뀌어도 유효 → 여기로 이관
   *     SH17 "beforeHash/afterHash 비어있지 않고 서로 다름"
   *                                        → "전후 상태를 실제로 캡처한다" 로 이관
   *     SH16 "hash chain 이 연결됨"          → 체인과 함께 소멸 (승계 대상 아님)
   *     SH18 "메모리 query 가 필터링됨"      → 조회 API 와 함께 소멸 (DB 가 대신한다) */

  it("SH15 승계 — 감사는 append-only 다 (update/delete 경로 0)", () => {
    /* 감사 증적은 고쳐 쓰거나 지울 수 없어야 한다. 저장소가 메모리에서 DB 로 바뀌었으므로
     * 잠글 대상도 DB 접근으로 옮긴다 — 저장소 전체에서 create 외의 쓰기를 금지한다. */
    const hits: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__") continue;
          walk(p);
        } else if (/\.tsx?$/.test(e.name)) {
          const code = stripComments(readFileSync(p, "utf8"));
          if (/mutationAuditEvent\.(update|delete|upsert)/.test(code)) {
            hits.push(p.slice(p.indexOf("src")).replace(/\\/g, "/"));
          }
        }
      }
    })(join(WEB_ROOT, "src"));
    expect(hits, `감사 레코드를 고치거나 지우는 경로:\n${hits.join("\n")}`).toHaveLength(0);
  });

  it("SH17 승계 — 전후 상태를 실제로 캡처한다 (빈 자리를 만들지 않는다)", () => {
    /* 원 단언은 `beforeHash !== afterHash` 로 "둘 다 실제로 채워졌다" 를 봤다.
     * 해시가 사라졌으므로 **원본 상태가 기록되는지**를 직접 본다. */
    const lib = stripComments(read(LIB));
    expect(lib).toMatch(/beforeState:\s*input\.beforeState/);
    expect(lib).toMatch(/afterState:\s*input\.afterState/);
    // 미들웨어가 그 두 값을 실제로 넘긴다(라이브러리만 받아도 소용없다)
    const body = completeBody(stripComments(read(MIDDLEWARE)));
    expect(body).toMatch(/beforeState:\s*detail\?\.beforeState/);
    expect(body).toMatch(/afterState:\s*detail\?\.afterState/);
  });
});

describe("§audit-durability — 호출부 (148번째 라우트 차단)", () => {
  it("enforceAction 을 쓰는 라우트는 complete() 또는 fail() 로 닫는다", () => {
    /* 열어 놓고 안 닫으면 lock 이 남고 감사도 안 남는다.
     * 파일명을 적지 않고 디렉터리를 훑으므로, 새 라우트가 생겨도 자동으로 축에 든다. */
    const open: string[] = [];
    for (const f of enforcingRoutes()) {
      const code = stripComments(readFileSync(f, "utf8"));
      if (!/\.complete\(|\.fail\(/.test(code)) {
        open.push(f.slice(f.indexOf("src")).replace(/\\/g, "/"));
      }
    }
    expect(open, `enforceAction 을 열고 닫지 않는 라우트:\n${open.join("\n")}`).toHaveLength(0);
  });
});
