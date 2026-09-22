/**
 * §em-dash-added-lines (호영님 권고 승인 2026-09-22) — **수정 파일의 추가된 줄**에 거는 게이트.
 *
 * 왜 생겼나 (실측 2026-09-22):
 *   `check-em-dash-new-files.ts` 는 **신규 추가 파일(A)** 만 본다.
 *   그래서 기존 파일을 고치며 넣은 em dash 는 아무도 보지 않았다 —
 *   예산 상세 화면의 삭제 모달 문구가 게이트·빌드·원장을 전부 통과해 prod 까지 갔고,
 *   브라우저로 버튼을 눌러 보고서야 나왔다("게이트를 통과했다" 와 "검사받았다" 는 다르다).
 *
 * 왜 파일 전체가 아니라 추가된 줄인가:
 *   레거시 6,926건(1,599파일)이 있다. 파일 전체를 걸면 그 파일을 건드리는 순간 전부 RED 가 된다.
 *   **이번 커밋이 새로 들여오는 것만** 막는다. 기존 em dash 는 건드리지 않는다.
 *
 * 판별은 `em-dash-scan.ts` 를 그대로 쓴다 — 두 벌이 되면 갈라진다(주석 제외 · placeholder 허용).
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { violations, parseAddedLines } from "../apps/web/src/__tests__/_helpers/em-dash-scan.ts";

const byFile = parseAddedLines(
  execSync("git diff --cached -U0 --diff-filter=M -- apps/web/src", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);
let bad = 0;
for (const [file, lines] of Array.from(byFile)) {
  if (!existsSync(file)) continue;
  // 🛑 워킹트리를 읽는다. pre-commit 0번이 스테이징 = 워킹트리를 이미 보장한다.
  const hits = violations(readFileSync(file, "utf8")).filter((h) => lines.has(h.line));
  if (!hits.length) continue;
  bad += hits.length;
  console.error(`\n${file}`);
  for (const h of hits) console.error(`  ${String(h.line).padStart(4)}  ${h.text}`);
}
if (bad) {
  console.error(`\n✖ em dash 구분자 ${bad}건 (이번 커밋이 추가한 줄) — CLAUDE.md §타이포 구분자`);
  console.error(`  기존 줄의 em dash 는 대상이 아니다. 이번에 넣은 것만 걸린다.`);
  console.error(`  구분자는 · 를 쓴다. placeholder 단독 표기는 위반이 아니다.`);
  process.exit(1);
}
