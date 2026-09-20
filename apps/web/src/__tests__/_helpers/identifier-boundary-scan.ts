/**
 * §sentinel-identifier-boundary — 경계 없는 식별자 정규식 탐지기 (2026-09-20 · 릴레이 판정)
 *
 * 무엇을 찾는가: `expect(x).toMatch(/foo/)` 처럼 **패턴 전체가 식별자 한 덩어리**이고
 * 양끝에 경계(`\b` · 구분자 · 호출 괄호)가 없는 양성 단언.
 *
 * 왜 결함인가: 그 식별자를 **개명해도(foo → fooX) 계속 매칭**되므로, "이 배선이 살아 있다" 는
 * 명제를 단언한다고 믿는 검사가 실제로는 아무것도 막지 않는다.
 * 2026-09-20 실측 3건이 그 형태였다(전부 프로브가 잡았다):
 *   · `/useSupportInquiries/`  → 전량 개명에도 GREEN
 *   · `/refetchInquiries\(\)/` → 다른 버튼이 대신 매칭 (이건 창 문제, 별개)
 *   · `/createAuditLog/`       → **주석에도** 걸리고, 동명이인 두 모듈을 못 가른다
 *
 * 처방: 사용 지점의 형태로 묻는다 — `\bfoo\(` · `<Foo` · `foo:` · `from "모듈"` 과 함께.
 * (CLAUDE.md §"X를 쓰는가" 에 grep 으로 답하지 않는다 · §정규식 4원칙 ①)
 *
 * 🛑 이 탐지기는 **양성 단언만** 본다. `not.toMatch(/foo/)` 의 경계 없음은 반대 방향 결함
 *    (과탐 → 계약을 지키는 구현이 RED)이라 처방이 다르다. 섞지 않는다.
 */

import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

/** 패턴 전체가 식별자 한 덩어리인가. 이 형태만 개명에 뚫린다. */
const IDENT_ONLY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** `toMatch(/.../)` · `not.toMatch(/.../)` 한 줄 형태. 여러 줄 정규식은 대상 밖(자기 한계 3). */
const CALL = /(not\.)?toMatch\(\s*\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)\s*\)/g;

export interface BoundaryHit {
  line: number;
  token: string;
  negated: boolean;
}

/** 소스 한 편에서 경계 없는 식별자 단언을 찾는다. 기본은 양성만(negated 제외). */
export function scanIdentifierBoundary(
  src: string,
  opts: { includeNegated?: boolean } = {},
): BoundaryHit[] {
  const hits: BoundaryHit[] = [];
  // 🛑 주석은 단언이 아니다. 주석 제거본을 본다 — 안 그러면 "이 형태를 쓰지 마라" 고
  //    **설명하는 주석**까지 위반으로 잡힌다(실측: 이 탐지기를 쓰는 래칫이 자기 헤더에 걸렸다).
  stripComments(src).split("\n").forEach((line, i) => {
    CALL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CALL.exec(line))) {
      const negated = Boolean(m[1]);
      if (negated && !opts.includeNegated) continue;
      const body = m[2];
      if (!IDENT_ONLY.test(body)) continue;
      // 2자 이하는 의도가 다를 수 있다(단위·축약). 판정 대상에서 뺀다.
      if (body.length < 3) continue;
      hits.push({ line: i + 1, token: body, negated });
    }
  });
  return hits;
}
