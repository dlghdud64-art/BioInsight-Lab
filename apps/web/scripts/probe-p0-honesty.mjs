/**
 * §main-dashboard-p0-honesty — 주입 프로브 (검출력 실증)
 *
 * CLAUDE.md 절차 고정: 「적용 확인 -> 주입 -> RED」
 *   - 치환은 조용히 실패한다. 이 스크립트는 치환 건수가 0이면 ANCHOR MISS 로 즉사한다.
 *   - 앵커 EOL 은 대상 파일에서 읽는다(CRLF 환경 대비).
 *   - 파일로 작성됐다(heredoc / node -e 금지 조항).
 *
 * 사용:
 *   node scripts/probe-p0-honesty.mjs list
 *   node scripts/probe-p0-honesty.mjs inject <id>
 *   node scripts/probe-p0-honesty.mjs restore
 *
 * 그룹 A(행동)는 지금 실행 가능하다 — p0-display.ts 가 이미 존재한다.
 * 그룹 B(구조)는 Phase 2 GREEN 이후에만 유효하다 — 없는 배선은 끊을 수 없다.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BACKUP = join(ROOT, ".probe-backup");

const LIB = "src/lib/dashboard/p0-display.ts";
const STAT_LINE = "src/components/dashboard/stat-line.tsx";
const BUDGET_CARD = "src/components/dashboard/budget-spend-card.tsx";
const PIPELINE = "src/components/dashboard/pipeline.tsx";
const PAGE = "src/app/dashboard/page.tsx";
const MOBILE = "src/components/dashboard/mobile-dashboard-view.tsx";
const SUMMARY_ROUTE = "src/app/api/dashboard/summary/route.ts";
const SURFACES = [STAT_LINE, BUDGET_CARD, PIPELINE, PAGE, MOBILE];

/** 대상 파일의 EOL 을 읽어 앵커를 만든다. */
function eolOf(src) {
  return src.includes(String.fromCharCode(13) + String.fromCharCode(10))
    ? String.fromCharCode(13) + String.fromCharCode(10)
    : String.fromCharCode(10);
}

/** 전량 치환(split-join). 건수를 돌려준다 — 0이면 호출측이 ANCHOR MISS 처리. */
function replaceAll(src, find, into) {
  const parts = src.split(find);
  return { out: parts.join(into), count: parts.length - 1 };
}

