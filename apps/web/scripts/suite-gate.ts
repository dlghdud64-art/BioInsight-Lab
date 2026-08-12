/**
 * §test-baseline-debt — 전체 스위트 ratchet 게이트
 *
 * 배경 (2026-08-12):
 *   매 턴 `vitest run src/__tests__/ops` 만 돌리고 "RED 0" 으로 보고해 왔다.
 *   전체를 돌리니 **250 건이 깨져 있었다.** 그리고 그 안에 이 세션이 만든 회귀가
 *   1건 있었다(§11.369-2). **게이트가 부분집합이었다.**
 *
 * 이 게이트가 하는 일 — **245개를 고치는 것이 아니라 회귀를 놓치지 않는 능력을 되찾는 것.**
 *   · 목록 밖 새 실패가 하나라도 있으면 RED (E1 동형)
 *   · 목록에 있는데 지금은 통과하면 RED — 목록에서 빼야 한다 (E2 동형, stale 방지)
 *
 * 사용:
 *   npm run test:gate            # 스위트 실행 + 대조
 *   npm run test:gate -- --update  # 기지선 갱신(의도적일 때만)
 *
 * ⚠️ 한계 (먼저 적어둔다):
 *   · **파일 단위**다. 같은 파일 안에서 실패 assertion 이 바뀌어도 잡지 못한다.
 *     assertion 단위로 잠그면 stale 목록 관리 비용이 245건 교정 비용에 근접한다.
 *   · 스위트 실행이 ~270초다. 커밋마다 돌리기엔 무겁고 **트랙 종료 시점**에 돌린다.
 *   · flaky 테스트는 양방향으로 오판한다(신규 RED / stale 오탐). 발견 시 목록이 아니라
 *     그 테스트를 고쳐야 한다.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..");
const BASELINE = join(WEB_ROOT, "test-baseline.json");
const TMP = join(WEB_ROOT, "_suite-gate.json");

interface Baseline {
  measuredAt: string;
  failingAssertions: number;
  failingFiles: string[];
}

/**
 * git 이 추적하는 파일만 본다.
 *
 * 게이트는 **커밋된 계약**을 측정한다. 로컬 미추적 테스트(작업 중인 파일)가
 * 실패한다고 RED 를 내면 다른 체크아웃과 결과가 갈리고, 기지선이 환경마다 달라진다.
 * (실측: `quote-centerworkwindow-demote-363b.test.ts` 가 미추적 상태로 3건 실패 중)
 */
function trackedFiles(): Set<string> {
  const out = spawnSync("git", ["ls-files", "src"], {
    cwd: WEB_ROOT, shell: true, encoding: "utf8",
  });
  return new Set(
    (out.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  );
}

function runSuite(): { files: string[]; assertions: number; untracked: string[] } {
  const res = spawnSync(
    "npx",
    ["vitest", "run", "--reporter=json", "--outputFile=_suite-gate.json"],
    { cwd: WEB_ROOT, shell: true, stdio: "inherit" },
  );
  if (!existsSync(TMP)) {
    console.error("\n🛑 스위트 산출물이 없습니다. vitest 실행 자체가 실패했습니다.");
    console.error(`   exit=${res.status}`);
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(TMP, "utf8"));
  const tracked = trackedFiles();
  const files = new Set<string>();
  const untracked = new Set<string>();
  let assertions = 0;
  for (const tr of raw.testResults ?? []) {
    const rel0 = String(tr.name ?? "").replace(/\\/g, "/");
    const i = rel0.indexOf("/src/");
    const rel = i >= 0 ? rel0.slice(i + 1) : rel0;
    for (const a of tr.assertionResults ?? []) {
      if (a.status === "failed") {
        if (tracked.has(rel)) {
          files.add(rel);
          assertions += 1;
        } else {
          untracked.add(rel);
        }
      }
    }
  }
  unlinkSync(TMP);
  return { files: [...files].sort(), assertions, untracked: [...untracked].sort() };
}

const update = process.argv.includes("--update");
const { files, assertions, untracked } = runSuite();
if (untracked.length) {
  console.log(`\n⚠️ 미추적 테스트 ${untracked.length} 파일은 게이트에서 제외했습니다(커밋되면 --update).`);
  for (const f of untracked) console.log(`     ? ${f}`);
}

if (update) {
  const prev: Partial<Baseline> = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  writeFileSync(
    BASELINE,
    JSON.stringify({ ...prev, failingAssertions: assertions, failingFiles: files }, null, 1) + "\n",
    "utf8",
  );
  console.log(`\n✅ 기지선 갱신 — ${files.length} 파일 / ${assertions} assertion`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("🛑 test-baseline.json 이 없습니다. --update 로 먼저 생성하십시오.");
  process.exit(2);
}

const base: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const known = new Set(base.failingFiles);
const now = new Set(files);

const fresh = files.filter((f) => !known.has(f));
const fixed = base.failingFiles.filter((f) => !now.has(f));

console.log(`\n── §test-baseline-debt 게이트 ─────────────────`);
console.log(`   기지선 : ${base.failingFiles.length} 파일 / ${base.failingAssertions} assertion (${base.measuredAt})`);
console.log(`   현재   : ${files.length} 파일 / ${assertions} assertion`);

let bad = false;
if (fresh.length) {
  bad = true;
  console.error(`\n🛑 신규 실패 ${fresh.length} 파일 — 회귀입니다.`);
  for (const f of fresh) console.error(`     + ${f}`);
}
if (fixed.length) {
  bad = true;
  console.error(`\n🛑 고쳐졌는데 기지선에 남아 있는 ${fixed.length} 파일 — 목록에서 빼십시오(stale 방지).`);
  for (const f of fixed) console.error(`     - ${f}`);
  console.error(`   npm run test:gate -- --update`);
}
if (bad) process.exit(1);

console.log(`\n✅ 기지선 일치 — 신규 회귀 0, stale 0`);
