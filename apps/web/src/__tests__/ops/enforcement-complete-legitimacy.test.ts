/**
 * §enforcement-handle-close E8 — complete() 는 실제 쓰기가 있을 때만 부른다 (ratchet, 0 시작)
 *
 * 배경 (2026-08-10~12):
 *   sweep(E1~E6)은 "핸들을 닫지 않은 74건" 만 다뤘다. **"이미 닫혀 있으나 잘못 닫은"
 *   95건은 검사 대상이 아니었다** — 구조적 사각. 실측에서 `analytics/ai-insight` 가
 *   읽기 전용인데 `complete()` 를 부르고 있었고(→ fail() 로 교정),
 *   `complete()` 는 인자가 없어도 audit envelope 을 append 하므로
 *   (beforeState/afterState 가 `status: pending→completed` 기본값으로 채워짐)
 *   영속화(§audit-persistence-gap) 직후부터 **거짓 감사 기록**이 된다.
 *
 * 판정기:
 *   핸들러 본문의 직접 쓰기 + **import 헬퍼 1~2단계 해석**으로 쓰기 유무를 판정한다.
 *   직접 쓰기만 보면 31건이 오탐이었고, 헬퍼 해석 후 진짜는 1건이었다(실측).
 *
 * ⚠️ 판정기의 한계 — 먼저 적어둔다 (정규식 한계를 세 번 겪었다):
 *   · **3단계 이상 경유**는 못 본다 (깊이 2 에서 자른다).
 *   · **동적 디스패치 / 모듈 수준 인스턴스**는 못 본다 — 예: `ingestion` 의
 *     `gateway.execute(...)` 는 모듈 수준 `new ShadowRuntimeGateway()` 인스턴스라
 *     import 이름이 본문에 등장하지 않는다. 수동 실측으로 쓰기 확인 → 예외 목록.
 *   · 변수 재할당/alias 를 못 본다.
 *   · 한계로 인한 오판은 **오탐(false RED) 방향**이다 — 쓰기를 못 찾아 offender 로
 *     분류한다. 예외 목록 등재 시 반드시 수동 실측 근거를 주석으로 남긴다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readSource(path: string): string {
  const raw = readFileSync(path);
  if (raw[0] === 0xff && raw[1] === 0xfe) return raw.toString("utf16le");
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) return raw.slice(3).toString("utf8");
  return raw.toString("utf8");
}

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

/**
 * DB 쓰기 표지 — dbAny / dbTyped / $executeRaw 계열 포함.
 * ⚠️ `dbTyped` 누락이 첫 실행에서 오탐 2건(quote-lists)을 냈다 —
 *    `\bdb\.` 는 "dbTyped." 안의 db 에 매칭되지 않는다(뒤가 `.` 이 아님).
 *    변수명 목록 방식의 한계 그대로다: 새 접근자가 생기면 여기도 늘려야 한다.
 */
const WRITE_RE =
  /\b(?:db|dbAny|dbTyped|prisma|tx|client)\.[a-zA-Z]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b|\$execute(?:Raw|RawUnsafe)\b|\$transaction\b/;

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(WEB_ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null;
  for (const cand of [base + ".ts", base + ".tsx", join(base, "index.ts")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

const writesCache = new Map<string, boolean>();

/** 파일(및 그 import 1단계 추가)에 DB 쓰기가 있는가 — 깊이 2 제한 */
function fileWrites(path: string, depth: number, seen: Set<string>): boolean {
  if (seen.has(path) || depth > 2) return false;
  seen.add(path);
  const cacheKey = path;
  if (depth === 0 && writesCache.has(cacheKey)) return writesCache.get(cacheKey)!;
  let code: string;
  try {
    code = stripComments(readSource(path));
  } catch {
    return false;
  }
  let result = WRITE_RE.test(code);
  if (!result && depth < 2) {
    for (const m of code.matchAll(/from\s+["']([^"']+)["']/g)) {
      const tgt = resolveImport(m[1], path);
      if (tgt && fileWrites(tgt, depth + 1, seen)) {
        result = true;
        break;
      }
    }
  }
  if (depth === 0) writesCache.set(cacheKey, result);
  return result;
}

interface Handler {
  file: string;
  method: string;
  body: string;
  imports: Map<string, string>; // name -> resolved path
}

function handlersOf(absPath: string): Handler[] {
  const rel = absPath.slice(WEB_ROOT.length + 1).split("\\").join("/");
  const code = stripComments(readSource(absPath));
  const imports = new Map<string, string>();
  for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const tgt = resolveImport(m[2], absPath);
    if (!tgt) continue;
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) imports.set(name, tgt);
    }
  }
  const starts = [...code.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)];
  return starts.map((m, i) => ({
    file: rel,
    method: m[1],
    body: code.slice(m.index!, starts[i + 1]?.index ?? code.length),
    imports,
  }));
}