const PROBES = {
  // ── 그룹 A: 행동 단언 검출력 (지금 실행 가능) ──────────────────
  "A1-guard-off": {
    desc: "budgetStatDisplay 의 미설정 가드 제거 -> A1 전량 RED 여야 한다",
    edits: [[LIB, "if (!isSet) {", "if (false) {"]],
  },
  "A2-gate-off": {
    desc: "shouldRenderCategoryDonut 의 isSet 게이트 제거 -> A2 첫 케이스 RED",
    edits: [[LIB, "if (!isSet) return false;", "if (false) return false;"]],
  },
  "A3-zero-chip": {
    desc: "0건 칩 필터 무력화 -> A3 dead button 케이스 RED",
    edits: [[LIB, "if ((q?.pending ?? 0) > 0) {", "if ((q?.pending ?? 0) >= 0) {"]],
  },
  "A3-receive-approved-leak": {
    desc: "APPROVED 를 attention 에 합산 -> A3 '입고 조치 필요' RED (§receive-canonical)",
    edits: [
      [
        LIB,
        "const receiveOpen = (r?.awaitingReply ?? 0) + (r?.pendingReview ?? 0);",
        "const receiveOpen = (r?.awaitingReply ?? 0) + (r?.pendingReview ?? 0) + (r?.approved ?? 0);",
      ],
    ],
  },
  "A3-href-drift": {
    desc: "칩 href 를 미검증 라우트로 변경 -> A3 href 집합 RED",
    edits: [[LIB, '"/dashboard/quotes?status=PENDING"', '"/dashboard/quotes?status=OPEN"']],
  },
  "A4-tone-redefine": {
    desc: "p0-display 에 예산 톤 로컬 재정의 주입 -> A4 canonical 단언 RED",
    edits: [
      [
        LIB,
        "export type ChipTone =",
        "export function budTone(r: number) { return r >= 100 ? 'danger' : 'ok'; }\nexport type ChipTone =",
      ],
    ],
  },

  "A5-pace-floor": {
    desc: "일평균 내림 제거 -> A5 내림 단언 RED",
    edits: [[LIB, "Math.floor(safeRemaining / daysLeft)", "safeRemaining / daysLeft"]],
  },
  "A5-negative-leak": {
    desc: "잔여 음수 가드 제거 -> A5 초과 케이스 RED",
    edits: [[LIB, "remainingWon > 0 ? remainingWon : 0", "remainingWon"]],
  },

  // ── 그룹 B: 구조 sentinel 검출력 (Phase 2 GREEN 이후에만 유효) ──
  "B1-import-drop": {
    desc: "StatLine 의 p0-display import 제거 -> B1 RED",
    edits: [[STAT_LINE, "budgetStatDisplay", "budgetStatDisplayXX"]],
    phase2: true,
  },
  "B2-gate-drop": {
    desc: "BudgetSpendCard 의 도넛 게이트 호출 제거 -> B2 RED",
    edits: [[BUDGET_CARD, "shouldRenderCategoryDonut(", "true || zzNoGate("]],
    phase2: true,
  },
  "B3-cta-inject": {
    desc: "미설정 분기에 CTA 주입 -> B3 RED",
    // ⚠️ 앵커는 구현 후 문구로 재확인해야 한다 — 구현이 문구를 바꾸면 프로브가 조용히 무효가 된다
    //    (2026-09-18 실측: T2 가 미설정 분기 문구를 교체하자 옛 앵커가 ANCHOR MISS 로 죽었다).
    edits: [[BUDGET_CARD, "예산 설정은 상단 다음 단계 추천에서 진행합니다.", '<a href="/dashboard/budget">설정</a>']],
    phase2: true,
  },
  "B4-gauge-revive": {
    desc: "Pipeline 에 게이지 분모 부활 -> B4 RED",
    edits: [[PIPELINE, "export function Pipeline(", "const maxTotal = 1;\nexport function Pipeline("]],
    phase2: true,
  },
  "B5-href-kill": {
    desc: "칩 href 를 # 로 교체(dead button) -> B5 RED",
    edits: [[PIPELINE, "href={chip.href}", 'href="#"']],
    phase2: true,
  },
  "B6-fab-revive": {
    desc: "page.tsx 에 FAB 부활 -> B6 RED",
    edits: [
      [
        PAGE,
        "    </div>\n  );\n}",
        "    <OperationalBriefFloatingEntry controls=\"operational-brief-popup\" />\n    </div>\n  );\n}",
      ],
    ],
    phase2: true,
  },
  "B7-amber-sweep": {
    desc: "표면 5파일 전량에 amber 주입 -> B7 amber 단언이 파일마다 RED (주입 범위 = 단언 창의 union)",
    edits: SURFACES.map((f) => [f, "className=", 'data-probe="text-amber-500" className=']),
    phase2: true,
  },
  "B7-emdash-sweep": {
    desc: "표면 5파일 전량 UI 문자열에 em dash 주입 -> B7 em dash 단언이 파일마다 RED",
    edits: SURFACES.map((f) => [f, "className=", 'title="A — B" className=']),
    phase2: true,
  },
  "B8-stretch-drop": {
    desc: "items-stretch 제거 -> B8 RED",
    edits: [[PAGE, "items-stretch", "items-start"]],
    phase2: true,
  },

  // ── 그룹 F: §receive-canonical (summary-contract-p1.test.ts (F)) ─────
  "F1-restock-revive": {
    desc: "입고 소스를 옛 테이블로 되돌림 -> (F)① RED (동시에 ②③④ 도 창을 잃어 RED)",
    edits: [[SUMMARY_ROUTE, "db.receivingDraft.groupBy(", "db.inventoryRestock.groupBy("]],
  },
  "F2-status-drift": {
    desc: "groupBy 의 status 집합에서 APPROVED 탈락 -> (F)② RED (질의끼리 · 화면과 불일치)",
    edits: [
      [
        SUMMARY_ROUTE,
        'by: ["status"],\n          where: { ...receivingOwnerWhere, status: { in: ["AWAITING_REPLY", "PENDING_REVIEW", "APPROVED"] } },',
        'by: ["status"],\n          where: { ...receivingOwnerWhere, status: { in: ["AWAITING_REPLY", "PENDING_REVIEW"] } },',
      ],
    ],
  },
  "F3-scope-narrow": {
    desc: "입고 질의 범위를 본인 단독으로 좁힘 -> (F)③ RED (조직 건이 있어도 '이상 없음')",
    edits: [[SUMMARY_ROUTE, "...receivingOwnerWhere, status:", "userId, status:"]],
  },
  "F4-pipeline-approved-leak": {
    desc: "pipeline attention 에 APPROVED 합산 -> (F)④ RED",
    edits: [
      [
        PIPELINE,
        "attention: (r?.awaitingReply ?? 0) + (r?.pendingReview ?? 0),",
        "attention: (r?.awaitingReply ?? 0) + (r?.pendingReview ?? 0) + (r?.approved ?? 0),",
      ],
    ],
  },
};

