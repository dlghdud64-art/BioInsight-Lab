#!/usr/bin/env node
//
// §baseline-red-ledger (2026-09-12) — 기준선 RED 원장. **사람이 적지 않는다.**
//
// 왜: 게이트 보고마다 "기준선 RED N건은 무관하다" 를 사람 손으로 논증해 왔다.
//   그 논증은 비싸고, RED 더미가 커질수록 진짜 회귀가 그 안에 숨는다
//   (실측: csrf exempt 개수 단언이 상쇄로 우연히 GREEN 이었다 · §baseline-red-ledger 파일럿).
//
// 무엇: vitest 실행 결과에서 실패 집합을 뽑아 커밋된 원장과 대조한다.
//   늘면 RED(exit 1) · 줄면 GREEN 이되 "원장에서 지우십시오" 를 알린다.
//   원장은 항상 실행 결과로 갱신한다(--update). 손으로 편집하는 것은 attribution 칸뿐이다.
//
// 🛑 kind 축 (2026-09-12 추가) — **래칫은 원장에 올리지 않는다.**
//   래칫의 존재 이유가 GREEN 을 유지하는 것이다. 기준선 RED 더미에 들어간 래칫은 꺼진 래칫이다.
//   실측: amber-token-ratchet 이 4일간 RED 였고 좁힌 게이트 축 밖이라 아무도 못 봤다
//   (§11.302 amber 금지 위반 1건이 그 안에 숨어 있었다).
//   래칫이 RED 면 등재 대상이 아니라 **즉시 처리 대상**이다 — 이 스크립트는 그때 따로 외친다.
//
// 사용:
//   node scripts/red-ledger.mjs                    # vitest 를 돌려 대조
//   node scripts/red-ledger.mjs --from <json>      # 이미 뜬 vitest json 으로 대조
//   node scripts/red-ledger.mjs --update [--from]  # 원장 갱신(실패 집합 재생성)
//
// 🛑 attribution 이 빈 항목은 `unattributed` 에 둔다. 본문(entries)과 섞지 않는다 —
//    섞으면 "알고 있음" 이 늘어나는 방향으로만 움직여 부채 목록이 된다(CLAUDE.md 예외 목록 조항).
//    P2 종료 조건은 `unattributed` 가 0 이 되는 것이다.
//
// 🛑 수집 실패 축 (2026-09-17 §ledger-uncollected-column) — `uncollectedCensus`
//   entries·unattributed 는 "단언이 깨졌다" 이고, 이 칸은 "테스트가 **애초에 안 돈다**" 이다. 섞지 않는다.
//   왜: 이 스크립트는 처음에 assertionResults 의 failed 만 셌다. 수집 단계에서 죽은 파일은
//     assertion 이 0 이라 원장에도 신규 목록에도 안 나타났고, 게이트는 "신규 0" 이라고 보고했다.
//     2026-08-04 전체 스위트 지도가 이미 41 파일 · 4 원인으로 적어 둔 것을 9/12 원장이 받지 못해 6주간 안 보였다.
//     → 계측기를 새로 만들 때 이전 계측기가 세던 칸을 먼저 세지 않은 결과다.
//   단위는 파일이 아니라 **원인**이다(41 파일 = 4 원인). 원인 분류는 아래 CAUSE_RULES(기계),
//   원인별 판정(verdict)은 원장에 사람이 적고 --update 가 보존한다(attribution 과 같은 지위).
//   🛑 단언 RED 가 있던 파일이 수집 실패로 바뀌면 그 RED 가 "해소" 로 보인다 — 따로 외친다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = join(WEB_ROOT, "docs", "red-ledger.json");

const argv = process.argv.slice(2);
const UPDATE = argv.includes("--update");
const fromIdx = argv.indexOf("--from");
const FROM = fromIdx >= 0 ? argv[fromIdx + 1] : null;

const BS = String.fromCharCode(92);
const rel = (p) => {
  const u = p.split(BS).join("/");
  const i = u.indexOf("/apps/web/");
  return i < 0 ? u : u.slice(i + "/apps/web/".length);
};