/**
 * 헬퍼 해석에서 제외하는 import — DB 클라이언트 모듈 자체.
 *
 * ⚠️ 초판 사고: `db` import 를 헬퍼로 해석하면 `lib/db.ts` 의 **폴백 stub 정의**
 * (`$transaction: ...`, `$executeRaw: ...`)가 쓰기 표지에 걸려 **모든 핸들러에 쓰기를
 * 인정**해 버린다 → E8 이 공허 GREEN 이 됐고 corrupt→RED 가 실패해서 드러났다.
 * db 사용의 쓰기 여부는 핸들러 본문의 직접 검사(WRITE_RE)가 담당한다.
 */
const DB_MODULE_NAMES = new Set(["db", "dbTyped", "dbAny", "prisma", "isPrismaAvailable"]);

/** 핸들러가 (직접 또는 헬퍼 경유로) DB 를 쓰는가 */
function handlerWrites(h: Handler): boolean {
  if (WRITE_RE.test(h.body)) return true;
  for (const [name, tgt] of h.imports) {
    if (name === "auth") continue; // 세션 조회 — 쓰기 아님(전 핸들러 공통이라 명시 제외)
    if (DB_MODULE_NAMES.has(name) || /[\\/]lib[\\/]db\.ts$/.test(tgt)) continue;
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\(|\\.)`).test(h.body)) {
      if (fileWrites(tgt, 1, new Set([h.file]))) return true;
    }
  }
  return false;
}

/**
 * 판정기 한계로 인한 오탐의 **수동 실측 예외 목록** — 각 항목에 근거 필수.
 * 여기 추가하려면 그 핸들러가 실제로 쓰기를 함을 실측해야 한다.
 */
const E8_VERIFIED_WRITERS: readonly string[] = [
  // gateway.execute() 가 모듈 수준 `new ShadowRuntimeGateway()` 인스턴스 경유로
  // IngestionEntry 를 생성한다(2026-08-10 실측). import 이름이 본문에 없어 판정기가 못 본다.
  "src/app/api/ingestion/route.ts POST",
];

const HANDLERS = routeFiles(API_ROOT).flatMap(handlersOf);
const WITH_COMPLETE = HANDLERS.filter((h) => /enforcement\??\.complete\s*\(/.test(h.body));

describe("§enforcement-handle-close E8 — 수집이 실제로 동작한다", () => {
  it("complete() 를 부르는 핸들러가 수집된다 (공허 GREEN 방지)", () => {
    expect(HANDLERS.length).toBeGreaterThan(150);
    expect(WITH_COMPLETE.length).toBeGreaterThan(50);
  });
});

describe("§enforcement-handle-close E8 — 쓰기 없는 핸들러는 complete() 를 부르지 않는다", () => {
  it("offender 0 (ratchet — 0 에서 시작한다)", () => {
    const verified = new Set(E8_VERIFIED_WRITERS);
    const offenders = WITH_COMPLETE
      .filter((h) => !handlerWrites(h))
      .map((h) => `${h.file} ${h.method}`)
      .filter((key) => !verified.has(key))
      .sort();
    expect(offenders).toEqual([]);
  });

  it("예외 목록이 stale 하지 않다 — 등재 핸들러는 여전히 complete() 를 부른다", () => {
    const keys = new Set(WITH_COMPLETE.map((h) => `${h.file} ${h.method}`));
    const stale = E8_VERIFIED_WRITERS.filter((k) => !keys.has(k));
    expect(stale).toEqual([]);
  });
});