/**
 * 소비된 백업(0바이트)은 목록에서 제외한다.
 * 일부 환경(Cowork Linux 셸 · 연결 폴더 삭제 비활성)은 unlink 가 EPERM 이라
 * 디렉터리를 지우지 못한다. 그때는 내용을 비워 "소비됨" 을 표시한다.
 */
function backupPaths() {
  if (!existsSync(BACKUP)) return [];
  return readdirSync(BACKUP).filter((f) => {
    try {
      return statSync(join(BACKUP, f)).size > 0;
    } catch {
      return false;
    }
  });
}

/** 백업 정리 — 삭제 불가 환경에서는 0바이트로 비워 "소비됨" 표시(EPERM 무해화). */
function cleanupBackup() {
  try {
    rmSync(BACKUP, { recursive: true, force: true });
    return;
  } catch {
    /* 연결 폴더 삭제 비활성 환경 */
  }
  try {
    for (const f of readdirSync(BACKUP)) writeFileSync(join(BACKUP, f), "", "utf8");
    console.log("  (백업 디렉터리를 지울 수 없어 내용만 비웠습니다 — .gitignore 등재됨)");
  } catch {
    console.log("  (백업 정리 실패 — .probe-backup 을 직접 지우십시오)");
  }
}

function doInject(id) {
  const p = PROBES[id];
  if (!p) {
    console.error("unknown probe: " + id);
    process.exit(2);
  }
  if (backupPaths().length > 0) {
    console.error("이전 프로브가 복원되지 않았습니다. 먼저 restore 하십시오.");
    process.exit(2);
  }
  mkdirSync(BACKUP, { recursive: true });
  let total = 0;
  for (const [rel, find, into] of p.edits) {
    const abs = join(ROOT, rel);
    const src = readFileSync(abs, "utf8");
    const eol = eolOf(src);
    const f = find.split(String.fromCharCode(10)).join(eol);
    const t = into.split(String.fromCharCode(10)).join(eol);
    const { out, count } = replaceAll(src, f, t);
    if (count === 0) {
      console.error("ANCHOR MISS: " + rel + "  <- " + JSON.stringify(find.slice(0, 60)));
      console.error("치환 0건. 프로브 무효. 앵커를 현재 소스에 맞춰 고치십시오.");
      cleanupBackup();
      process.exit(3);
    }
    writeFileSync(join(BACKUP, rel.split("/").join("__")), src, "utf8");
    writeFileSync(abs, out, "utf8");
    console.log("  주입 " + count + "건  " + rel);
    total += count;
  }
  console.log("\n" + id + " — 총 " + total + "건 주입됨");
  console.log("다음: git diff --stat 으로 적용을 눈으로 확인한 뒤 vitest 를 돌려 RED 를 본다.");
  console.log("끝나면 반드시: node scripts/probe-p0-honesty.mjs restore");
}

function doRestore() {
  const files = backupPaths();
  if (files.length === 0) {
    console.log("복원할 백업 없음 (워킹트리 깨끗).");
    return;
  }
  for (const f of files) {
    const rel = f.split("__").join("/");
    writeFileSync(join(ROOT, rel), readFileSync(join(BACKUP, f), "utf8"), "utf8");
    console.log("  복원 " + rel);
  }
  cleanupBackup();
  console.log("");
  console.log("복원 완료.");
  console.log("🛑 적용 확인은 git diff --stat 만으로 하지 말 것 — 신규(untracked) 파일은 diff 에 안 잡힌다.");
  console.log("   추적 파일: git diff --stat / 신규 파일: grep -c <주입 토큰> <파일>");
}

const [, , cmd, arg] = process.argv;
if (cmd === "list") {
  for (const [id, p] of Object.entries(PROBES)) {
    console.log((p.phase2 ? "[P2] " : "[P1] ") + id.padEnd(20) + p.desc);
  }
} else if (cmd === "inject") doInject(arg);
else if (cmd === "restore") doRestore();
else {
  console.log("usage: node scripts/probe-p0-honesty.mjs list|inject <id>|restore");
  process.exit(1);
}
