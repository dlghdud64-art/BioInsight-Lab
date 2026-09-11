/**
 * §placeholder-success-gate P2 (2026-09-11) — placeholder success 를 인스턴스가 아니라 부류로 닫는다.
 *
 * §placeholder-success-audit 4건(347069ce → a447945f · 6d9dcc1f · 22fa9ddd)과
 * vendor/auth/send-link(3a4b7700)는 전부 지웠지만, 같은 형태의 라우트가 새로 태어나면
 * 잡을 장치가 없었다. 원 감사가 send-link 를 놓친 이유: enforceAction 을 쓰는 파일만 갈랐다.
 * → 이 게이트는 enforceAction 유무와 무관하게 src/app/api 의 route.ts 전량을 본다.
 *
 * 판별기: __tests__/_helpers/placeholder-success-scan.ts (로직 한 벌)
 *
 * 🛑 한계 — 조항 11. 이 GREEN 은 아래 형태에 대해서는 아무것도 말하지 않는다.
 *   1. 동기 부작용을 못 본다. await 0 이어도 메모리 캐시 무효화 등 실제 부작용이 있을 수 있다
 *      (operational-brief/narrative DELETE 가 그 사례. 오탐이 아니라 판별식의 한계다).
 *   2. 헬퍼 내부 저장은 헬퍼 호출이 await 이면 잡힌다. 헬퍼가 await 없이 저장하면 못 본다.
 *   3. GET 은 대상 밖이다. GET mock(가짜 목록)은 §render-reachability-sweep 의 몫이다.
 *   4. new Response( 전용 응답은 안 본다. 2026-09-11 실측 0건이라 기계를 넣지 않았다.
 *   5. 상태 코드를 변수로 넘기면(status: code) 성공으로 친다. 리터럴 4xx · 5xx 만 실패로 본다.
 *   6. 선언은 export async function 형태만 스캔한다. 다른 형태(export const · 동기 function ·
 *      export { x as POST })는 "커버리지" 단언이 0 을 강제해 사각을 RED 로 바꾼다.
 *   7. 괄호 짝은 주석 제거본에서 문자열 · 템플릿을 건너뛰며 센다. 정규식 리터럴 안의 짝 없는 괄호는 못 본다.
 *
 * allowlist — CLAUDE.md 「예외 목록에는 만료일과 소유자」. 두 항목만 명시한다.
 *   검출이 늘면 allowlist 를 늘리는 게 아니라 RED 가 떠야 한다.
 *   allowlist 항목이 더 이상 검출되지 않아도 RED 다 — 목록은 줄어드는 방향으로만 움직인다.
 *   expires 가 날짜면 **그 날 0시(KST)부터 RED** 가 되어 재검토를 강제한다.
 *   해제는 날짜 갱신 또는 항목 제거 — 둘 다 사람이 판단한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import {
  scanSource,
  scanFiles,
  scanPlaceholderSuccess,
  isPlaceholderSuccess,
  unscannedHandlerForms,
  type MutatingMethod,
} from "../_helpers/placeholder-success-scan";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(APP_WEB_ROOT, "src", "app", "api");

function collectRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectRoutes(full, acc);
    else if (entry === "route.ts") acc.push(full.slice(APP_WEB_ROOT.length + 1).split(sep).join("/"));
  }
  return acc;
}

const ROUTES = collectRoutes(API_ROOT);

interface AllowEntry {
  route: string;
  method: MutatingMethod;
  reason: string;
  /** null = 영구. YYYY-MM-DD 면 그 날 0시(KST)부터 RED 가 된다. */
  expires: string | null;
  owner: string;
}

const ALLOWLIST: AllowEntry[] = [
  {
    route: "src/app/api/admin/canary-control/route.ts",
    method: "POST",
    reason:
      "설계상 계산기 · DB·파일 무기록. 새 config JSON 을 계산해 돌려주고 운영자가 AI_CANARY_CONFIG env 를 직접 갱신한다. 347069ce 에서 이미 판정.",
    expires: null,
    owner: "호영",
  },
  {
    route: "src/app/api/operational-brief/narrative/route.ts",
    method: "DELETE",
    reason:
      "판별식 한계 · await 0 이지만 invalidateCachedBriefNarrative 로 동기 캐시 무효화를 실제로 수행한다. { invalidated: true } 는 정직한 응답이다.",
    expires: "2026-12-11",
    owner: "호영",
  },
];

/** 만료일 판정 기준 — 그 날 0시(KST). Date.parse("YYYY-MM-DD") 는 UTC 0시라 9시간 늦게 RED 가 된다. */
const expiresAtMs = (d: string) => Date.parse(`${d}T00:00:00+09:00`);

const key = (x: { route?: string; file?: string; method: string }) => `${x.method} ${x.route ?? x.file}`;

