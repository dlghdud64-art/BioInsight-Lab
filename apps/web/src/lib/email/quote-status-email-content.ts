/**
 * §brief-quote-status-email (호영님 2026-06-29) — 견적 상태(완료/취소) 통보 이메일 공유 카피.
 *
 * 단일 소스: 메일러(발송)와 운영 브리핑 미리보기가 **이 모듈의 제목·본문 문구를 공유**한다.
 *   → 미리보기 ≡ 실제 발송 본문(content-honest). 문구를 두 곳에 복제하지 않는다(drift 0).
 *
 * client-safe: 순수 문자열 빌더(서버 전용 import 0) — popup(client) 직접 import 가능.
 * ❌ 가짜 진척/신뢰도 0. 사실값(번호·품목·금액)은 호출부가 canonical 데이터에서 주입.
 */

export type QuoteStatusEmailKind = "completed" | "cancelled";

/** 발송 제목 — 메일러와 미리보기 공통(정확 일치). */
export function quoteStatusEmailSubject(
  kind: QuoteStatusEmailKind,
  quoteNumber: string,
): string {
  return kind === "completed"
    ? `[LabAxis] 견적서가 도착했습니다! (견적번호: #${quoteNumber})`
    : `[LabAxis] 견적 요청 관련 안내 (요청번호: #${quoteNumber})`;
}

/** 본문 핵심 문구(문단 배열) — 메일러 본문과 미리보기가 공유. */
export function quoteStatusEmailBody(
  kind: QuoteStatusEmailKind,
  data: { customerName: string; reason?: string },
): string[] {
  const customerName = data.customerName?.trim() || "고객";
  if (kind === "completed") {
    return [
      `${customerName} 님, 안녕하세요.`,
      "요청하신 견적이 완료되었습니다. 대시보드에서 상세 내용을 확인하시고, 주문을 진행해 주세요.",
    ];
  }
  // cancelled
  return [
    `${customerName} 님, 안녕하세요.`,
    "요청하신 견적을 진행하기 어려운 상황입니다.",
    ...(data.reason?.trim() ? [`사유: ${data.reason.trim()}`] : []),
    "다른 문의사항이 있으시면 언제든지 연락주세요.",
  ];
}