// ── kind 판별 (파일명이 아니라 성격으로) ─────────────────────────────
//   래칫 = 기준 수치·목록을 코드에 박아 두고 그것을 넘으면 실패시키는 검사.
//   신호  ① 헤더(앞 40줄)에서 스스로 래칫이라 선언  ② 상한 상수(BASELINE·CEILING·LEGACY·RATCHET·CAP)
//         ③ 상한 판정(toBeLessThanOrEqual · > BASELINE · "늘었다/초과/넘었다")
//   판정  (① && ③) || (② && ③) || ②만 있어도 LEGACY 목록형은 래칫이다
//   🛑 본문 아무 데서나 "ratchet" 을 언급한 것은 래칫이 아니다 — 실측 오탐 1건
//      (mobile-residual-cleanup-5 는 주석에서 amber 래칫을 인용했을 뿐이다).
const CEILING_CONST = /const\s+[A-Za-z_]*(BASELINE|CEILING|LEGACY|RATCHET|CAP)[A-Za-z_]*\s*[:=]/;
const BOUND = /(toBeLessThanOrEqual\(|[>]\s*[A-Za-z_]*(BASELINE|CEILING|CAP)|늘었다|넘었다)/;
const DECLARED_HEADER = /(ratchet|래칫)/i;

const ratchetCache = new Map();
function isRatchetFile(relPath) {
  if (ratchetCache.has(relPath)) return ratchetCache.get(relPath);
  const abs = join(WEB_ROOT, relPath);
  let verdict = false;
  if (existsSync(abs)) {
    const raw = readFileSync(abs, "utf8");
    const header = raw.split("\n").slice(0, 40).join("\n");
    const declared = DECLARED_HEADER.test(header);
    const ceiling = CEILING_CONST.test(raw);
    const bound = BOUND.test(raw);
    verdict = (declared && bound) || (ceiling && bound) || (declared && ceiling);
  }
  ratchetCache.set(relPath, verdict);
  return verdict;
}

/** src 전체에서 래칫 파일을 센다 — 분모 N. "몇 개 중 몇 개가 꺼졌나" 를 말하려면 N 이 필요하다. */
function censusRatchets() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(test|spec)\.tsx?$/.test(e)) {
        const r = full.slice(WEB_ROOT.length + 1).split(sep).join("/");
        if (isRatchetFile(r)) out.push(r);
      }
    }
  };
  walk(join(WEB_ROOT, "src"));
  return out.sort();
}

function runVitest() {
  const out = join(WEB_ROOT, "node_modules", ".cache", "red-ledger-run.json");
  mkdirSync(dirname(out), { recursive: true });
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", "--outputFile", out], {
      cwd: WEB_ROOT,
      stdio: ["ignore", "ignore", "inherit"],
      shell: process.platform === "win32",
    });
  } catch {
    // 실패가 있으면 vitest 는 비정상 종료한다 — 그게 정상 경로다. 리포트만 있으면 된다.
  }
  if (!existsSync(out)) {
    console.error("[red-ledger] vitest 리포트가 생성되지 않았다. 실행 자체가 실패했는지 확인하라.");
    process.exit(2);
  }
  return out;
}

/** vitest json → 실패 식별자 집합 (파일 > 전체 테스트명) */
function extractFailures(jsonPath) {
  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  const ids = [];
  for (const file of report.testResults ?? []) {
    for (const a of file.assertionResults ?? []) {
      if (a.status === "failed") ids.push(`${rel(file.name)} > ${a.fullName}`);
    }
  }
  return ids.sort();
}

