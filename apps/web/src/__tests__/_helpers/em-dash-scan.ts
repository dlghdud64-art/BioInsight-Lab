/**
 * em dash 판별기 — CLAUDE.md §타이포 구분자의 **집행 도구**.
 *
 * 🛑 손으로 세지 말 것. 조항의 판별 방법을 코드로 고정한다.
 *    도구가 조항보다 좁으면 조항이 없는 것과 같다 —
 *    2026-08-16 실측: 선두 라인 주석만 지우는 구현이 **줄 끝 주석**을 놓쳐
 *    `ReorderReviewSheet.tsx` 를 UI 4건으로 셌으나 실제는 2건이었다.
 *
 * 판별 축 (소스 파일 .ts/.tsx):
 *   적용  문자열 리터럴 · JSX 텍스트 안의 화면 노출 문구
 *   제외  라인 주석(선두·후행 모두) · 블록 주석 · JSX 주석
 *   제외  placeholder — `—` 단독(빈 값 표기)은 구분자가 아니다.
 *         `{x ?? "—"}` 를 치환하면 quote-management-p1 · rfq-document-redesign 의
 *         **계약이 깨진다.** 조항이 기존 계약을 깨면 그 조항이 틀린 것이다.
 */

export const EM_DASH = "—";

/**
 * 주석을 공백으로 치환한다(줄 수·열 위치 보존).
 * 🛑 문자열 리터럴 안의 `//`(URL 등)는 주석이 아니다 — 상태 기계로 가른다.
 */
export function stripComments(src: string): string {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    let quote: string | null = null;
    let esc = false;
    let cut = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "/" && line[i + 1] === "/") { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join("\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** `—` 단독(빈 값 표기)인가. 앞뒤에 텍스트가 붙으면 구분자다. */
export function isPlaceholder(line: string, index: number): boolean {
  // 따옴표로 감싼 값이 정확히 "—" 인 경우
  const around = line.slice(Math.max(0, index - 2), index + 3);
  if (/["'`]—["'`]/.test(around)) return true;
  // ?? 또는 : 뒤 단독 값
  if (/(\?\?|:)\s*["'`]?—["'`]?\s*[,;)}\]]?\s*$/.test(line.slice(0, index + 2))) return true;
  // §main-dashboard-p0-honesty 2026-09-20 — JSX 텍스트 노드 단독.
  //   실측 오탐: spend-trend-card.tsx `<p className="…">—</p>` 를 구분자로 분류했다.
  //   조항은 "문자열 전체가 — 이면 placeholder" 라고 적고 있고, JSX 텍스트 노드도 같은 형태다.
  //   판별기가 조항보다 **넓으면** 멀쩡한 구현이 RED 가 된다 — 좁은 경우와 같은 무게의 결함이다.
  if (/>\s*—\s*</.test(line.slice(Math.max(0, index - 40), index + 40))) return true;
  return false;
}

export interface EmDashHit {
  line: number;
  text: string;
  kind: "separator" | "placeholder";
}

/** 소스 1개의 em dash 를 판별해 분류한다. 주석분은 애초에 제외된다. */
export function scanEmDash(src: string): { total: number; comments: number; hits: EmDashHit[] } {
  const raw = src.split("\n");
  const stripped = stripComments(src).split("\n");
  const total = (src.match(/—/g) ?? []).length;
  const hits: EmDashHit[] = [];
  stripped.forEach((l, i) => {
    let idx = l.indexOf(EM_DASH);
    while (idx >= 0) {
      hits.push({
        line: i + 1,
        text: raw[i].trim(),
        kind: isPlaceholder(l, idx) ? "placeholder" : "separator",
      });
      idx = l.indexOf(EM_DASH, idx + 1);
    }
  });
  const inCode = hits.length;
  return { total, comments: total - inCode, hits };
}

/** 조항 위반분 = 구분자 용법만. placeholder 는 제외. */
export const violations = (src: string) => scanEmDash(src).hits.filter((h) => h.kind === "separator");

/**
 * §em-dash-added-lines (2026-09-22) — `git diff -U0` 출력 → 파일별 "추가된 줄 번호".
 *
 * 왜 여기 있나: 판별(무엇이 위반인가)과 범위(어느 줄을 보는가)가 이 게이트의 두 축이고,
 *   둘이 갈라지면 또 어긋난다. 정본을 한 파일에 둔다.
 *
 * 왜 줄 단위인가: 레거시 6,926건(1,599파일)이 있다. 파일 전체를 걸면 그 파일을 건드리는
 *   순간 전부 RED 가 된다. **이번 커밋이 새로 들여오는 것만** 막는다.
 */
export function parseAddedLines(diffText: string): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  let file = "";
  let next = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) {
      const p = line.slice(6).trim();
      file = /\.(ts|tsx)$/.test(p) ? p : "";
      continue;
    }
    if (!file) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      next = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (!map.has(file)) map.set(file, new Set());
      map.get(file)!.add(next);
      next += 1;
    }
  }
  return map;
}
