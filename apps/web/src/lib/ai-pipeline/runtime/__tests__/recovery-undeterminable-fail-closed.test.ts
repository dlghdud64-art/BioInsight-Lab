/**
 * §recovery-undeterminable — 판별 불가는 통과가 아니다 (fail-closed)
 *
 * 명제 A  감사 체인 검사를 **수행하지 못한** 경우(모듈 로딩 실패·평가 중 예외)는
 *         passed:false + undeterminable:true 로 보고한다. 통과로 세지 않는다.
 *         (이전: coordinator AUDIT_HOP_COMPLETENESS 는 "audit hops complete",
 *          verifyRecovery 는 auditOk = true · 감사를 못 불렀는데 "감사 확인됨")
 * 명제 B  undeterminable 은 운영자에게 보여주기 위한 표지이지 분기용이 아니다.
 *         이 값을 읽고 통과시키는 호출부가 생기면 A 가 무너진다.
 * 명제 C  정본 감사 이벤트를 조용히 버리지 않는다 · 버렸으면 표지를 남긴다 (coordinator emit bridge).
 *
 * 축: 정적(주석 제거본). 모듈 로딩 실패를 런타임에서 재현하는 것은 require → import 전환(②) 뒤에
 *     vi.mock 으로 가능해진다 — 그때 행위 단언을 더한다.
 * 한계: 감사 검사 호출을 try 본문의 **심볼 이름**(checkAuditChainReconstructable · buildTimelineFromRepo)으로
 *     식별한다. 다른 이름의 래퍼를 거쳐 부르는 catch 는 이 검사 밖이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../../../__tests__/_helpers/em-dash-scan";

const RECOVERY = join(__dirname, "..", "core", "recovery");
const RUNTIME = join(__dirname, "..");

function code(abs: string): string {
  return stripComments(readFileSync(abs, "utf8").replace(/\r\n/g, "\n"));
}

/** open 위치의 `{` 와 짝이 맞는 `}` 까지(포함). 블록 경계로 창을 연다(4원칙 ⑤). */
function blockFrom(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error("unbalanced block at " + open);
}

interface TryCatch { file: string; tryBody: string; catchParam: string; catchBody: string }

function tryCatches(file: string, src: string): TryCatch[] {
  const out: TryCatch[] = [];
  const re = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tryBody = blockFrom(src, m.index + m[0].length - 1);
    const after = src.slice(m.index + m[0].length - 1 + tryBody.length);
    const c = after.match(/^\s*catch\s*\(\s*(\w+)\s*\)\s*\{/);
    if (!c) continue;
    const catchBody = blockFrom(after, c[0].length - 1);
    out.push({ file, tryBody, catchParam: c[1], catchBody });
  }
  return out;
}

