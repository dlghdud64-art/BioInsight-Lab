/**
 * §scan-unit-guard (호영님 2026-09-05) — 규격 단위와 수량 단위를 섞지 않는다.
 *
 * 사고 실측(같은 문서, 두 스캔):
 *   07:50  specification "4 L" · quantity 6 · unit "EA"   ← 맞다(4L 짜리 6개)
 *   09:52  specification "4 L" · quantity 6 · unit "L"    ← 틀렸다(4L × 6L = 24L 로 읽힌다)
 *   프롬프트에 "specification 은 1개의 포장 규격, quantity 는 그 개수" 를 넣으면서
 *   **unit 이 무엇의 단위인지는 말하지 않았다.** 모델이 "규격 단위를 따라가라" 로 해석했다.
 *   UI 는 이미 `line.unit` 을 쓰고 있었고 무고했다 — 원인은 프롬프트였다.
 *
 * 🛑 그래서 프롬프트만 고치지 않는다 (호영님):
 *   **모델 출력에 의존하는 값은 프롬프트로만 고정하지 않는다.** 프롬프트는 확률을 옮길 뿐이고
 *   다음 호출에서 다시 흔들린다. 코드에 판정을 둔다.
 *   오늘 같은 형태 세 번째다 — 잘림(finishReason 감지) · categorySource(값이 아니라 touched
 *   로 판정) · 이번 unit.
 *
 * 🛑 판정을 버리지 않고 기록한다 (lotSource·categorySource 선례):
 *   폴백이 얼마나 자주 걸리는지 모르면 **프롬프트 수정이 먹었는지도 모른다.**
 */

/** 수량 단위를 어디서 얻었는가. */
export const UNIT_SOURCE = {
  /** 모델이 답한 unit 을 그대로 썼다. */
  MODEL: "MODEL",
  /** 모델의 unit 이 규격 단위와 같아 신뢰할 수 없어 `개` 로 떨어뜨렸다. */
  FALLBACK: "FALLBACK",
} as const;

export type UnitSource = (typeof UNIT_SOURCE)[keyof typeof UNIT_SOURCE];

/**
 * 규격 문자열의 **단위 부분**을 뽑는다. "4 L" → "L" · "500 mL" → "mL" · "0.22um" → "um".
 * 단위를 못 찾으면 null(규격이 숫자뿐이거나 형식이 다르다).
 */
export function specUnit(specification: string | null | undefined): string | null {
  const s = (specification ?? "").trim();
  if (!s) return null;
  // 뒤쪽의 비숫자 토큰 — 숫자·공백·소수점을 지운 나머지.
  const m = s.match(/([a-zA-Z가-힣]+)\s*$/);
  return m ? m[1] : null;
}

export interface QuantityDisplay {
  /** 화면에 그대로 쓰는 문자열. */
  text: string;
  /** 수량 단위의 출처 — canonical 에 남긴다. */
  unitSource: UnitSource;
  /** 실제로 채택한 수량 단위. */
  resolvedUnit: string;
}

/**
 * `규격 × 수량` 을 한 줄로 만든다.
 *
 * 🔑 `6 EA` 만도 `4 L` 만도 안 된다 — **관계**라야 총량이 보인다(호영님 2026-09-05).
 *    `6 EA` 하나만 보여줬을 때 호영님도 operator 도 정답을 오인식으로 읽었다.
 *
 * 🛑 곱셈 좌우는 **다른 출처**다. 좌 = specification, 우 = unit.
 *    같은 출처에서 오면 `4 L × 6 L` 이 되어 24L 처럼 읽힌다.
 */
export function formatQuantityWithSpec(args: {
  specification: string | null | undefined;
  quantity: number;
  unit: string | null | undefined;
}): QuantityDisplay {
  const spec = (args.specification ?? "").trim();
  const rawUnit = (args.unit ?? "").trim();
  const su = specUnit(spec);

  // 모델의 unit 이 규격 단위와 같으면 신뢰하지 않는다 — 이번 결함의 형태.
  //   "50 EA × 4 EA" 도 여기 걸려 "50 EA × 4개" 가 된다. 그게 더 정확하다 —
  //   왼쪽은 포장 단위, 오른쪽은 낱개 수량이라 같은 라벨을 쓰면 안 된다(호영님 판단).
  const collides =
    rawUnit !== "" && su !== null && rawUnit.toLowerCase() === su.toLowerCase();
  const useModel = rawUnit !== "" && !collides;

  const resolvedUnit = useModel ? rawUnit : "개";
  const unitSource = useModel ? UNIT_SOURCE.MODEL : UNIT_SOURCE.FALLBACK;
  const count = useModel ? `${args.quantity} ${resolvedUnit}` : `${args.quantity}개`;

  return {
    text: spec ? `${spec} × ${count}` : count,
    unitSource,
    resolvedUnit,
  };
}
