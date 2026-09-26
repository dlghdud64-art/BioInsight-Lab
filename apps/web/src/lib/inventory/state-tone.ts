/**
 * §inventory-state-tone — 재고 상태 → 신호등 톤. **단일 정본.** (호영님 판정 2026-09-26)
 *
 * 왜 이 파일이 생겼나
 *   같은 사건이 세 색으로 나왔다. KPI·InventoryTable·context-panel 이 **각자 색 맵을 들고 있었다.**
 *     안전재고 미만  KPI `#b91c1c`/`rose-700` · 표 배지 `yellow-500` · 패널 `yellow-100` · 게이지 `yellow-500`
 *     재발주 필요    KPI red · 표 배지 `blue-500`
 *   §11.283a 는 「재주문 = red · 안전재고 미달 = red」 를 잠그고 있었고 CLAUDE.md §9 본문 리스트는
 *   「낮은 재고 = yellow」 라고 적고 있었다 — 조항 안에 두 갈래가 있었다.
 *   색만 맞추면 다음 화면이 또 갈라지므로 **판정을 함수 하나로 옮긴다.**
 *
 * 호영님 판정 — 재고 화면에서 색은 「지금 손대야 하나」 를 말한다.
 *   안전재고는 정의상 재주문을 시작하는 선이므로 그 아래로 내려갔다는 것은 곧 조치가 필요하다는 뜻이다.
 *
 *     red      조치 필요   품절 · 안전재고 미만 · 재주문 필요 · 만료 · 폐기 대상
 *     yellow   주시        만료 임박
 *     emerald  정상        정상
 *
 *   · 상태 배지에서 blue 는 뺀다. 「재발주 필요」 는 red 다(§11.302d-3 이 품절을 blue→red 로 고친 것과 같은 방향).
 *   · 품절과 미달은 **색이 아니라 라벨 문구**로 구분한다.
 *
 * 이 파일이 답하는 것과 답하지 않는 것
 *   답한다      상태 → 톤, 톤 → 클래스. 상태를 말하는 모든 표면이 이것만 부른다.
 *   답하지 않는다 상호작용 색(필터 활성 blue 링 · 버튼 hover) — §9 의 「정보(실행 가능 CTA)」 축이고
 *                상태 축이 아니다. 그쪽을 이 함수로 끌어오지 말 것.
 *
 * 역계약: __tests__/regression/inventory-state-tone-single-source.test.ts
 *   (세 표면에 로컬 상태→색 맵이 남으면 RED · 우회해서 yellow/red 를 직접 쓰면 RED)
 */

export type InventoryTone = "red" | "yellow" | "emerald" | "neutral";

/** 상태 축. 🛑 추가할 때는 위 판정표의 어느 줄인지 정하고 넣는다 — 「일단 neutral」 로 넣지 말 것. */
export type InventoryToneState =
  | "out_of_stock" // 품절 (수량 0)
  | "below_safety" // 안전재고 미만
  | "reorder_needed" // 재주문 필요 (리드타임·소진 기준)
  | "expired" // 만료 (유효기한 경과 · 수량 남음)
  | "disposal_target" // 폐기 대상 · 폐기 완료
  | "expiring_soon" // 만료 임박
  | "needs_review" // 주시 — 보완이 필요하지만 수량·유효기한 축이 아니다 (아래 ⚠️ 참조)
  | "normal" // 정상
  | "unknown"; // 상태 축이 아님 · 판별 불가

/**
 * ⚠️ `needs_review` 는 호영님 판정표에 **없는 줄**이다 — 판정 대기 항목이다.
 *   판정표는 재고 수량·유효기한 축을 정했고, 패널에는 그 축이 아닌 경고 3종이 있다:
 *     보관 조건 불일치(냉동 품목 위치 확인) · 공급사 미지정(재발주 관문) · 위치 미지정.
 *   셋 다 **정본화 이전에도 yellow** 였다(severity high/medium → yellow-100).
 *   red 로 올리면 「조치 필요」 를 내가 넓히는 것이고, neutral 로 내리면 지금 보이는 경고를
 *   내가 약화시키는 것이다. 어느 쪽도 판정 없이 하지 않는다 → **보이는 것을 그대로 유지**하는
 *   yellow 에 둔다. 판정이 오면 이 줄만 옮긴다.
 */

