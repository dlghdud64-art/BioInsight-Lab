/**
 * §audit-integrity-fix — 감사 쓰기 트랜잭션 편입 **변형기**
 *
 * 🛑 이 도구는 게이트를 **첫 실행 전에** 붙였다.
 *    1c-A-2 1차 시도는 게이트 없이 12파일을 일괄 변환해 6파일의 괄호 구조를 깼고,
 *    tsc 가 파싱 실패로 27→21 로 **줄어** 통과처럼 읽혔다.
 *    → "변환 결과를 보고 게이트를 추가하는 순서" 금지(§1.5 변형 — 변형기에도 자기검증).
 *
 * 게이트 3중:
;  *   1  TS 파서 parseDiagnostics  파일별 구문 (node --check 는 타입스트리핑이라 부적합)
 *   2  AST 토큰 보존 대조     ← 핵심. 파싱되는 잘못된 변환을 잡는다
 *   3  tsc 파일 분포 대조     감소도 RED (검사 중단일 수 있다)
 *
 * 자기검증: 의도적으로 깨진 변환으로 게이트 1·2 각각 RED 확인 + 정상 파일 오탐 0.
 */
const fs = require('fs');
const { execSync } = require('child_process');
const ts = require('typescript');

const W = __dirname + '/';

// ── 공통 유틸 ────────────────────────────────────────────────
function closeParen(s, i) {
  let d = 0, j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') { const q = c; j++; while (j < s.length && s[j] !== q) { if (s[j] === '\\') j++; j++; } }
    else if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return j; }
    j++;
  }
  return -1;
}
/** 식별자·리터럴 텍스트의 **다중집합**. 내용 손실 탐지용. */
function tokens(src) {
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  (function walk(n) {
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPropertyAccessExpression(n) === false && n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      out.push(n.getText ? n.getText() : String(n.text));
    }
    n.forEachChild(walk);
  })(sf);
  return out;
}
function multisetDiff(a, b) {                  // a 에 있는데 b 에 없는 것
  const m = new Map();
  for (const x of b) m.set(x, (m.get(x) || 0) + 1);
  const lost = [];
  for (const x of a) { const c = m.get(x) || 0; if (c === 0) lost.push(x); else m.set(x, c - 1); }
  return { lost, gained: [...m.entries()].flatMap(([k, v]) => Array(v).fill(k)) };
}

// ── 게이트 ───────────────────────────────────────────────────
const ALLOWED_NEW = new Set(['db', 'tx', '$transaction', 'any']);

/**
 * 게이트1 — 구문. **TS 자체 파서**를 쓴다.
 * 🛑 `node --check` 는 부적합했다: Node 의 타입 스트리핑 파서가
 *    `try/catch` 구조 붕괴(TS1472)를 통과시켰다. 1c-A-2 2차 시도에서 3파일을 놓쳤고
 *    잡은 것은 게이트3 이었다. 게이트는 **대상 언어의 파서**여야 한다.
 */