const recoveryFiles = readdirSync(RECOVERY).filter((f) => f.endsWith(".ts"));
const all = recoveryFiles.flatMap((f) => tryCatches(f, code(join(RECOVERY, f))));
const AUDIT_CALL = /\b(checkAuditChainReconstructable|buildTimelineFromRepo)\s*\(/;
const auditCatches = all.filter((t) => AUDIT_CALL.test(t.tryBody));

describe("§recovery-undeterminable · 판별 불가는 통과가 아니다", () => {
  it("A0 · 감사 체인 검사를 감싼 catch 의 위치 집합", () => {
    // 이 집합이 바뀌면 새 자리가 명제 A 를 지키는지 아래 A1~A3 이 본다. 목록 갱신 시 커밋을 같은 줄에 적는다.
    expect(auditCatches.map((t) => t.file).sort()).toEqual([
      "recovery-coordinator.ts", // AUDIT_HOP_COMPLETENESS
      "recovery-coordinator.ts", // verifyRecovery AUDIT_CHAIN_VALID
      "recovery-diagnostics.ts", // 진단 #4 정본 체인 (판별 불가 → ERROR 진단 · CLEAN 아님)
      "recovery-preconditions.ts", // checkAuditChainReconstructable 본체
      "recovery-startup.ts", // 기동 선행조건 #3
      "recovery-startup.ts", // 기동 스캔 4b (판별 불가 → AUDIT_CHAIN_UNDETERMINABLE · 깨짐과 같은 등급)
    ]);
  });

  it.each(auditCatches.map((t, i) => [`${t.file}#${i}`, t] as const))(
    "A1 · %s catch 는 통과로 세지 않는다",
    (_label, t) => {
      expect(t.catchBody).not.toMatch(/passed\s*:\s*true/);
      expect(t.catchBody).not.toMatch(/\bauditOk\s*=\s*true/);
      expect(t.catchBody).not.toMatch(/\bchainOk\s*=\s*true/);
    },
  );

  it.each(auditCatches.map((t, i) => [`${t.file}#${i}`, t] as const))(
    "A2 · %s catch 는 판별 불가 표지와 원인을 남긴다",
    (_label, t) => {
      // 표지 3형: 결과 객체 undeterminable:true · 지연 기록 변수 · 진단 reasonCode(+ ERROR 등급)
      expect(t.catchBody).toMatch(
        /undeterminable\s*:\s*true|UndeterminableDetail\s*=|reasonCode\s*:\s*"[A-Z_]*UNDETERMINABLE"[\s\S]*severity\s*:\s*"ERROR"/,
      );
      // 원인(catch 인자)이 detail 로 흘러간다 — 인자 이름은 back-reference 로 묶는다
      expect(`${t.catchParam}\n${t.catchBody}`).toMatch(/^(\w+)\n[\s\S]*\b\1 instanceof Error \? \1\.message : String\(\1\)/);
    },
  );

  it("A3 · 빈 catch 뒤로 통과 return 이 떨어지는 형태 0 (옛 AUDIT_HOP_COMPLETENESS 형태)", () => {
    const empty = auditCatches.filter((t) => /^\{\s*\}$/.test(t.catchBody));
    expect(empty.map((t) => t.file)).toEqual([]);
  });

  it("A4 · undeterminable:true 를 담는 객체 리터럴은 전부 passed:false 를 함께 담는다", () => {
    const bad: string[] = [];
    let seen = 0;
    for (const f of recoveryFiles) {
      const src = code(join(RECOVERY, f));
      const re = /undeterminable\s*:\s*true/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        seen++;
        const open = src.lastIndexOf("{", m.index);
        const obj = blockFrom(src, open);
        if (!/passed\s*:\s*false/.test(obj)) bad.push(`${f}: ${obj.replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(seen).toBeGreaterThan(0); // 검사 대상이 사라지면 이 단언이 무의미해진다
    expect(bad).toEqual([]);
  });
});

describe("§recovery-undeterminable · undeterminable 은 분기용이 아니다", () => {
  it("B1 · runtime 전역에서 .undeterminable 을 읽는 문장은 통과를 만들지 않는다", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "__tests__") walk(p); continue; }
        if (!e.name.endsWith(".ts")) continue;
        const src = code(p);
        const re = /\.undeterminable\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          const start = Math.max(src.lastIndexOf(";", m.index), src.lastIndexOf("{", m.index)) + 1;
          const end = src.indexOf(";", m.index);
          const stmt = src.slice(start, end);
          if (/passed\s*:\s*true|=\s*true\b|return\s+true|\bcontinue\b/.test(stmt)) hits.push(`${e.name}: ${stmt.replace(/\s+/g, " ").trim().slice(0, 120)}`);
        }
      }
    };
    walk(RUNTIME);
    expect(hits).toEqual([]);
  });
});

describe("§recovery-undeterminable · 검사 결과 변수의 초기값은 합격이 아니다", () => {
  // 초기값이 합격이면 검사를 건너뛴 경우와 통과한 경우가 구별되지 않는다.
  // 실측 2026-09-18: verifyRecovery 가 correlationId 미발견 시 감사 검사를 건너뛰고 auditOk 초기값 true 를
  //   "valid" 로 보고. A 축(catch)으로는 안 보였다 — 결함이 catch 가 아니라 초기값에 있었다.
  // 검사 결과 변수 = `passed: X` 로 흘러가거나 `X = y.passed` 로 대입되는 식별자.
  it("D1 · runtime 전역에서 검사 결과 변수를 true 로 초기화하는 선언 0", () => {
    const hits: string[] = [];
    let carriers = 0;
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "__tests__") walk(p); continue; }
        if (!e.name.endsWith(".ts")) continue;
        const src = code(p);
        const names = new Set<string>();
        for (const m of src.matchAll(/\bpassed\s*:\s*([A-Za-z_$][\w$]*)\b/g)) if (m[1] !== "true" && m[1] !== "false") names.add(m[1]);
        for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*[\w$.]+\.passed\b/g)) names.add(m[1]);
        if (names.size) carriers++;
        for (const n of names) {
          const re = new RegExp(`\\b(?:let|var)\\s+${n}(?:\\s*:\\s*boolean)?\\s*=\\s*true\\b`);
          if (re.test(src)) hits.push(`${e.name}: ${n}`);
        }
      }
    };
    walk(RUNTIME);
    expect(carriers).toBeGreaterThan(0); // 검사 대상이 사라지면 이 단언이 무의미해진다
    expect(hits).toEqual([]);
  });

  it("D2 · verifyRecovery 의 생략 경로 3곳은 판별 불가를 남긴다 (correlationId · baseline/스냅샷 · 레코드)", () => {
    const src = code(join(RECOVERY, "recovery-coordinator.ts"));
    const start = src.indexOf("export async function verifyRecovery(");
    // 반환 타입이 Promise<{ … }> 라 첫 `{` 는 타입 리터럴이다 — 타입 닫힘 `}> {` 뒤에서 본문을 연다
    expect(start).toBeGreaterThan(-1);
    const body = blockFrom(src, src.indexOf("}> {", start) + 3);
    for (const name of ["AUDIT_CHAIN_VALID", "RESIDUE_SCAN_CLEAN", "RECOVERY_AUDIT_HOPS"]) {
      // 같은 check 이름으로 undeterminable 분기가 있다 — 분기 단위로 묶는다(4원칙 ④)
      expect(body).toMatch(new RegExp(`\\{\\s*name:\\s*"${name}",\\s*passed:\\s*false,\\s*undeterminable:\\s*true,`));
    }
    // correlationId 생략 경로: 검사 블록의 else 가 판별 불가 사유를 기록한다
    //   (AUDIT_CHAIN_VALID 리터럴은 catch 경로와 공유되므로 위 단언만으로는 이 분기를 지워도 GREEN)
    const ifAt = body.indexOf("if (correlationForAudit) {");
    expect(ifAt).toBeGreaterThan(-1);
    const thenBlock = blockFrom(body, body.indexOf("{", ifAt));
    const rest = body.slice(body.indexOf("{", ifAt) + thenBlock.length);
    expect(rest).toMatch(/^\s*else\s*\{\s*auditUndeterminableDetail\s*=/);
  });
});

describe("§recovery-undeterminable · 정본 감사 이벤트 소실 표지", () => {
  it("C1 · emitRecoveryCanonicalEvent 를 부르는 catch 는 비어 있지 않고 원인과 함께 표지를 남긴다", () => {
    const src = code(join(RECOVERY, "recovery-coordinator.ts"));
    const sites = tryCatches("recovery-coordinator.ts", src).filter((t) => /\bemitRecoveryCanonicalEvent\s*\(/.test(t.tryBody));
    expect(sites).toHaveLength(1);
    for (const t of sites) {
      // catch 인자가 logBridgeFailure 의 원인 인자로 넘어간다 (back-reference)
      expect(`${t.catchParam}\n${t.catchBody}`).toMatch(/^(\w+)\n[\s\S]*\blogBridgeFailure\([\s\S]*?,\s*\1\s*\)/);
    }
  });
});
