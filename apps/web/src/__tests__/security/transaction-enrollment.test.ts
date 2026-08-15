/**
 * §placeholder-success 3번째 사례 — 회귀 차단 단언
 *
 * 🛑 **이건 회귀 차단이고 판정이 아니다.** (A4 단언과 같은 층)
 *
 * 등급 한계 — GREEN 은 무결 증명이 아니다:
 *   - 정적 스캔이다. `$transaction` 콜백 안에서 **전역 db 식별자가 보이는지**만 본다
 *   - 헬퍼를 경유해 전역 db 에 닿는 간접 경로는 **안 보인다**
 *     (예: `await someHelper()` 안에서 전역 db 를 쓰는 경우)
 *   - 콜백 스코프 판정은 괄호 균형 기반이다. 중첩 화살표·즉시실행에서 어긋날 수 있다
 *   - **편입의 유일한 판정은 런타임 롤백 프로브다**(§audit-integrity-fix §4.7):
 *     업무 쓰기 롤백 유발 → 감사 델타 0 이어야 편입 성공
 *
 * 왜 필요한가 — 이 형태로 **세 번** 통과했다:
 *   1. `getOrganizationById` 팬텀 파라미터 (받지만 안 쓴다)
 *   2. `enforceAction` 조직 게이트 `(a)≡(b)` (검사하지만 항등)
 *   3. `$transaction` 안의 전역 db (감싸여 보이지만 밖)
 *   코드 독해로 세 번 통과했으면 네 번째도 통과한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(WEB_ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** src[i] === '(' → 짝 ')' 인덱스. 문자열 리터럴 인지. */
function closeParen(s: string, i: number): number {
  let d = 0;
  let j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      j++;
      while (j < s.length && s[j] !== q) {
        if (s[j] === "\\") j++;
        j++;
      }
    } else if (c === "(") d++;
    else if (c === ")") {
      d--;
      if (d === 0) return j;
    }
    j++;
  }
  return -1;
}

/**
 * `$transaction(...)` **콜백 형태**의 본문 구간 목록.
 *
 * 🛑 배열 형태 `db.$transaction([ db.a.update(), db.b.update() ])` 는 제외한다.
 *    Prisma 배치 API 는 전역 클라이언트로 만든 연산 배열을 받아 **한 트랜잭션으로 실행**한다 —
 *    거기서 전역 `db` 는 정상이다. 1차 실행이 이걸 못 갈라 오탐 2건을 냈다
 *    (corrupt→RED 는 탐지를 증명할 뿐 **정밀도를 증명하지 않는다**).
 */
function txScopes(src: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (;;) {
    const t = src.indexOf("$transaction", from);
    if (t < 0) break;
    const open = src.indexOf("(", t);
    const end = open >= 0 ? closeParen(src, open) : -1;
    if (open >= 0 && end > open) {
      const head = src.slice(open + 1, open + 120);
      // 콜백 형태: (async)? (params) => ...  /  (async)? ident => ...
      if (/^\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/.test(head)) {
        out.push({ start: open, end });
      }
    }
    from = t + "$transaction".length;
  }
  return out;
}

/** 트랜잭션 콜백 안의 전역 db/dbTyped 참조 */
export function findGlobalDbInTx(src: string): number[] {
  const hits: number[] = [];
  for (const sc of txScopes(src)) {
    const body = src.slice(sc.start, sc.end);
    for (const m of body.matchAll(/(?<![\w.$])(db|dbTyped)\s*\./g)) {
      // `db.$transaction(` 자기 자신은 제외
      if (/^\s*\$transaction/.test(body.slice(m.index! + m[0].length))) continue;
      hits.push(sc.start + m.index!);
    }
  }
  return hits;
}

describe("§placeholder-success #3 — $transaction 콜백 안의 전역 db", () => {
  it("corrupt→RED — 탐지기가 실제로 잡는지 먼저 증명한다", () => {
    const clean = `
      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.productInventory.update({ where: { id }, data: {} });
        await createAuditLog({ userId }, tx);
      });
    `;
    const corrupt = `
      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.productInventory.update({ where: { id }, data: {} });
        await db.auditLog.create({ data: {} });
      });
    `;
    // 배열 형태는 정상 — 오탐 방지가 걸려 있는지도 함께 증명한다
    const batchForm = `
      await db.$transaction(
        items.map((item: any) => db.quoteListItem.update({ where: { id: item.id }, data: {} }))
      );
    `;
    expect(findGlobalDbInTx(clean)).toHaveLength(0);
    expect(findGlobalDbInTx(batchForm)).toHaveLength(0); // ← 오탐 0
    expect(findGlobalDbInTx(corrupt).length).toBeGreaterThan(0); // ← RED 실증
  });

  it("전역 db 참조 = 0", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("$transaction")) continue;
      const hits = findGlobalDbInTx(src);
      for (const at of hits) {
        const line = src.slice(0, at).split("\n").length;
        offenders.push(`${relative(WEB_ROOT, f).replace(/\\/g, "/")}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
