/**
 * §ocr-output-budget (호영님 2026-09-05, ①) — 출력 예산을 thinking 과 나눈다.
 *
 * 사고 실측 — **④가 ①을 악화시켰다**:
 *
 * | 시점 | rawText 길이 | 결과 |
 * | :--- | :--- | :--- |
 * | ④ 이전 4품목 | 1094 | 한 번 잘림 · 한 번 통과(경계선) |
 * | ④ 이후 4품목 | 1534 | **잘림**(finishReason=MAX_TOKENS 실측) |
 *
 *   `lotNumber`·`expiryDate` 자리를 만들자 출력이 **40% 길어져 경계가 내려왔다.**
 *   자리를 만든 것은 옳았다(Lot 이 canonical 에 닿는 유일한 경로다). 대가가 이것이다.
 *   ⇒ **스키마에 필드를 추가하는 것은 출력 예산의 소비이기도 하다.**
 *
 * 순서 (호영님):
 *   1순위 `thinkingBudget: 0` — gemini-2.5-flash 는 thinking 토큰이 `maxOutputTokens` 를
 *     **함께 먹는다.** 예산만 늘리고 thinking 이 먹으면 같은 자리로 돌아온다.
 *   2순위 `maxOutputTokens` 상향 — 실측 기반 산정(아래).
 *   3순위(유지) `finishReason` 감지 — 예산을 아무리 늘려도 20품목 명세서는 온다.
 *     감지가 **마지막 방어선**이다(§ocr-parse-failure).
 *
 * ⚠️ thinkingBudget 조정이 인식 품질을 떨어뜨릴 수 있다. 같은 4품목으로 전후 대조해
 *   items 정확도가 유지되는지 실측한다. 떨어지면 예산 상향만으로 가고 그 사실을 기록한다.
 */

/**
 * thinking 토큰 예산.
 *
 * 0 = 끄기. 구조화 추출은 **표를 JSON 으로 옮기는 작업**이라 추론 여지가 적고,
 * 그 예산이 출력에서 그대로 빠진다. 품질 저하가 실측되면 이 값만 올린다.
 */
export const OCR_THINKING_BUDGET = 0;

/**
 * 견적·명세서(다품목) 출력 상한.
 *
 * 산정 근거(2026-09-05 실측):
 *   4품목 × 7필드 = 1534자 → **품목당 약 380자**
 *   10품목 = 3800 + vendor·합계 블록 약 300 = 약 4100자
 *   토큰 환산: 한글·JSON 혼합에서 대략 문자수의 0.5~0.7배 → 약 2000~2900 토큰
 *   여유 2배를 두어 8192. thinking 을 끄면 이 전량이 JSON 에 쓰인다.
 *
 * 🛑 이 값으로 잘림이 사라지는 것이 아니다 — 20품목이 오면 또 잘린다.
 *   경계를 밀 뿐이고, 경계 자체는 finishReason 감지가 지킨다.
 */
export const OCR_QUOTE_MAX_OUTPUT_TOKENS = 8192;

/** 라벨 1건 — 필드 7개 고정이라 짧다. 기존 값 유지(회귀 0). */
export const OCR_LABEL_MAX_OUTPUT_TOKENS = 512;

/**
 * Gemini `config` 에 넣을 예산 설정.
 * 두 파서가 같은 정책을 보게 한 곳에서 만든다 — 한쪽만 고치면 그쪽으로 떨어질 때 재발한다.
 */
export function ocrGenerationConfig(maxOutputTokens: number): {
  temperature: number;
  maxOutputTokens: number;
  thinkingConfig: { thinkingBudget: number };
} {
  return {
    temperature: 0.1,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: OCR_THINKING_BUDGET },
  };
}
