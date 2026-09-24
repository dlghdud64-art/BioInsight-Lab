/**
 * §raw-fetch-mutation (호영님 승인 2026-09-24) · 이번 커밋이 추가한 줄의 raw fetch 변이를 막는다.
 *
 * 왜 생겼나 (prod 실측 2026-09-24):
 *   예산 삭제 버튼이 raw fetch 로 DELETE 를 보냈고 prod 에서 CSRF 403 이었다.
 *   게이트·빌드·원장을 전부 통과했다. 화면에서 버튼을 눌러 보고서야 나왔다.
 *   변이 요청은 csrfFetch (또는 apiClient) 로만 보낸다.
 *
 * 대상: 신규(A) · 수정(M) 파일에서 이번 커밋이 추가한 줄에 걸친 fetch 호출.
 *   서버 라우트(app/api) 와 테스트는 제외한다. 브라우저에서 미들웨어를 지나는 호출만 본다.
 * 판별은 `raw-fetch-scan.ts` 를 그대로 쓴다. exempt 판정은 CSRF registry 를 그대로 쓴다.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { parseAddedLines } from "../apps/web/src/__tests__/_helpers/em-dash-scan.ts";
import { rawFetchMutations } from "../apps/web/src/__tests__/_helpers/raw-fetch-scan.ts";

const EXCLUDE = /\/app\/api\/|\/__tests__\/|\.(test|spec)\.tsx?$/;

const byFile = parseAddedLines(
  execSync("git diff --cached -U0 --diff-filter=AM -- apps/web/src", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);
let bad = 0;
for (const [file, lines] of Array.from(byFile)) {
  if (EXCLUDE.test(file) || !existsSync(file)) continue;
  // 🛑 워킹트리를 읽는다. pre-commit 0번이 스테이징 = 워킹트리를 이미 보장한다.
  const hits = rawFetchMutations(readFileSync(file, "utf8")).filter((h) => {
    for (let n = h.line; n <= h.endLine; n++) if (lines.has(n)) return true;
    return false;
  });
  if (!hits.length) continue;
  bad += hits.length;
  console.error(`\n${file}`);
  for (const h of hits) console.error(`  ${String(h.line).padStart(4)}  fetch ${h.method} ${h.path}`);
}
if (bad) {
  console.error(`\n✖ raw fetch 변이 ${bad}건 (이번 커밋이 추가한 줄) · §raw-fetch-mutation`);
  console.error(`  raw fetch 는 CSRF 토큰을 싣지 않는다. prod(full_enforce) 에서 403 이 난다.`);
  console.error(`  csrfFetch (@/lib/api-client) 로 바꾼다. 조회(GET) 와 exempt 경로는 대상이 아니다.`);
  process.exit(1);
}
