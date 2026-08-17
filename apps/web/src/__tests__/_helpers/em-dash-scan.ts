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
