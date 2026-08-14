/**
 * §tenant-isolation-placeholder A4 — 테넌트 스코프 커버리지 단언
 *
 * 배경: enforceAction 의 조직 게이트는 (a)≡(b) 항등이라 **거절하지 못한다**
 * (§tenant-isolation-placeholder §7.1). 따라서 격리를 지탱하는 실체는
 *   ① middleware.ts 의 역할 게이트, ② 라우트 자체의 소유권/멤버십 검사
 * 둘뿐이다. 이 단언은 **둘 중 어느 것도 없는 테넌트 접촉 핸들러**를 RED 로 잡는다.
 *
 * 이 파일이 존재하는 이유(§measurement-layer-blindness):
 *   406 핸들러 수동 분류는 1회성이고, 그 1회조차 두 번 틀렸다
 *   (1차: 역할 게이트 조기 반환을 경로 미도달로 오독 / 2차: 미들웨어 커버를 무방비로 오독).
 *   수동 분류를 단언으로 승격하지 않으면 다음 라우트에서 같은 구멍이 다시 난다.
 *
 * 🛑 미들웨어 커버 집합은 **하드코딩하지 않는다.**
 *   `middleware.ts` 의 matcher 와 role 조건을 읽어 도출한다. 하드코딩하면
 *   matcher 가 바뀔 때 이 단언이 **조용히 거짓말한다**.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");

function read(abs: string): string {
  return readFileSync(abs, "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "route.ts") out.push(p);
  }
  return out;
}

function matchBlock(s: string, openIdx: number, open = "{", close = "}"): number {
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close) {
      d--;
      if (d === 0) return i;
    }
  }
  return s.length - 1;
}

// ═══════════════════════════════════════════════════════
// 1. 미들웨어 커버 집합 — matcher + role 조건에서 도출
// ═══════════════════════════════════════════════════════

interface MiddlewareCoverage {
  matcherCoversApi: boolean;
  /** role 게이트가 걸린 pathname 프리픽스 (도출값, 하드코딩 아님) */
  gatedPrefixes: string[];
  roleCondition: string | null;
}

