/**
 * §ocr-parse-failure (호영님 2026-09-05) — 파싱 실패는 빈 결과가 아니다.
 *
 * 승격된 규칙:
 *   **catch 가 값을 지어내지 않는다.** 실패는 빈 결과가 아니다. 사유를 실어 보내거나,
 *   그럴 수 없으면 던진다. 빈 결과와 실패를 같은 모양으로 만들면
 *   **다음 사람은 원문을 볼 생각을 못 한다.**
 *
 * 이번 사고(2026-09-05 prod 실측):
 *   Lot·유효기간이 있는 7열 명세서를 스캔하니 화면이 `낮은 신뢰도 · 0 품목` 이라고 했다.
 *   그런데 OcrResult.rawText 에는 Gemini 가 제대로 읽은 내용이 있었다 —
 *   `{"vendor":{"name":"한빛랩앤서플라이 주식회사","contactPerson":"김영업", …`
 *   인식은 성공했고 **응답이 1094자에서 잘렸다.** 닫는 `}` 도 닫는 코드펜스도 없다.
 *   → 펜스 정규식이 닫는 펜스를 요구해 매칭 실패 → JSON.parse 실패 → catch 가
 *      전부 null 인 객체로 대체 → 화면은 "0 품목 인식" 이라고 **거짓말**했다.
 *   그 거짓말 때문에 원인 가설을 셋이나 세웠고 전부 틀렸다. 원문이 그 자리에 있었다.
 *
 * 같은 형태를 오늘만 세 번 잡았다(500 catch-all · 스캔 차단 사유 부재 · 이번 파싱).
 * 전역 스캔 결과 56곳이 같은 계열이다 — 이 모듈은 그중 OCR 경로부터 닫는다.
 */

/** 왜 구조화에 실패했는가. 화면이 이 값으로 사용자에게 할 말을 고른다. */
export const PARSE_FAILURE = {
  /** 모델 응답이 상한에 걸려 중간에 끊겼다. 문서가 길수록 확률이 올라간다. */
  TRUNCATED: "TRUNCATED",
  /** 응답은 끝났는데 JSON 이 아니다(형식 이탈·설명문 혼입). */
  MALFORMED: "MALFORMED",
  /** 응답이 비어 있다. */
  EMPTY: "EMPTY",
} as const;

export type ParseFailureCode = (typeof PARSE_FAILURE)[keyof typeof PARSE_FAILURE];

export interface ParseFailure {
  code: ParseFailureCode;
  /** 사용자에게 그대로 보여줄 한 줄. 무엇을 하면 되는지까지 담는다. */
  message: string;
  /** 진단용 — 원문 길이·끝부분 등. 값을 지어내지 않았다는 근거. */
  detail: string;
}

const MESSAGE: Record<ParseFailureCode, string> = {
  TRUNCATED:
    "문서가 길어 인식 결과가 중간에 잘렸습니다 · 품목 수를 줄이거나 나눠서 스캔해 주세요.",
  MALFORMED: "인식 결과를 구조화하지 못했습니다 · 사진을 다시 찍거나 수동으로 입력해 주세요.",
  EMPTY: "인식 결과가 비어 있습니다 · 사진이 흐리거나 문서가 인식되지 않았습니다.",
};

/**
 * 응답이 잘렸는가.
 *
 * 🛑 1순위 근거는 **API 가 주는 finishReason** 이다(호영님 2026-09-05).
 *   `maxOutputTokens` 상향은 수정이 아니라 연기다 — 20품목 명세서가 오면 또 잘린다.
 *   진짜 결함은 API 가 잘렸다고 말해주는데 코드가 안 읽는 것이다.
 *   본문 휴리스틱은 finishReason 을 못 받았을 때의 보조 축일 뿐이다.
 */
export function detectTruncation(args: {
  finishReason?: string | null;
  text: string;
}): boolean {
  const fr = (args.finishReason ?? "").toUpperCase();
  if (fr === "MAX_TOKENS" || fr === "LENGTH") return true;

  // 보조 — 여는 코드펜스만 있고 닫는 펜스가 없다 / 중괄호가 안 닫혔다.
  const t = args.text;
  if (!t) return false;
  const fences = (t.match(/```/g) ?? []).length;
  if (fences === 1) return true;
  const open = (t.match(/\{/g) ?? []).length;
  const close = (t.match(/\}/g) ?? []).length;
  return open > close;
}

/**
 * 코드펜스를 벗긴다.
 *
 * 🛑 **닫는 펜스를 요구하지 않는다.** 구 판본은 /```(?:json)?\s*([\s\S]*?)```/ 로
 *   닫는 펜스를 필수로 봤고, 잘린 응답에서는 매칭 자체가 실패해 펜스 포함 원문이
 *   그대로 JSON.parse 로 넘어갔다. 잘림이 아니었어도 파싱은 실패했을 형태다.
 */
export function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/** 실패 사유를 만든다. 값을 지어내는 대신 **왜 못 만들었는지**를 만든다. */
export function describeParseFailure(args: {
  finishReason?: string | null;
  rawText: string;
  error?: unknown;
}): ParseFailure {
  const raw = args.rawText ?? "";
  if (raw.trim() === "") {
    return { code: PARSE_FAILURE.EMPTY, message: MESSAGE.EMPTY, detail: "응답 길이 0" };
  }
  const truncated = detectTruncation({ finishReason: args.finishReason, text: raw });
  const code = truncated ? PARSE_FAILURE.TRUNCATED : PARSE_FAILURE.MALFORMED;
  const tail = raw.slice(-40).replace(/\s+/g, " ");
  const detail = [
    `finishReason=${args.finishReason ?? "(없음)"}`,
    `길이=${raw.length}`,
    `끝="${tail}"`,
    args.error instanceof Error ? `parse=${args.error.message}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { code, message: MESSAGE[code], detail };
}
