/**
 * §em-dash-sweep (2026-09-11) — 신규 추가 파일에만 거는 em dash 구분자 게이트.
 *
 * CLAUDE.md §타이포 구분자의 집행 도구(`em-dash-scan.ts`)를 그대로 import 한다.
 * 판별 로직을 여기서 다시 쓰지 않는다 — 두 벌이 되면 갈라진다.
 *
 * 레거시 6,926건(1,599파일)은 대상이 아니다. 일괄 치환 금지 —
 * 테스트 5,471건은 대부분 조항 원문을 인용한 sentinel 문자열이라
 * 화면 노출 문구가 아니다(판별기가 그 축까지는 못 가른다).
 */
import { readFileSync } from "node:fs";
import { violations } from "../apps/web/src/__tests__/_helpers/em-dash-scan.ts";

const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const hits = violations(readFileSync(f, "utf8"));
  if (!hits.length) continue;
  bad += hits.length;
  console.error(`\n${f}`);
  for (const h of hits) console.error(`  ${String(h.line).padStart(4)}  ${h.text}`);
}
if (bad) {
  console.error(`\n✖ em dash 구분자 ${bad}건 — CLAUDE.md §타이포 구분자`);
  console.error(`  placeholder 단독 표기는 위반이 아니다. 구분자 용법만 걸린다.`);
  process.exit(1);
}