export function deriveMiddlewareCoverage(src: string): MiddlewareCoverage {
  // (a) matcher 가 /api 를 덮는가
  const matcherBlock = src.slice(src.indexOf("matcher:"), src.indexOf("]", src.indexOf("matcher:")) + 1);
  const matcherEntries = [...matcherBlock.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  const matcherCoversApi = matcherEntries.some((e) => /^\/api(\/|:|$)/.test(e));

  // (b) pathname 프리픽스를 모으는 const 선언 수집
  const prefixConsts: Record<string, string[]> = {};
  const constRe = /const\s+([A-Za-z0-9_$]+)\s*=\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = constRe.exec(src))) {
    const [, name, init] = m;
    if (!/pathname\s*(\.startsWith\(|===)/.test(init)) continue;
    const lits = [...init.matchAll(/["'`](\/[^"'`]*)["'`]/g)].map((x) => x[1]);
    if (lits.length) prefixConsts[name] = lits;
  }

  // (c) role 비교 + 403 을 포함하는 if 블록을 찾아, 그 조건이 참조하는 const 의 프리픽스를 커버로 인정
  const gated = new Set<string>();
  let roleCondition: string | null = null;
  const ifRe = /if\s*\(([^)]*)\)\s*\{/g;
  while ((m = ifRe.exec(src))) {
    const cond = m[1];
    const referenced = Object.keys(prefixConsts).filter((k) => new RegExp(`\\b${k}\\b`).test(cond));
    if (!referenced.length) continue;
    const bodyStart = src.indexOf("{", m.index + m[0].length - 1);
    const body = src.slice(bodyStart, matchBlock(src, bodyStart) + 1);
    const roleCheck = body.match(/role\s*===\s*["'`]([A-Z_]+)["'`]/);
    const denies = /status:\s*403/.test(body);
    if (roleCheck && denies) {
      roleCondition = roleCheck[0];
      for (const k of referenced) for (const p of prefixConsts[k]) gated.add(p);
    }
  }

  return {
    matcherCoversApi,
    gatedPrefixes: [...gated].filter((p) => p.startsWith("/api")),
    roleCondition,
  };
}

// ═══════════════════════════════════════════════════════
// 2. 핸들러 추출 + 소유권 검사 마커
// ═══════════════════════════════════════════════════════

const TENANT_MODEL =
  /\b(?:db|dbTyped|tx|prisma)\s*\.\s*(quote|quoteListItem|quoteItem|quoteShare|quoteResponse|productInventory|budget|categoryBudget|order|purchaseRecord|purchaseRequest|organization|organizationMember|organizationInvite|team|teamMember|workspace|workspaceMember|aiActionItem|receivingDraft|receivingDocument|poCandidate|billingInfo|subscription|vendorRequest|quoteReply|ingestionEntry|sdsDocument|complianceLink)\b/;

const OWNER_PATTERNS: Array<[string, RegExp]> = [
  ["orgMember", /organizationMember\s*\.\s*(findFirst|findUnique|findMany|count)/],
  ["teamMember", /teamMember\s*\.\s*(findFirst|findUnique|findMany|count)/],
  ["workspaceMember", /workspaceMember\s*\.\s*(findFirst|findUnique|findMany|count)/],
  ["idCompare", /[A-Za-z0-9_.\]]+\s*(===|!==)\s*session[?.]*\.user[?.]*\.id/],
  ["idCompareRev", /session[?.]*\.user[?.]*\.id\s*(===|!==)\s*[A-Za-z0-9_.\]]+/],
  ["scopedWhere", /where:\s*\{[^}]{0,400}userId:\s*session[?.]*\.user[?.]*\.id/s],
  ["scopedWhereVar", /where:\s*\{[^}]{0,300}userId\s*[,:}]/s],
  ["scopeKeyScoped", /where:\s*\{[^}]{0,200}scopeKey/s],
  ["guestKeyScoped", /where:\s*\{[^}]{0,300}guestKey/s],
  ["vendorEmail", /vendor\.email\s*(===|!==)/],
  ["orgIdsIn", /organizationId:\s*\{\s*in:\s*\w*[Oo]rgIds/],
  // 생성 경로 — 소유자를 세션에서 **주입**하는 형태도 스코프다(where 가 아니라 data 에 있다)
  ["createScoped", /data:\s*\{[^}]{0,600}(userId:\s*session[?.]*\.user[?.]*\.id|scopeKey|guestKey)/s],
  // 벤더 자기 스코프 — 세션 사용자의 email 로 vendor 를 찾는다(userId 축이 아니라 email 축)
  ["vendorSelfScope", /where:\s*\{[^}]{0,120}email:\s*(user|session[?.]*\.user)[?.]*\.?email/s],
  // 조직을 클라 입력이 아니라 **세션 사용자 멤버십에서 도출**하는 형태
  ["orgFromMembership", /organizationMembers\s*[?.]*\.?\[\s*0\s*\]|organizationMember\s*\.\s*findMany[\s\S]{0,200}userId/],
];

/**
 * 기계 인증 경로 — 사용자 세션이 아니라 **공유 비밀/서명**으로 인증한다.
 * 테넌시 축이 아예 다르므로 소유권 검사 부재가 결함이 아니다.
 * (검증 자체가 없으면 그건 이 단언이 아니라 별도 문제 — 여기서는 검증 존재만 확인한다.)
 */
const MACHINE_AUTH: Array<[string, RegExp]> = [
  ["cronSecret", /CRON_SECRET|x-vercel-cron-signature/],
  ["webhookSignature", /stripe-signature|constructEvent\s*\(|verifyWebhookSignature/],
];

/** 인증 자체(테넌시 무관)라 델리게이트 추적에서 제외 */
const NOISE = new Set(["auth", "getToken", "getServerSession", "handleApiError", "NextResponse"]);

/**
 * 파라미터 목록 `)` 이후 **본문 `{`** 을 찾는다.
 *
 * ⚠️ `): Promise<{ ok: true } | ...> {` 처럼 반환 타입 주석이 `{` 를 먼저 내놓는다.
 *   그걸 본문으로 착각하면 헬퍼 본문이 `{ ok: true }` 로 잘리고 **검사를 못 읽는다**
 *   (실제로 이 단언의 자기검증이 그 오류를 잡았다 — §measurement-layer-blindness).
 *   유니온 반환 타입(`{ ok: false; response: NextResponse }`)은 `;` 를 포함하므로
 *   `;` 만으로는 못 가른다. **줄바꿈 + 실행문 키워드**로 가른다 — 타입 주석은 둘 다 없다.
 */
function findBodyBrace(src: string, afterParen: number): number {
  let idx = src.indexOf("{", afterParen);
  while (idx !== -1) {
    const block = src.slice(idx, matchBlock(src, idx) + 1);
    if (/\n/.test(block) && /\b(return|const|let|await|if|try)\b/.test(block)) return idx;
    idx = src.indexOf("{", matchBlock(src, idx) + 1);
  }
  return -1;
}

function collectFns(src: string): Record<string, string> {
  const fns: Record<string, string> = {};
  let m: RegExpExecArray | null;
  const re = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
  while ((m = re.exec(src))) {
    const pOpen = src.lastIndexOf("(", re.lastIndex);
    const b = findBodyBrace(src, matchBlock(src, pOpen, "(", ")"));
    if (b !== -1) fns[m[1]] = src.slice(b, matchBlock(src, b) + 1);
  }
  const re2 = /(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/g;
  while ((m = re2.exec(src))) {
    const pOpen = src.indexOf("(", m.index + m[0].length - 1);
    const pClose = matchBlock(src, pOpen, "(", ")");
    if (src.slice(pClose, pClose + 40).indexOf("=>") === -1) continue;
    const b = src.indexOf("{", pClose);
    if (b !== -1 && b - pClose < 40) fns[m[1]] = src.slice(b, matchBlock(src, b) + 1);
  }
  return fns;
}

function collectImports(src: string, selfAbs: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const names = m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
    const spec = m[2];
    let base: string | null = null;
    if (spec.startsWith("@/")) base = join(WEB_ROOT, "src", spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(selfAbs), spec);
    if (!base) continue;
    for (const cand of [base + ".ts", base + ".tsx", join(base, "index.ts")]) {
      if (existsSync(cand)) {
        for (const n of names) map[n] = cand;
        break;
      }
    }
  }
  return map;
}

/** 호출된 헬퍼(로컬·로컬모듈)를 재귀 인라인 — 허용목록 하드코딩 대신 **헬퍼 인식**으로 오탐 해소 */
function inlineHelpers(
  body: string,
  fns: Record<string, string>,
  imports: Record<string, string>,
  depth: number,
  seen: Set<string>,
): string {
  if (depth === 0 || typeof body !== "string") return typeof body === "string" ? body : "";
  let text = body;
  const called = [...new Set([...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]))];
  for (const name of called) {
    if (seen.has(name) || NOISE.has(name)) continue;
    seen.add(name);
    if (fns[name]) {
      text += "\n" + inlineHelpers(fns[name], fns, imports, depth - 1, seen);
    } else if (imports[name] && existsSync(imports[name])) {
      const modSrc = read(imports[name]);
      const modFns = collectFns(modSrc);
      if (modFns[name]) {
        text += "\n" + inlineHelpers(modFns[name], modFns, collectImports(modSrc, imports[name]), depth - 1, seen);
      }
    }
  }
  return text;
}

interface Handler {
  route: string; // /api/... 형태
  file: string; // repo 상대
  method: string;
  touchesTenant: boolean;
  hasOwnCheck: boolean;
  markers: string[];
}

export function collectHandlers(): Handler[] {
  const out: Handler[] = [];
  for (const abs of walk(API_ROOT)) {
    const src = read(abs);
    const fns = collectFns(src);
    const imports = collectImports(src, abs);
    const route =
      "/api" + relative(API_ROOT, dirname(abs)).split(/[\\/]/).filter(Boolean).map((s) => "/" + s).join("");

    const re = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const pOpen = src.lastIndexOf("(", re.lastIndex);
      const bodyStart = findBodyBrace(src, matchBlock(src, pOpen, "(", ")"));
      const body = src.slice(bodyStart, matchBlock(src, bodyStart) + 1);

      // enforceAction config 블록 제거 — config 안 userId 는 검사가 아니다
      let stripped = body;
      let i = 0;
      while ((i = stripped.indexOf("enforceAction(", i)) !== -1) {
        const open = stripped.indexOf("{", i);
        if (open === -1) break;
        stripped = stripped.slice(0, i) + stripped.slice(matchBlock(stripped, open) + 1);
      }

      const effective = inlineHelpers(stripped, fns, imports, 2, new Set());
      const markers = OWNER_PATTERNS.filter(([, r]) => r.test(effective)).map(([k]) => k);

      const machineAuth = MACHINE_AUTH.filter(([, r]) => r.test(effective)).map(([k]) => k);

      out.push({
        route,
        file: relative(WEB_ROOT, abs).replace(/\\/g, "/"),
        method: m[1],
        touchesTenant: TENANT_MODEL.test(effective),
        hasOwnCheck: markers.length > 0 || machineAuth.length > 0,
        markers: [...markers, ...machineAuth],
      });
    }
  }
  return out;
}

