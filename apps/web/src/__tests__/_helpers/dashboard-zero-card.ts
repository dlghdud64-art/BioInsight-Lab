/**
 * §zero-card-window (2026-09-21 · 릴레이 판정) — 대시보드 0건 표현을 **요소 단위 창**으로 잰다.
 *
 * 왜 헬퍼인가: 같은 명제("0건 카드는 흰 배경 + 점선 테두리")를 센티널 5개 파일 7자리가 물고 있었고,
 * 7자리 **전부** 파일 전체에서 토큰을 grep 하고 있었다. 그 결과 네 겹으로 틀렸다:
 *   ① 주석 "0건 카드 bg-gray-50" 에 걸려 통과(stat-line:202 · pipeline:183)
 *   ② 운영 세션이 그걸 `bg-slate-50` 으로 "고쳤는데" 그건 **아이콘 박스** 토큰이었다(카드가 아님)
 *   ③ 옆 단언 `bg-gray-100 // 비활성 아이콘 박스` 는 stat-line 에서 **상태칩 톤**(CHIP_TONE.idle)에 걸렸고
 *      pipeline 에서는 0건이라 상시 RED 였다
 *   ④ 실제 0건 카드는 `bg-white border-dashed border-slate-200` 이었다 — 아무도 그걸 재지 않았다
 * 처방: **요소 블록으로 창을 좁히고, 0건 분기(삼항의 else)만** 본다. 파일 전체 grep 금지.
 */
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

export type ZeroCardSurface = "stat" | "pipeline";

/** 카드 컨테이너 className 템플릿 — 여는 앵커부터 템플릿 닫힘(`}\``)까지. */
const CARD_ANCHOR: Record<ZeroCardSurface, string> = {
  stat: "block rounded-xl border p-3 md:p-4",
  pipeline: "relative block rounded-xl border p-3",
};

/** 아이콘 박스 className 템플릿 — 같은 방식. 카드와 **다른 요소**다. */
const ICON_ANCHOR = "w-6 h-6 rounded-lg flex-shrink-0";

function templateBlock(code: string, anchor: string): string {
  const start = code.indexOf(anchor);
  if (start < 0) return "";
  const end = code.indexOf("}`}", start);
  return end < 0 ? "" : code.slice(start, end + 3);
}

/** 카드 컨테이너 className 블록(주석 제거본). 못 찾으면 "" — 단언이 RED 로 떨어진다. */
export function zeroCardBlock(src: string, surface: ZeroCardSurface): string {
  return templateBlock(stripComments(src), CARD_ANCHOR[surface]);
}

/** 아이콘 박스 className 블록(주석 제거본). */
export function zeroIconBoxBlock(src: string): string {
  return templateBlock(stripComments(src), ICON_ANCHOR);
}

/** 0건 분기 — 삼항 `active ? A : B` 의 B 문자열 리터럴. 활성 분기 토큰이 대신 매칭하지 못한다. */
export function inactiveBranch(block: string): string {
  const m = block.match(/:\s*"([^"]+)"/);
  return m ? m[1] : "";
}