const STATE_TONE: Record<InventoryToneState, InventoryTone> = {
  out_of_stock: "red",
  below_safety: "red",
  reorder_needed: "red",
  expired: "red",
  disposal_target: "red",
  expiring_soon: "yellow",
  needs_review: "yellow",
  normal: "emerald",
  unknown: "neutral",
};

/** 상태 → 톤. 판정은 여기 한 곳에서만 일어난다. */
export function inventoryStateTone(state: InventoryToneState): InventoryTone {
  return STATE_TONE[state] ?? "neutral";
}

export interface InventoryToneClass {
  /** 배지 — bg + text + border */
  badge: string;
  /** 숫자·라벨 텍스트 */
  text: string;
  /** 상태 도트 */
  dot: string;
  /** 큰 카드 배경 (border + bg) */
  card: string;
  /** 외곽선만 */
  border: string;
  /** 게이지·진행 막대 */
  bar: string;
  /** 행 배경 틴트 (정상·중립은 없음) */
  rowTint: string;
}

export const INVENTORY_TONE_CLASS: Record<InventoryTone, InventoryToneClass> = {
  red: {
    badge: "bg-red-100 text-red-700 border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
    card: "border-red-200 bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    rowTint: "bg-red-500/5",
  },
  yellow: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
    card: "border-yellow-200 bg-yellow-50",
    border: "border-yellow-200",
    bar: "bg-yellow-500",
    rowTint: "bg-yellow-500/5",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    card: "border-emerald-200 bg-emerald-50",
    border: "border-emerald-200",
    bar: "bg-emerald-500",
    rowTint: "",
  },
  neutral: {
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    text: "text-slate-500",
    dot: "bg-slate-300",
    card: "border-slate-200 bg-white",
    border: "border-slate-200",
    bar: "bg-slate-200",
    rowTint: "",
  },
};

/** 상태 → 클래스 묶음. 표면은 이것만 부른다. */
export function inventoryToneClass(state: InventoryToneState): InventoryToneClass {
  return INVENTORY_TONE_CLASS[inventoryStateTone(state)];
}

/**
 * 레거시 상태 문자열 → 상태 축.
 *
 * `InventoryTable` 의 `getGroupStatus()` 는 한국어 라벨을 돌려준다(부족 · 만료 · 임박 · 주의 · 폐기 ·
 * 「소진 임박 D-N」 · 재주문 권장 · 정상). 그 라벨이 그 표면의 canonical 입력이므로 **여기서 한 번**
 * 상태 축으로 옮긴다. 표면마다 라벨을 다시 해석하면 그 순간 색이 또 갈라진다.
 *
 * 🛑 문구가 늘면 여기 한 곳만 고친다. 판별 불가는 `unknown` 이고, `unknown` 은 색이 아니라 중립이다
 *    (「판별 못 했다」 를 「정상」 으로 세지 않는다).
 */
export function inventoryStatusLabelToState(status: string | null | undefined): InventoryToneState {
  if (!status) return "unknown";
  const s = status.trim();
  if (s === "만료" || s === "expired") return "expired";
  if (s === "폐기" || s === "discarded") return "disposal_target";
  if (s === "품절" || s === "out_of_stock") return "out_of_stock";
  if (s === "부족" || s === "low") return "below_safety";
  if (s === "재주문 권장" || s.startsWith("소진 임박")) return "reorder_needed";
  if (s === "임박" || s === "expiring") return "expiring_soon";
  /* 「주의」 는 만료 임박 계열 경고다(표 배지의 구 amber 자리) — 주시 축. */
  if (s === "주의" || s === "warning") return "expiring_soon";
  if (s === "정상" || s === "normal" || s === "active") return "normal";
  return "unknown";
}

/**
 * 수량·안전재고 → 상태 축 (게이지·KPI 공용).
 * 🛑 순서가 명제다 — 0 이면 품절이고, 그 다음이 미만이다. 둘 다 red 지만 라벨이 다르다.
 */
export function inventoryQuantityState(
  currentQuantity: number,
  safetyStock: number | null | undefined,
): InventoryToneState {
  if (currentQuantity <= 0) return "out_of_stock";
  if (safetyStock != null && currentQuantity <= safetyStock) return "below_safety";
  return "normal";
}