/** vitest json → 수집 실패 파일 (status failed · assertion 0). 메시지 첫 줄을 함께 둔다. */
function extractUncollected(jsonPath) {
  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  const out = [];
  for (const file of report.testResults ?? []) {
    if (file.status === "failed" && (file.assertionResults ?? []).length === 0) {
      out.push({ file: rel(file.name), message: String(file.message ?? "").split("\n")[0] });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

// ── 수집 실패 원인 분류 (기계) ─────────────────────────────────────────
//   판정(verdict)은 여기 두지 않는다 — 원장에 사람이 적는다. 여기서는 "같은 원인끼리 묶는다" 만 한다.
//   2026-08-04 지도(메모리 project_full_suite_triage)의 4그룹을 그대로 옮겼다.
const CAUSE_RULES = [
  {
    cause: "ai-pipeline-core-resolve",
    match: (f, m) => f.startsWith("src/lib/ai-pipeline/runtime/__tests__/") && /Cannot find module '\.\.\/core\//.test(m),
  },
  { cause: "empty-suite", match: (_f, m) => /No test suite found/.test(m) },
  { cause: "lib-db-resolve", match: (_f, m) => /Cannot find module '@\/lib\/db'/.test(m) },
  { cause: "missing-test-helper", match: (_f, m) => /Failed to resolve import "[^"]*helpers\//.test(m) },
];

function causeOf(u) {
  const hit = CAUSE_RULES.find((r) => r.match(u.file, u.message));
  // 규칙 밖은 메시지 형태로 묶는다 — 새 원인이 생기면 이름 없는 칸으로 드러난다.
  return hit ? hit.cause : `unclassified: ${u.message.replace(/'[^']*'|"[^"]*"/g, "…").slice(0, 80)}`;
}

function censusUncollected(list, prevCensus) {
  const prevVerdict = new Map((prevCensus?.byCause ?? []).map((c) => [c.cause, c.verdict]));
  const groups = new Map();
  for (const u of list) {
    const c = causeOf(u);
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(u.file);
  }
  const byCause = [...groups.entries()]
    .map(([cause, files]) => ({ cause, verdict: prevVerdict.get(cause) ?? "미판정", count: files.length, files: files.sort() }))
    .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause));
  return { total: list.length, causes: byCause.length, byCause };
}

const fileOf = (id) => id.split(" > ")[0];
const loadLedger = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { entries: [], unattributed: [] });

const reportPath = FROM ?? runVitest();
const current = extractFailures(reportPath);
const ratchetAll = censusRatchets();
const ratchetRed = current.filter((id) => isRatchetFile(fileOf(id)));
const sentinelRed = current.filter((id) => !isRatchetFile(fileOf(id)));
const ledger = loadLedger();
const known = new Set([...(ledger.entries ?? []).map((e) => e.id), ...(ledger.unattributed ?? [])]);
const uncollected = extractUncollected(reportPath);
const uncollectedCensus = censusUncollected(uncollected, ledger.uncollectedCensus);
const uncollectedLine = `수집 실패 ${uncollectedCensus.total}건(원인 ${uncollectedCensus.causes}개)`;

if (UPDATE) {
  const keep = (ledger.entries ?? []).filter((e) => sentinelRed.includes(e.id));
  const keptIds = new Set(keep.map((e) => e.id));
  const next = {
    generated: new Date().toISOString(),
    axis: "npx vitest run (전 축)",
    total: sentinelRed.length,
    kind: "sentinel 만 등재한다 · ratchet 은 등재 대상이 아니라 즉시 처리 대상",
    ratchetCensus: { total: ratchetAll.length, red: [...new Set(ratchetRed.map(fileOf))] },
    howTo: "갱신: node scripts/red-ledger.mjs --update · 대조: npm run red-ledger",
    rule: "entries 는 귀속이 적힌 것 · unattributed 는 아직 모르는 것. 섞지 않는다. P2 종료 조건은 unattributed 0.",
    entries: keep,
    unattributed: sentinelRed.filter((id) => !keptIds.has(id)),
    uncollectedRule: "테스트가 애초에 안 도는 파일(수집 실패). 단위는 원인. verdict 는 사람이 적고 --update 가 보존한다. entries·unattributed 와 섞지 않는다.",
    uncollectedCensus,
  };
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
  console.log(`[red-ledger] 갱신 · sentinel ${sentinelRed.length}건 (귀속 ${keep.length} · 미상 ${next.unattributed.length}) · ${uncollectedLine}`);
  for (const c of uncollectedCensus.byCause) console.log(`  · ${c.cause} ${c.count}건 — ${c.verdict}`);
  console.log(`[red-ledger] 래칫 ${ratchetAll.length}개 중 RED ${new Set(ratchetRed.map(fileOf)).size}개 — 래칫은 원장에 담지 않았다`);
  if (ratchetRed.length) for (const id of ratchetRed) console.log(`  ! ${id}`);
  process.exit(0);
}