/**
 * 설계상 공개 — 토큰이 곧 자격증명인 경로.
 * 세션 사용자에 묶인 소유권 검사가 **있어서는 안 되는** 표면이므로 예외로 둔다.
 * 두 경로 모두 토큰 형식 검증 + rate limit 을 자체 방어로 갖는다.
 */
const BY_DESIGN_PUBLIC: Array<{ route: string; reason: string }> = [
  { route: "/api/share/[token]", reason: "공유 링크 — 토큰이 자격증명. isValidShareToken + rate limit" },
  { route: "/api/receiving/[token]", reason: "벤더 입고 링크 — 토큰이 자격증명. isValidVendorRequestToken + rate limit" },
  {
    route: "/api/organizations/check-slug",
    reason:
      "슬러그 가용성 조회 — 가입 폼의 중복 확인. 테넌트 행을 반환하지 않고 boolean 만 준다. " +
      "슬러그 선점 여부 노출은 이 기능의 정의 자체이며 멤버십 검사를 붙이면 가입 전 사용자가 쓸 수 없다",
  },
];

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe("§tenant-isolation A4 — 미들웨어 커버 집합 도출 (하드코딩 금지)", () => {
  const mwSrc = read(join(WEB_ROOT, "src", "middleware.ts"));
  const cov = deriveMiddlewareCoverage(mwSrc);

  it("matcher 가 /api 전체를 덮는다 (안 덮으면 커버 도출 자체가 무효)", () => {
    expect(cov.matcherCoversApi).toBe(true);
  });

  it("role 조건이 붙은 API 프리픽스를 도출한다", () => {
    expect(cov.roleCondition).toBeTruthy();
    expect(cov.gatedPrefixes.length).toBeGreaterThan(0);
  });

  it("도출된 커버 집합은 소스에서 읽은 값이다 — 리터럴이 middleware.ts 안에 실재", () => {
    for (const p of cov.gatedPrefixes) {
      expect(mwSrc).toContain(p);
    }
  });
});

