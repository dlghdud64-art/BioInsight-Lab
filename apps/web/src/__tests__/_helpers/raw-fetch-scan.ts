/**
 * raw fetch 변이 판별기 · §raw-fetch-mutation (호영님 승인 2026-09-24).
 *
 * 왜 생겼나 (prod 실측 2026-09-24):
 *   예산 상세의 삭제 버튼이 `fetch(..., { method: "DELETE" })` 로 요청을 보냈다.
 *   raw fetch 는 CSRF 토큰을 싣지 않는다. prod 는 full_enforce 라 미들웨어가 403 으로 막았다.
 *   게이트·빌드·원장을 전부 통과했고, 호영님이 버튼을 눌러 보고서야 나왔다.
 *   같은 검사로 저장소를 훑자 알림 읽음 처리(Header.tsx 2곳)도 같은 이유로 prod 403 이었다.
 *
 * 판별 축:
 *   대상  `fetch(` 호출 중 첫 인자가 `/api/` 로 시작하는 리터럴이고 method 가 변이(POST·PUT·PATCH·DELETE)인 것
 *   제외  csrfFetch · apiClient (토큰을 싣는다) · GET (CSRF 는 변이만 보호한다)
 *   제외  CSRF registry 가 exempt 로 등록한 경로 (공개 토큰 페이지 · webhook 등). 판정은 registry 를 그대로 쓴다.
 *   제외  주석 (em-dash-scan 의 stripComments 를 그대로 쓴다)
 *   한계  URL 이나 init 을 변수로 넘기면 판별하지 못한다. 리터럴로 쓴 호출만 본다.
 */
import { stripComments } from "./em-dash-scan";
import { resolveCsrfConfig } from "../../lib/security/csrf-route-registry";

export const MUTATION_METHOD_RE = /\bmethod\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i;

export interface RawFetchHit {
  /** 호출이 시작하는 줄 (1부터) */
  line: number;
  /** 호출이 끝나는 줄 (1부터) */
  endLine: number;
  method: string;
  /** 템플릿 치환부를 `x` 로 바꾼 경로 */
  path: string;
}

/** `(` 위치에서 짝이 맞는 `)` 다음 위치를 찾는다. 문자열 안의 괄호는 세지 않는다. */
function callEnd(s: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
}

export function rawFetchMutations(src: string): RawFetchHit[] {
  const s = stripComments(src);
  const hits: RawFetchHit[] = [];
  const re = /(?<![\w.$])fetch\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const open = s.indexOf("(", m.index);
    const end = callEnd(s, open);
    const args = s.slice(open + 1, end - 1);
    const method = MUTATION_METHOD_RE.exec(args);
    if (!method) continue;
    const lit = /^\s*(["'`])(\/api\/[^"'`]*)\1/.exec(args);
    if (!lit) continue;
    const path = lit[2].replace(/\$\{[^}]*\}/g, "x").split("?")[0];
    if (resolveCsrfConfig(path).protection === "exempt") continue;
    hits.push({
      line: s.slice(0, m.index).split("\n").length,
      endLine: s.slice(0, end).split("\n").length,
      method: method[1].toUpperCase(),
      path,
    });
  }
  return hits;
}
