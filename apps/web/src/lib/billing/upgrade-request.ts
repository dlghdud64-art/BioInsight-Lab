/**
 * §billing-redesign P5: 업그레이드 요청(영업팀 문의) 규칙. 순수모듈이다.
 *
 * 왜 새 수신함을 파지 않는가: 결제(Stripe)가 아직 연동되지 않아 이 버튼의 실제 역할은
 *   "영업팀 연락" 이고, `POST /api/support/inquiry` 가 이미 그 인입을 받는다.
 *   경로를 새로 파면 문의 수신함이 둘로 갈라져 canonical 이 깨진다.
 *
 * 🛑 클라이언트 검증은 **서버가 실제로 거절하는 것**과 같아야 한다.
 *   2026-09-10 실측(app/api/support/inquiry/route.ts):
 *     name    trim 후 비어 있으면 400
 *     email   문자열이고 "@" 를 포함하지 않으면 400
 *     message trim 후 10자 미만이면 400
 *     같은 이메일 5분 내 재요청은 429 (성공으로 덮으면 안 되는 응답)
 *   느슨하면 사용자가 400 을 받고, 빡빡하면 보낼 수 있는 요청을 막는다.
 *
 * 🛑 inquiryType 은 "pricing" 리터럴 고정. 라우트는 미허용 값을 조용히 "service" 로
 *   폴백하므로, 오타가 나면 에러 없이 잘못된 분류로 쌓인다.
 */

/** 라우트의 VALID_INQUIRY_TYPES 중 "가격·플랜". 업그레이드 요청은 항상 이 값이다. */
export const UPGRADE_INQUIRY_TYPE = "pricing";

/** 서버와 같은 하한. 여기 숫자가 바뀌면 sentinel 이 route.ts 와 대조해 잡는다. */
export const MESSAGE_MIN_LENGTH = 10;

export interface UpgradeRequestForm {
  name: string;
  email: string;
  message: string;
}

export type UpgradeRequestValidation =
  | { ok: true }
  | { ok: false; field: "name" | "email" | "message"; reason: string };

export function validateUpgradeRequest(form: UpgradeRequestForm): UpgradeRequestValidation {
  if (!form.name.trim()) {
    return { ok: false, field: "name", reason: "이름 또는 기관명을 입력해 주세요." };
  }
  if (!form.email.trim() || !form.email.includes("@")) {
    return { ok: false, field: "email", reason: "올바른 이메일 주소를 입력해 주세요." };
  }
  if (form.message.trim().length < MESSAGE_MIN_LENGTH) {
    return {
      ok: false,
      field: "message",
      reason: `문의 내용을 ${MESSAGE_MIN_LENGTH}자 이상 입력해 주세요.`,
    };
  }
  return { ok: true };
}

/**
 * 기본 문의 문구. 사용자가 지우고 다시 쓸 수 있지만, 비워 두고 보내면 서버가 400 을 낸다.
 * 그래서 기본값은 항상 하한을 넘긴다(빈 상자를 주고 거절당하게 두지 않는다).
 */
export function buildUpgradeMessage(planLabel: string, organizationName?: string | null): string {
  const org = organizationName?.trim();
  const where = org ? `${org} 조직에서 ` : "";
  return `${where}${planLabel} 플랜으로 업그레이드를 검토 중입니다. 도입 절차와 결제 방법을 안내해 주세요.`;
}

/**
 * 서버 응답 -> 화면에 남길 문장.
 * 🛑 429(중복 차단)와 400(검증)은 실패다. 성공 토스트로 덮으면 사용자는 보내지 않은 요청을
 *   보냈다고 믿는다 (placeholder success 금지).
 */
export function describeUpgradeFailure(status: number, serverError?: string): string {
  if (serverError && serverError.trim()) return serverError.trim();
  if (status === 429) return "동일 이메일로 5분 이내 중복 문의는 제한됩니다.";
  if (status === 400) return "입력값을 확인해 주세요.";
  return "요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
