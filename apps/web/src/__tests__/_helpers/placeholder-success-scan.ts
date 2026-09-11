/**
 * placeholder success 판별기 · §placeholder-success-gate P2 (2026-09-11)
 *
 * CLAUDE.md Product Constraints 「placeholder success 금지」의 집행 도구.
 * 판별식(347069ce 에서 재현 가능하게 정의한 것을 그대로 옮겼다):
 *   변경 핸들러(POST · PUT · PATCH · DELETE) 본문의 await 중
 *   요청 파싱 · 인증 · 권한 · 스키마 검증을 뺀 것이 0개
 *   AND 2xx JSON 을 반환한다
 *   → 지속 저장이 구조적으로 불가능한데 성공을 말한다.
 *
 * 한계 목록은 sentinel(regression/placeholder-success-gate.test.ts) 머리에 둔다.
 * 로직은 여기 한 벌만 둔다 · em-dash-scan 과 같은 형태(순수 함수 · vitest include 밖).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./em-dash-scan";

export const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;
export type MutatingMethod = (typeof MUTATING_METHODS)[number];

/**
 * 판별식이 "의미 없는 await" 로 치는 것 · 요청 파싱 · 인증 · 권한 · 스키마 검증뿐.
 *
 * 🛑 짧게 유지한다. 실측(2026-09-11, route.ts 307개): 이 목록을 줄이든 늘리든
 *    검출 집합이 같았다 — 실제 신호는 "본문에 의미 있는 await 가 애초에 0" 이다.
 *    목록을 늘리면 오탐이 아니라 **미검출**이 생긴다(진짜 저장이 필터에 걸려 숨는다).
 *    항목을 추가하려면 추가 전후 검출 집합을 함께 남긴다.
 */
export const IGNORED_AWAIT =
  /^await\s+(?:auth\(|(?:request|req)\.(?:json|formData|text)\(|(?:context\.|props\.)?params\b|headers\(|cookies\(|enforceAction\(|[\w.]+\.(?:parse|parseAsync|safeParse|safeParseAsync)\()/;

const HANDLER_DECL = new RegExp(
  `export\\s+async\\s+function\\s+(${MUTATING_METHODS.join("|")})\\s*\\(`,
  "g",
);

/** 스캔하지 않는 선언 형태. 이 형태의 변경 핸들러가 생기면 sentinel 이 RED 로 알린다. */
const UNSCANNED_DECL = new RegExp(
  [
    `export\\s+const\\s+(?:${MUTATING_METHODS.join("|")})\\b`,
    `export\\s+function\\s+(?:${MUTATING_METHODS.join("|")})\\b`,
    `export\\s*\\{[^}]*\\bas\\s+(?:${MUTATING_METHODS.join("|")})\\b`,
  ].join("|"),
  "g",
);

/** 문자열 · 템플릿을 건너뛴다. 닫는 따옴표의 인덱스를 돌려준다. */
function skipString(src: string, start: number): number {
  const quote = src[start];
  for (let j = start + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (quote === "`" && c === "$" && src[j + 1] === "{") {
      const end = matchBalanced(src, j + 1);
      if (end < 0) return src.length;
      j = end;
      continue;
    }
    if (c === quote) return j;
  }
  return src.length;
}

/** src[openIdx] 의 짝이 되는 닫는 괄호 인덱스. 문자열 안의 괄호는 세지 않는다. 못 찾으면 -1. */
export function matchBalanced(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : "";
  if (!close) return -1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export interface HandlerScan {
  file: string;
  method: MutatingMethod;
  /** 본문을 중괄호 균형으로 잘라내지 못했으면 false (판별 불가 = sentinel RED) */
  extracted: boolean;
  meaningfulAwaits: string[];
  successJsonReturns: number;
}

/** 리터럴 4xx · 5xx 상태를 가진 JSON 응답은 실패 응답이다. 나머지는 성공으로 친다. */
function countSuccessJson(body: string): number {
  const re = /\b(?:NextResponse|Response)\.json\(/g;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    const close = matchBalanced(body, open);
    const args = close < 0 ? body.slice(open) : body.slice(open, close + 1);
    if (!/\bstatus\s*:\s*[45]\d\d\b/.test(args)) n++;
  }
  return n;
}

/** 소스 1개의 변경 핸들러를 스캔한다. 주석은 먼저 제거한다(em-dash-scan 의 stripComments). */
export function scanSource(rawSrc: string, file: string): HandlerScan[] {
  const src = stripComments(rawSrc);
  const out: HandlerScan[] = [];
  HANDLER_DECL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HANDLER_DECL.exec(src))) {
    const method = m[1] as MutatingMethod;
    // 인자 괄호를 먼저 균형으로 닫는다 · `{ params }: { params: … }` 의 { 를 본문으로 오인하지 않는다.
    const parenOpen = m.index + m[0].length - 1;
    const parenClose = matchBalanced(src, parenOpen);
    const braceOpen = parenClose < 0 ? -1 : src.indexOf("{", parenClose);
    const braceClose = braceOpen < 0 ? -1 : matchBalanced(src, braceOpen);
    if (braceClose < 0) {
      out.push({ file, method, extracted: false, meaningfulAwaits: [], successJsonReturns: 0 });
      continue;
    }
    const body = src.slice(braceOpen, braceClose + 1);
    const awaits = body.match(/await\s+[^\s;]+/g) ?? [];
    out.push({
      file,
      method,
      extracted: true,
      meaningfulAwaits: awaits.filter((a) => !IGNORED_AWAIT.test(a)),
      successJsonReturns: countSuccessJson(body),
    });
  }
  return out;
}

export interface PlaceholderHit {
  file: string;
  method: MutatingMethod;
}

export const isPlaceholderSuccess = (h: HandlerScan): boolean =>
  h.extracted && h.meaningfulAwaits.length === 0 && h.successJsonReturns > 0;

/** files 는 root 기준 상대경로. hit 의 file 도 같은 상대경로로 돌려준다. */
export function scanFiles(files: string[], root: string): HandlerScan[] {
  return files.flatMap((f) => scanSource(readFileSync(join(root, f), "utf8"), f));
}

export function scanPlaceholderSuccess(files: string[], root: string): PlaceholderHit[] {
  return scanFiles(files, root)
    .filter(isPlaceholderSuccess)
    .map(({ file, method }) => ({ file, method }));
}

/** 스캔하지 않는 형태로 선언된 변경 핸들러 (주석 제외). */
export function unscannedHandlerForms(rawSrc: string): string[] {
  return stripComments(rawSrc).match(UNSCANNED_DECL) ?? [];
}