const added = sentinelRed.filter((id) => !known.has(id));
const removed = [...known].filter((id) => !sentinelRed.includes(id)).sort();

// 수집 실패 대조 — 파일 단위
const knownUncollected = new Set((ledger.uncollectedCensus?.byCause ?? []).flatMap((c) => c.files));
const nowUncollected = new Set(uncollected.map((u) => u.file));
const newlyUncollected = [...nowUncollected].filter((f) => !knownUncollected.has(f)).sort();
const recollected = [...knownUncollected].filter((f) => !nowUncollected.has(f)).sort();
// 🛑 "해소" 로 보이지만 실제로는 파일이 수집 실패로 바뀌어 단언이 안 돈 것
const vanishedByUncollect = removed.filter((id) => nowUncollected.has(fileOf(id)));
const trulyRemoved = removed.filter((id) => !nowUncollected.has(fileOf(id)));

console.log(`[red-ledger] sentinel RED ${sentinelRed.length}건 · 원장 ${known.size}건 · 래칫 ${ratchetAll.length}개 · ${uncollectedLine}`);
if (trulyRemoved.length) {
  console.log(`[red-ledger] 해소 ${trulyRemoved.length}건 — 원장에서 지우십시오 (node scripts/red-ledger.mjs --update)`);
  for (const id of trulyRemoved) console.log(`  - ${id}`);
}
if (recollected.length) {
  console.log(`[red-ledger] 수집 복구 ${recollected.length}개 파일 — 다시 돈다. 원장 갱신 대상`);
  for (const f of recollected) console.log(`  - ${f}`);
}
let bad = false;
if (vanishedByUncollect.length) {
  bad = true;
  console.error(`[red-ledger] 🛑 해소가 아니다 — 단언 RED ${vanishedByUncollect.length}건이 사라진 이유는 그 파일이 **수집 실패**로 바뀌었기 때문이다`);
  for (const id of vanishedByUncollect) console.error(`  ? ${id}`);
}
if (newlyUncollected.length) {
  bad = true;
  console.error(`[red-ledger] 🛑 새로 수집 실패 ${newlyUncollected.length}개 파일 — 그 파일의 명제가 전부 안 돈다`);
  for (const f of newlyUncollected) console.error(`  + ${f} · ${uncollected.find((u) => u.file === f)?.message ?? ""}`);
}
if (ratchetRed.length) {
  bad = true;
  console.error(`[red-ledger] 🛑 꺼진 래칫 ${new Set(ratchetRed.map(fileOf)).size}개 / 전체 ${ratchetAll.length}개 — 원장 등재 대상이 아니라 즉시 처리 대상이다`);
  for (const id of ratchetRed) console.error(`  ! ${id}`);
}
if (added.length) {
  bad = true;
  console.error(`[red-ledger] 신규 RED ${added.length}건 — 원장에 없는 실패다`);
  for (const id of added) console.error(`  + ${id}`);
  console.error("[red-ledger] 이 커밋이 만든 것인지 먼저 가른다. 원장을 늘려서 닫지 말 것.");
}
if (bad) process.exit(1);
// 🛑 보고 문구에 수집 실패를 **항상** 넣는다 — 칸만 만들고 보고에 안 넣으면 8/04 처럼 또 잊힌다.
console.log(`[red-ledger] 신규 0 · 꺼진 래칫 0 · ${uncollectedLine}`);
