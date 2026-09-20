/**
 * 블록 창 — sentinel 이 "이 분기 안에" 를 물을 때 쓰는 창 도구.
 *
 * 🛑 고정 폭 슬라이스(`slice(idx, idx+400)`)를 대신한다.
 *   CLAUDE.md 정규식 4원칙 ⑤: payload 에 필드가 하나 늘면 뒤 필드가 창 밖으로 밀려
 *   **계약을 지키는 구현이 RED** 가 된다. 이 저장소에서 같은 형태가 4회 기록됐다
 *   (§receiving-extracted-shape 2회 · §scan-spec-carry 1회 · §main-dashboard-p0-honesty 1회).
 *   창은 길이가 아니라 **구문(중괄호 짝)** 으로 연다.
 *
 * 왜 추출하는가: 같은 루프가 저장소에 20곳 넘게 복사돼 있다(2026-09-20 실측).
 *   복사본마다 경계 조건이 조금씩 다르고, 그 차이가 검출력 차이가 된다.
 *   §main-dashboard-p0-honesty 트랙이 쓰던 4벌을 여기로 모은다.
 *   나머지 복사본 이관은 각 트랙의 몫이다 — 남의 sentinel 을 임의로 바꾸지 않는다.
 */

/**
 * `openIdx` 의 여는 괄호부터 **대응하는** 닫는 괄호까지. 길이에 좌우되지 않는다.
 * 짝을 못 찾으면 그 지점부터 끝까지 돌려준다(창이 비어 단언이 조용히 통과하는 것을 막는다).
 */
export function blockFrom(
  src: string,
  openIdx: number,
  open = "{",
  close = "}",
): string {
  if (openIdx < 0) return "";
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx);
}

/**
 * `token` 이 나온 뒤 **첫 여는 괄호**부터 그 짝까지.
 *   `blockAfter(src, "!isSet")` = 미설정 분기 본문.
 * token 이 없으면 빈 문자열 — 호출측이 `expect(block).not.toMatch(...)` 로만 쓰면
 * 빈 창이 항상 통과하므로, **token 존재를 먼저 단언**하고 쓸 것.
 */
export function blockAfter(
  src: string,
  token: string,
  open = "{",
  close = "}",
): string {
  const i = src.indexOf(token);
  if (i < 0) return "";
  return blockFrom(src, src.indexOf(open, i), open, close);
}

/**
 * `token` 을 포함하는 **가장 가까운 바깥 블록**(역방향 탐색).
 *   `blockEnclosing(src, "font-black tracking-normal", "className={`")` = 그 className 표현식 전체.
 */
export function blockEnclosing(
  src: string,
  token: string,
  openMarker: string,
  open = "{",
  close = "}",
): string {
  const t = src.indexOf(token);
  if (t < 0) return "";
  const m = src.lastIndexOf(openMarker, t);
  if (m < 0) return "";
  return blockFrom(src, src.indexOf(open, m), open, close);
}
