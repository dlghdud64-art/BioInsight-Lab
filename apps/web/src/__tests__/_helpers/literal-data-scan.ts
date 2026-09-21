/**
 * §render-literal-data — 렌더 경로의 **코드에 박힌 데이터** 탐지기 (2026-09-21 · 호영님 판정 · 재전수)
 *
 * 왜 다시 만드는가: 1차 전수(2026-09-20 · 27파일)는 **이름 형태**(MOCK_·dummy·sample…)로 셌고,
 * `TEAM_DATA`(「팀별 보기」 탭 전체를 채운 더미 데이터셋)를 놓쳤다. 이름은 증거가 아니다.
 * 그 27은 최소치도 아니고 **신뢰할 수 없는 수**로 무효 처리됐다(호영님).
 *
 * 축 3개 (합집합):
 *   ⓐ 주석 표지 — 더미|dummy|mock|샘플|예시|임시|하드코딩|placeholder|TODO: 실데이터
 *        · broad    : 파일 어디든 주석에 표지가 있다(전수 보고용 · 소음 많음)
 *        · adjacent : 표지 주석이 **모듈 스코프 const 선언 바로 위(3줄 이내)**에 있다 ← 래칫 축
 *   ⓑ 모듈 스코프 레코드 배열 — `const X = [ { … }, … ]` (이름 무관 · 본축)
 *        · all  : 모든 레코드 배열(설정표·탭 정의 포함 · 전수 보고용)
 *        · data : 그중 **숫자 값**(`: 123` · `: -15.8`)을 품은 것 ← 래칫 축
 *                 탭/옵션 같은 설정표(`{ id, label, icon }`)는 숫자가 없어 빠지고,
 *                 지어낸 데이터셋(금액·비율·건수)은 숫자가 있어 잡힌다.
 *   ⓒ 이름 — MOCK_* · DUMMY_* · SAMPLE_*
 *
 * 카나리(이 셋을 못 잡으면 결과를 쓰지 않는다): TEAM_DATA(현행) · MOCK_TICKETS(c3f046fb^) · MOCK_STAGES(d03906d1^).
 */
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";

/**
 * 렌더 도달 파일 — app/ 의 page·layout·template·error·loading·not-found 를 뿌리로 import 그래프를 따라간다.
 * 🛑 API route.ts 는 뿌리가 아니다(렌더 경로 축). API 가 지어낸 값을 내려주는 형태는 이 축 밖이다(자기 한계).
 */
export function renderReachableSources(srcRoot: string): Map<string, string> {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) {
      if (n === "node_modules" || n === "__tests__" || n === "__mocks__" || n === "generated") continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n)) out.push(p);
    }
    return out;
  };
  const files = walk(srcRoot);
  const rel = (p: string) => relative(srcRoot, p).split(sep).join("/");
  const byRel = new Set(files.map(rel));
  const srcs = new Map(files.map((f) => [rel(f), readFileSync(f, "utf8")]));
  const resolve = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith("@/")) base = spec.slice(2);
    else if (spec.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(from), spec));
    else return null;
    for (const c of [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"]) if (byRel.has(c)) return c;
    return null;
  };
  const edges = new Map<string, string[]>();
  for (const [r, t] of srcs) {
    const out = new Set<string>();
    for (const m of t.matchAll(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const x = resolve(r, (m[1] || m[2]) as string);
      if (x) out.add(x);
    }
    edges.set(r, [...out]);
  }
  const roots = [...srcs.keys()].filter((r) => /^app\/(.*\/)?(page|layout|template|error|loading|not-found)\.tsx?$/.test(r));
  const reach = new Set<string>();
  const st = [...roots];
  while (st.length) {
    const r = st.pop()!;
    if (reach.has(r)) continue;
    reach.add(r);
    for (const t of edges.get(r) || []) st.push(t);
  }
  return new Map([...reach].sort().map((r) => [r, srcs.get(r)!]));
}

const MARKER = /더미|dummy|mock|샘플|예시|임시|하드코딩|placeholder|TODO:\s*실데이터/i;
const NAME = /\b(?:MOCK|DUMMY|SAMPLE)_[A-Z0-9_]+\b/;
const MODULE_CONST = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/;

export interface LiteralDataHit {
  axis: "a-adjacent" | "b-data" | "c-name";
  line: number;
  name: string;
}

export interface LiteralDataReport {
  hits: LiteralDataHit[];
  /** 전수 보고용(래칫 밖) */
  aBroad: boolean;
  bAll: number;
}

/**
 * 주석만 남긴 사본(코드 자리는 공백) — stripComments 의 여집합. **줄 단위**로 맞춘다:
 * stripComments 는 `//` 주석을 공백으로 채우지 않고 **줄을 자른다**(블록 주석만 공백 치환).
 * 문자 단위로 원문과 대조하면 첫 `//` 뒤부터 어긋난다.
 */
function commentsOnly(src: string): string {
  const s = src.split("\n");
  const t = stripComments(src).split("\n");
  return s
    .map((line, i) => {
      const kept = t[i] ?? "";
      let out = "";
      for (let j = 0; j < line.length; j++) out += j < kept.length && kept[j] === line[j] ? " " : line[j];
      return out;
    })
    .join("\n");
}

/** `[` 위치부터 대응 `]` 까지(문자열 리터럴 안의 괄호는 무시). */
function arrayBlock(code: string, open: number): string {
  let depth = 0;
  let q: string | null = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return code.slice(open, i + 1); }
  }
  return code.slice(open);
}

export function scanLiteralData(src: string): LiteralDataReport {
  const code = stripComments(src);
  const comments = commentsOnly(src);
  const codeLines = code.split("\n");
  const commentLines = comments.split("\n");
  const hits: LiteralDataHit[] = [];
  let bAll = 0;

  // 줄 → 문자 오프셋
  const offsets: number[] = [];
  { let o = 0; for (const l of codeLines) { offsets.push(o); o += l.length + 1; } }

  codeLines.forEach((line, i) => {
    const m = line.match(MODULE_CONST);
    if (!m) return; // 모듈 스코프 = 들여쓰기 0 에서 시작하는 선언만
    const name = m[1];

    // ⓐ adjacent — 선언 위 3줄 안의 주석 표지
    for (let k = Math.max(0, i - 3); k < i; k++) {
      if (MARKER.test(commentLines[k] ?? "")) { hits.push({ axis: "a-adjacent", line: i + 1, name }); break; }
    }

    // ⓑ 레코드 배열
    const rest = line.slice(m[0].length);
    const openRel = rest.indexOf("[");
    if (openRel === -1 || rest.slice(0, openRel).trim() !== "") return;
    const open = offsets[i] + m[0].length + openRel;
    const block = arrayBlock(code, open);
    const inner = block.slice(1).trimStart();
    if (!inner.startsWith("{")) return; // 레코드(객체) 배열만
    bAll++;
    if (/:\s*-?\d+(?:\.\d+)?\s*[,}\n]/.test(block)) hits.push({ axis: "b-data", line: i + 1, name });
  });

  // ⓒ 이름
  codeLines.forEach((line, i) => {
    const m = line.match(NAME);
    if (m) hits.push({ axis: "c-name", line: i + 1, name: m[0] });
  });

  return { hits, aBroad: MARKER.test(comments), bAll };
}