describe("§placeholder-success-gate · 판별기 단위 (고정 입력)", () => {
  const hit = (src: string) => scanSource(src, "fixture.ts").filter(isPlaceholderSuccess).length;

  it("저장 없이 200 JSON 을 내는 POST 는 잡힌다", () => {
    const src = `export async function POST(request: NextRequest) {
      const session = await auth();
      if (!session) return NextResponse.json({ error: "x" }, { status: 401 });
      const body = await request.json();
      return NextResponse.json({ success: true });
    }`;
    expect(hit(src)).toBe(1);
  });

  it("의미 있는 await(저장)가 있으면 잡지 않는다", () => {
    const src = `export async function POST(request: NextRequest) {
      const body = await request.json();
      await db.item.create({ data: body });
      return NextResponse.json({ success: true });
    }`;
    expect(hit(src)).toBe(0);
  });

  it("실패 응답(4xx · 5xx)만 내면 잡지 않는다", () => {
    const src = `export async function POST() {
      return NextResponse.json({ error: "not implemented" }, { status: 501 });
    }`;
    expect(hit(src)).toBe(0);
  });

  it("여러 줄 구조분해 인자의 { 를 본문으로 오인하지 않는다", () => {
    const src = `export async function DELETE(
      request: NextRequest,
      { params }: { params: { id: string } }
    ) {
      const { id } = await params;
      return NextResponse.json({ deleted: id });
    }`;
    const scans = scanSource(src, "fixture.ts");
    expect(scans).toHaveLength(1);
    expect(scans[0].extracted).toBe(true);
    expect(hit(src)).toBe(1);
  });

  it("주석 안의 await 는 저장으로 치지 않는다", () => {
    const src = `export async function PATCH() {
      // await db.item.update({})
      /* await db.item.delete({}) */
      return NextResponse.json({ ok: true });
    }`;
    expect(hit(src)).toBe(1);
  });

  it("템플릿의 \${} 가 본문 끝을 앞당기지 않는다", () => {
    const src = `export async function PUT() {
      const label = \`id \${1 + 1}\`;
      await db.item.update({ where: { id: label } });
      return NextResponse.json({ ok: true });
    }`;
    expect(hit(src)).toBe(0);
  });

  it("스캔하지 않는 선언 형태를 식별한다", () => {
    expect(unscannedHandlerForms("export const POST = async () => {};")).toHaveLength(1);
    expect(unscannedHandlerForms("export function DELETE() {}")).toHaveLength(1);
    expect(unscannedHandlerForms("export { handler as PATCH };")).toHaveLength(1);
    expect(unscannedHandlerForms("export async function POST() {}")).toHaveLength(0);
  });
});

describe("§placeholder-success-gate · src/app/api 전량", () => {
  it("판별 대상이 실제로 있다 (0 을 성공으로 읽지 않는다)", () => {
    expect(ROUTES.length).toBeGreaterThan(100);
    expect(scanFiles(ROUTES, APP_WEB_ROOT).length).toBeGreaterThan(100);
  });

  /*
   * 🛑 이 단언을 "중복 같다" 며 지우지 말 것.
   *   export const POST = async (...) => {} 가 하나라도 생기면 스캐너는 그 핸들러를 0개로 세고
   *   아래 "allowlist 밖 0" 은 **조용히 GREEN** 이 된다 — 조항 8(부재를 성공으로 읽지 않는다)의
   *   정확한 재현이다. 스캔 범위 밖 형태를 RED 로 바꾸는 것이 이 단언의 일이다.
   *   실측 2026-09-11: 변경 핸들러를 가진 route.ts 195개 전부 export async function.
   *   다른 선언 형태 0. 이 단언이 그 전제를 잠근다.
   */
  it("커버리지 · 스캔하지 않는 형태의 변경 핸들러 0", () => {
    const offenders = ROUTES.filter(
      (f) => unscannedHandlerForms(readFileSync(join(APP_WEB_ROOT, f), "utf8")).length > 0,
    );
    expect(offenders).toEqual([]);
  });

  it("본문 추출 실패 0 (판별 불가 핸들러가 없다)", () => {
    const failed = scanFiles(ROUTES, APP_WEB_ROOT).filter((h) => !h.extracted).map(key);
    expect(failed).toEqual([]);
  });

  it("allowlist 밖의 placeholder success 0", () => {
    const allowed = new Set(ALLOWLIST.map(key));
    const offenders = scanPlaceholderSuccess(ROUTES, APP_WEB_ROOT).map(key).filter((k) => !allowed.has(k));
    expect(offenders).toEqual([]);
  });
});

describe("§placeholder-success-gate · allowlist 는 줄어드는 방향으로만", () => {
  const hits = new Set(scanPlaceholderSuccess(ROUTES, APP_WEB_ROOT).map(key));

  it.each(ALLOWLIST)("$method $route 가 여전히 검출된다 (안 잡히면 목록에서 뺀다)", (e) => {
    expect(hits.has(key(e))).toBe(true);
  });

  it.each(ALLOWLIST)("$method $route 에 사유 · 소유자가 있고 만료 표기가 올바르다", (e) => {
    expect(e.reason.trim().length).toBeGreaterThan(10);
    expect(e.owner.trim()).not.toBe("");
    if (e.expires !== null) {
      expect(e.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(expiresAtMs(e.expires))).toBe(false);
    }
  });

  it("allowlist 예외가 만료되지 않았다 (만료일 0시 KST 부터 RED)", () => {
    const expired = ALLOWLIST.filter((e) => e.expires !== null && Date.now() >= expiresAtMs(e.expires));
    expect(expired.map((e) => `${e.route} (${e.expires})`)).toEqual([]);
  });
});

describe("§placeholder-success-gate · 회귀 0", () => {
  it("판별기는 주석 제거를 em-dash-scan 의 stripComments 로 한다 (로직 한 벌)", () => {
    const helper = readFileSync(join(APP_WEB_ROOT, "src/__tests__/_helpers/placeholder-success-scan.ts"), "utf8");
    expect(helper).toMatch(/import\s*\{\s*stripComments\s*\}\s*from\s*"\.\/em-dash-scan"/);
    expect(helper).not.toMatch(/function\s+stripComments\s*\(/);
  });
});
