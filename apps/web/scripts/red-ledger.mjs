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
// 사용:
//   node scripts/red-ledger.mjs                    # vitest 를 돌려 대조
//   node scripts/red-ledger.mjs --from <json>      # 이미 뜬 vitest json 으로 대조
//   node scripts/red-ledger.mjs --update [--from]  # 원장 갱신(실패 집합 재생성)
//
// 🛑 attribution 이 빈 항목은 `unattributed` 에 둔다. 본문(entries)과 섞지 않는다 —
//    섞으면 "알고 있음" 이 늘어나는 방향으로만 움직여 부채 목록이 된다(CLAUDE.md 예외 목록 조항).
//    P2 종료 조건은 `unattributed` 가 0 이 되는 것이다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

function loadLedger() {
  if (!existsSync(LEDGER)) return { entries: [], unattributed: [] };
  return JSON.parse(readFileSync(LEDGER, "utf8"));
}

const reportPath = FROM ?? runVitest();
const current = extractFailures(reportPath);
const ledger = loadLedger();
const known = new Set([...(ledger.entries ?? []).map((e) => e.id), ...(ledger.unattributed ?? [])]);

if (UPDATE) {
  const keep = (ledger.entries ?? []).filter((e) => current.includes(e.id));
  const keptIds = new Set(keep.map((e) => e.id));
  const next = {
    // 이 파일은 생성물이다. attribution 칸만 사람이 채운다.
    generated: new Date().toISOString(),
    axis: "npx vitest run (전 축)",
    total: current.length,
    howTo: "갱신: node scripts/red-ledger.mjs --update · 대조: node scripts/red-ledger.mjs",
    rule: "entries 는 귀속이 적힌 것 · unattributed 는 아직 모르는 것. 섞지 않는다. P2 종료 조건은 unattributed 0.",
    entries: keep,
    unattributed: current.filter((id) => !keptIds.has(id)),
  };
  mkdirSync(dirname(LEDGER), { recursive: true });
  writeFileSync(LEDGER, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8" });
  console.log(`[red-ledger] 갱신 · 총 ${current.length}건 (귀속 ${keep.length} · 미상 ${next.unattributed.length})`);
  process.exit(0);
}

const added = current.filter((id) => !known.has(id));
const removed = [...known].filter((id) => !current.includes(id)).sort();

console.log(`[red-ledger] 현재 RED ${current.length}건 · 원장 ${known.size}건`);
if (removed.length) {
  console.log(`[red-ledger] 해소 ${removed.length}건 — 원장에서 지우십시오 (node scripts/red-ledger.mjs --update)`);
  for (const id of removed) console.log(`  - ${id}`);
}
if (added.length) {
  console.error(`[red-ledger] 신규 RED ${added.length}건 — 원장에 없는 실패다`);
  for (const id of added) console.error(`  + ${id}`);
  console.error("[red-ledger] 이 커밋이 만든 것인지 먼저 가른다. 원장을 늘려서 닫지 말 것.");
  process.exit(1);
}
console.log("[red-ledger] 신규 0");
