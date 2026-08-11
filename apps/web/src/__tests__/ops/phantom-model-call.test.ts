/**
 * §phantom-model-call — 생성된 Prisma Client 에 없는 모델을 호출하지 않는다
 *
 * 배경 (2026-08-10, §audit-foundation ① 검증 ①이 `ComplianceLink` 를 잡은 뒤 전수):
 *   `src/lib/db.ts` 의 `db` 는 **`any`** 로 선언돼 있다(Prisma 미생성 시 stub 폴백 구조).
 *   그래서 `db.존재하지않는모델.findMany()` 가 **컴파일을 통과하고 런타임에만 실패**한다.
 *   tsc·build·vitest 어느 것도 잡지 못하는 클래스다.
 *
 *   전수 실측 결과 유령 호출은 1건이 아니라 **6종 20회 / 10파일**이었다.
 *
 * 계약:
 *   P1. `db|dbAny|prisma|tx.<model>.<prismaMethod>` 의 `<model>` 은 전부 실재 모델이다.
 *       (LEGACY 목록으로 고정 — ratchet. 줄어들기만 한다)
 *   P2. 수집이 실제로 동작한다 (공허 GREEN 방지).
 *
 * ⚠️ 이 판정기의 한계 — 먼저 적어둔다(정규식 한계를 두 번 겪었다):
 *   · 변수명이 `db`/`prisma`/`tx`/`dbAny` 인 것만 본다. 다른 이름으로 alias 하면 못 본다.
 *   · 동적 접근(`db[modelName]`)은 못 본다.
 *   · `$queryRawUnsafe` / `$executeRawUnsafe` 안의 테이블명은 검사 대상이 아니다
 *     (실측 90회 / 46회 — 별도 표면).
 *   · 모델 목록은 **생성된 Client 가 아니라 schema.prisma** 에서 읽는다.
 *     테스트가 DB 연결 없이 돌아야 하기 때문이다. 생성이 밀려 있으면 둘이 갈릴 수 있다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");

/** schema.prisma 의 model 선언 -> Prisma Client 프로퍼티명(첫 글자 소문자) */
function schemaModels(): Set<string> {
  const schema = readFileSync(join(WEB_ROOT, "prisma", "schema.prisma"), "utf8");
  const out = new Set<string>();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{/gm)) {
    const n = m[1];
    out.add(n.charAt(0).toLowerCase() + n.slice(1));
  }
  return out;
}

function readSource(path: string): string {
  const raw = readFileSync(path);
  if (raw[0] === 0xff && raw[1] === 0xfe) return raw.toString("utf16le");
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) return raw.slice(3).toString("utf8");
  return raw.toString("utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const PRISMA_METHOD =
  "findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate|groupBy|" +
  "create|createMany|update|updateMany|upsert|delete|deleteMany";

const MODELS = schemaModels();
const CALLS: { file: string; model: string }[] = [];
for (const f of sourceFiles(join(WEB_ROOT, "src"))) {
  const code = stripComments(readSource(f));
  const re = new RegExp(`\\b(?:db|dbAny|prisma|tx)\\.([a-z][A-Za-z0-9]*)\\.(?:${PRISMA_METHOD})\\b`, "g");
  for (const m of code.matchAll(re)) {
    CALLS.push({ file: f.slice(WEB_ROOT.length + 1).split("\\").join("/"), model: m[1] });
  }
}

/**
 * 2026-08-10 실측 유령 호출 — **줄어들기만 한다.**
 * 여기에 추가하는 것은 회귀이며, 고쳤으면 목록에서 빼야 통과한다.
 */
const LEGACY_PHANTOM: readonly string[] = [
  "complianceLink",       // 모델 자체 부재 — §compliance-link-model-missing
  "inventory",            // 실제 모델은 ProductInventory
  "inventoryAlertLog",    // 모델 부재
  "inventoryAlertSetting",// 모델 부재
  "purchase",             // 실제 모델은 PurchaseRecord
  "quoteList",            // 실제 모델은 Quote / QuoteListItem
];

describe("§phantom-model-call P2 — 수집이 실제로 동작한다", () => {
  it("모델 목록과 호출 지점이 비어 있지 않다", () => {
    expect(MODELS.size).toBeGreaterThan(50);
    expect(CALLS.length).toBeGreaterThan(200);
  });
});

describe("§phantom-model-call P1 — 유령 모델 호출 0 (ratchet)", () => {
  it("LEGACY 목록 밖에서 신규 유령 호출이 없다", () => {
    const legacy = new Set(LEGACY_PHANTOM);
    const fresh = [...new Set(CALLS.filter((c) => !MODELS.has(c.model) && !legacy.has(c.model))
      .map((c) => `${c.model} @ ${c.file}`))].sort();
    expect(fresh).toEqual([]);
  });

  it("고쳐진 LEGACY 항목은 목록에서 제거돼야 한다 (stale 방지)", () => {
    const called = new Set(CALLS.map((c) => c.model));
    const fixed = LEGACY_PHANTOM.filter((m) => !called.has(m) || MODELS.has(m));
    expect(fixed).toEqual([]);
  });
});