function gate1(pathOrSrc, isSrc) {
  const src = isSrc ? pathOrSrc : fs.readFileSync(pathOrSrc, 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diags = sf.parseDiagnostics || [];
  if (!diags.length) return { ok: true };
  return {
    ok: false,
    why: diags.slice(0, 3).map((d) => {
      const { line } = sf.getLineAndCharacterOfPosition(d.start);
      return `${line + 1}: TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
    }).join(' | '),
  };
}
function gate2(before, after) {
  const b = tokens(before), a = tokens(after);
  if (b.length === 0) return { ok: false, why: 'before 파싱 실패' };
  const { lost, gained } = multisetDiff(b, a);
  // 래핑은 변수명을 재사용한다(안팎 동일 + return). **이미 있던 이름의 중복은 정상**이고,
  // 거부해야 하는 것은 **완전 신규 이름**이다. 손실 판정은 그대로 엄격하게 둔다.
  const known = new Set(b);
  const badGain = [...new Set(gained)].filter((x) => !ALLOWED_NEW.has(x) && !known.has(x));
  if (lost.length) return { ok: false, why: `내용 손실 ${lost.length}: ${[...new Set(lost)].slice(0, 6).join(',')}` };
  if (badGain.length) return { ok: false, why: `허용 밖 신규 토큰: ${badGain.slice(0, 6).join(',')}` };
  return { ok: true, gained: gained.length };
}
function tscDist() {
  let out = '';
  try { execSync('npx tsc --noEmit -p tsconfig.json', { cwd: W, stdio: 'pipe' }); }
  catch (e) { out = (e.stdout || Buffer.from('')).toString(); }
  const dist = {};
  for (const l of out.split('\n')) {
    const m = /^(.+?)\(\d+,\d+\): error TS/.exec(l);
    if (m) dist[m[1]] = (dist[m[1]] || 0) + 1;
  }
  return dist;
}
function gate3(base, now) {
  const files = new Set([...Object.keys(base), ...Object.keys(now)]);
  const 사라짐 = [], 증가 = [];
  for (const f of files) {
    const b = base[f] || 0, n = now[f] || 0;
    if (b > 0 && n === 0) 사라짐.push(f);            // 🛑 감소도 RED — 검사 중단일 수 있다
    if (n > b) 증가.push(`${f} ${b}→${n}`);
  }
  return { ok: 사라짐.length === 0 && 증가.length === 0, 사라짐, 증가 };
}

// ── 변형 ─────────────────────────────────────────────────────
const HELPER = /await\s+(createAuditLog|createActivityLog|createActivityLogServer)\s*\(/g;
const BIZ = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+db\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

function transformOnce(s) {
  const nl = /\r\n/.test(s) ? '\r\n' : '\n';
  for (const m of [...s.matchAll(HELPER)].reverse()) {
    const aOpen = m.index + m[0].length - 1;
    const aEnd = closeParen(s, aOpen);
    if (aEnd < 0) continue;
    if (/,\s*tx\s*$/.test(s.slice(aOpen + 1, aEnd))) continue;      // 이미 편입
    // 🛑 문장 끝은 `;` 검색이 아니라 **닫는 괄호 다음 문자**로 판정한다(1차 실패 원인)
    let aStmtEnd = aEnd + 1;
    if (s[aStmtEnd] === ';') aStmtEnd++;

    const bizAll = [...s.slice(0, m.index).matchAll(BIZ)];
    const b = bizAll[bizAll.length - 1];
    if (!b) continue;
    const bOpen = b.index + b[0].length - 1;
    const bEnd = closeParen(s, bOpen);
    if (bEnd < 0) continue;
    let bStmtEnd = bEnd + 1;
    if (s[bStmtEnd] === ';') bStmtEnd++;

    const between = s.slice(bStmtEnd, m.index);
    if (/await\s+db\.\w+\.(create|update|upsert|delete)/.test(between)) continue;   // 1c-B 축
    if (/\breturn\b|\bif\s*\(/.test(between)) continue;                             // 제어 흐름 포함 → 보류
    // 🛑 블록 경계가 끼면 감싸는 순간 구조가 깨진다 —
    //    업무 쓰기가 **안쪽 try 안**이고 감사 호출이 **그 밖**인 형태(TS1472 3파일의 원인).
    //    변형 대상에서 제외하고 수동으로 넘긴다. 게이트가 아니라 **변형기 자체가** 거른다.
    if (/[{}]/.test(between)) continue;

    const name = b[1];
    const ind = (s.slice(0, b.index).match(/\n([ \t]*)[^\n]*$/) || [, '    '])[1];
    const pad = (t) => t.split('\n').map((l, i) => (i === 0 || !l.trim() ? l : '  ' + l)).join('\n');
    const bizStmt = pad(s.slice(b.index, bStmtEnd).replace('await db.', 'await tx.'));
    const auditStmt = pad(s.slice(m.index, aStmtEnd).replace(/\)\s*;?$/, ', tx);'));

    const block =
      `// §audit-integrity-fix — 업무 쓰기와 감사 쓰기를 한 트랜잭션에 편입.` + nl +
      `${ind}//   ⚠️ 원자성만 바꾼다. 실패 전파는 커밋 2(정의부 rethrow) 소관.` + nl +
      `${ind}const ${name} = await db.$transaction(async (tx: any) => {` + nl +
      `${ind}  ${bizStmt}` + nl +
      (between.trim() ? pad(between.replace(/^[\r\n]+/, '').replace(/\s+$/, '')) + nl : '') +
      `${ind}  ${auditStmt}` + nl + nl +
      `${ind}  return ${name};` + nl +
      `${ind}});`;
    s = s.slice(0, b.index) + block + s.slice(aStmtEnd);
  }
  return s;
}

module.exports = { transformOnce, gate1, gate2, gate3, tscDist, tokens };

// ── 실행 ─────────────────────────────────────────────────────
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log('usage: node _enroll_tx.cjs <files...>'); process.exit(1); }

  // ▶ 자기검증 먼저 — corrupt→RED + 오탐 0
  const CLEAN = `export async function POST(r: any) {\n  try {\n    const updated = await db.user.update({ where: { id }, data: { a: 1 } });\n    await createAuditLog({ userId: id, action: "x" });\n    return NextResponse.json(updated);\n  } catch (e) {\n    return NextResponse.json({}, { status: 500 });\n  }\n}\n`;
  const good = transformOnce(CLEAN);
  const BROKEN = good.replace('return updated;', 'return updated;\n  }');   // 괄호 깨뜨림
  const LOSSY = good.replace(/action: "x"/, '');                            // 파싱은 되지만 내용 손실
  const self = {
    '게이트1 corrupt→RED': gate1(BROKEN, true).ok === false,
    '게이트1 오탐 0': gate1(good, true).ok === true,
    '게이트2 corrupt→RED (내용 손실)': gate2(CLEAN, LOSSY).ok === false,
    '게이트2 오탐 0 (정상 변환)': gate2(CLEAN, good).ok === true,
  };
  console.log('자기검증:', JSON.stringify(self));
  if (Object.values(self).some((v) => !v)) { console.log('🔴 자기검증 실패 — 변형 중단'); process.exit(1); }

  const base = tscDist();
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
  console.log(`기준선 tsc: ${baseTotal}건 / ${Object.keys(base).length}파일`);

  const snap = new Map(), result = [];
  for (const rel of files) {
    const p = W + rel;
    const before = fs.readFileSync(p, 'utf8');
    snap.set(p, before);
    const after = transformOnce(before);
    if (after === before) { result.push({ file: rel, 편입: 0, why: '대상 없음' }); continue; }
    fs.writeFileSync(p, after);
    const g1 = gate1(p), g2 = gate2(before, after);
    result.push({ file: rel, 편입: 1, 게이트1: g1, 게이트2: g2 });
    if (!g1.ok || !g2.ok) {
      for (const [k, v] of snap) fs.writeFileSync(k, v);
      console.log(JSON.stringify({ 중단: `${rel} 게이트 실패 — 전량 복원`, g1, g2 }, null, 2));
      process.exit(1);
    }
  }
  const g3 = gate3(base, tscDist());
  if (!g3.ok) {
    for (const [k, v] of snap) fs.writeFileSync(k, v);
    console.log(JSON.stringify({ 중단: '게이트3 실패 — 전량 복원', g3 }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ result, 게이트3: g3 }, null, 2));
}