describe("§tenant-isolation A4 — 테넌트 접촉 핸들러는 반드시 검사를 갖는다", () => {
  const cov = deriveMiddlewareCoverage(read(join(WEB_ROOT, "src", "middleware.ts")));
  const handlers = collectHandlers();

  const isMiddlewareCovered = (route: string) =>
    cov.gatedPrefixes.some((p) => route === p.replace(/\/$/, "") || route.startsWith(p));
  const isByDesignPublic = (route: string) => BY_DESIGN_PUBLIC.some((x) => x.route === route);

  const unguarded = handlers.filter(
    (h) => h.touchesTenant && !h.hasOwnCheck && !isMiddlewareCovered(h.route) && !isByDesignPublic(h.route),
  );

  it("핸들러 열거가 비어 있지 않다 (수집 로직이 죽으면 단언이 조용히 통과한다)", () => {
    expect(handlers.length).toBeGreaterThan(300);
    expect(handlers.some((h) => h.touchesTenant)).toBe(true);
  });

  it("소유권/조직 검사가 없는 테넌트 접촉 핸들러가 0 이다", () => {
    const report = unguarded.map((h) => `${h.method} ${h.route}  (${h.file})`).sort();
    expect(report).toEqual([]);
  });

  it("설계상 공개 예외는 3건뿐이며 각각 사유를 갖는다", () => {
    expect(BY_DESIGN_PUBLIC).toHaveLength(3);
    for (const x of BY_DESIGN_PUBLIC) expect(x.reason.length).toBeGreaterThan(10);
  });
});

describe("§tenant-isolation A4 — 자기검증: 배치 1·2 결과를 실제로 읽는가", () => {
  const handlers = collectHandlers();
  const find = (route: string, method: string) =>
    handlers.find((h) => h.route === route && h.method === method);

  it("배치 1 — quotes/[id]/status GET·PATCH 가 '검사 있음' 으로 분류된다", () => {
    for (const method of ["GET", "PATCH"]) {
      const h = find("/api/quotes/[id]/status", method);
      expect(h, `${method} 핸들러를 찾지 못했다`).toBeTruthy();
      expect(h!.hasOwnCheck, `${method} 가 검사 없음으로 분류됐다 — 단언이 방금 넣은 검사를 못 읽는다`).toBe(true);
    }
  });

  it("배치 2 — organizations/[id]/security GET 이 '검사 있음' 으로 분류된다", () => {
    const h = find("/api/organizations/[id]/security", "GET");
    expect(h).toBeTruthy();
    expect(h!.hasOwnCheck).toBe(true);
  });

  it("배치 2 — analytics/kpi 는 미들웨어 커버 경로로 이설됐고 구 경로는 없다", () => {
    const cov = deriveMiddlewareCoverage(read(join(WEB_ROOT, "src", "middleware.ts")));
    expect(existsSync(join(API_ROOT, "analytics", "kpi", "route.ts"))).toBe(false);
    expect(existsSync(join(API_ROOT, "admin", "analytics", "kpi", "route.ts"))).toBe(true);
    expect(cov.gatedPrefixes.some((p) => "/api/admin/analytics/kpi".startsWith(p))).toBe(true);
  });

  it("오분류 회귀 핀 — 로컬 헬퍼 경유 검사를 인식한다 (budgets/[id] isOrgAdminOrOwner)", () => {
    // 1차 분류에서 이 핸들러를 '검사 없음' 으로 오분류했다(헬퍼 미해석).
    // 허용목록이 아니라 헬퍼 인식으로 해소했음을 고정한다.
    const h = find("/api/budgets/[id]", "PATCH");
    expect(h).toBeTruthy();
    expect(h!.hasOwnCheck).toBe(true);
  });
});
