/**
 * #approver-routing-validation-error-i18n — approval cluster validation
 * message i18n helper.
 *
 * canonical truth = single message catalog (ko default + en fallback).
 * 향후 ja / zh 등 확장 시 본 file 의 MESSAGES record 만 추가.
 *
 * caller 가 getApprovalValidationMessage(key, lang?) 호출:
 *   - lang 미명시 또는 미지원 → ko (한국어 default)
 *   - lang 지원 (ko / en) → 해당 lang
 *
 * 직전 cluster (§11.209d-approver-routing) 의 hardcoded 한국어 message
 * 를 단일 source 로 통합. drift 차단 lock.
 */

export type ApprovalValidationMessageKey =
  | "INVALID_THRESHOLD_ORDER"
  | "APPROVAL_LIMIT_EXCEEDED"
  | "APPROVER_NOT_FOUND"
  | "APPROVAL_POLICY_NOT_ENABLED"
  | "DUPLICATE_PENDING_REQUEST";

export type ApprovalValidationLocale = "ko" | "en";

const MESSAGES: Record<
  ApprovalValidationLocale,
  Record<ApprovalValidationMessageKey, string>
> = {
  ko: {
    INVALID_THRESHOLD_ORDER: "저액 임계치는 고액 임계치 이하여야 합니다.",
    APPROVAL_LIMIT_EXCEEDED:
      "결재 한도를 초과한 결재 요청입니다. 다음 결재자에게 자동 escalation 됩니다.",
    APPROVER_NOT_FOUND:
      "결재자가 미설정 상태입니다. 워크스페이스에 ADMIN 권한 사용자를 추가해 주세요.",
    APPROVAL_POLICY_NOT_ENABLED:
      "결재 정책이 활성화되지 않은 플랜입니다. R&D Operations 또는 Enterprise 플랜으로 업그레이드 후 사용 가능합니다.",
    DUPLICATE_PENDING_REQUEST: "이미 결재 대기 중인 요청이 있습니다.",
  },
  en: {
    INVALID_THRESHOLD_ORDER:
      "Low threshold must be less than or equal to high threshold.",
    APPROVAL_LIMIT_EXCEEDED:
      "Approval limit exceeded. Request will be escalated to the next approver.",
    APPROVER_NOT_FOUND:
      "No approver assigned. Please add an ADMIN user to this workspace.",
    APPROVAL_POLICY_NOT_ENABLED:
      "Approval policy is not enabled on this plan. Upgrade to R&D Operations or Enterprise to enable.",
    DUPLICATE_PENDING_REQUEST: "An approval request is already pending.",
  },
};

const DEFAULT_LOCALE: ApprovalValidationLocale = "ko";

/**
 * key + lang → message string. lang 미지원 시 ko fallback.
 *
 * @example
 *   getApprovalValidationMessage("INVALID_THRESHOLD_ORDER")
 *   → "저액 임계치는 고액 임계치 이하여야 합니다."
 *
 *   getApprovalValidationMessage("APPROVER_NOT_FOUND", "en")
 *   → "No approver assigned. ..."
 */
export function getApprovalValidationMessage(
  key: ApprovalValidationMessageKey,
  lang?: ApprovalValidationLocale,
): string {
  const effective = lang && lang in MESSAGES ? lang : DEFAULT_LOCALE;
  return MESSAGES[effective][key];
}

/**
 * Accept-Language header 또는 user.locale 에서 supported locale 추출.
 * unsupported → ko default fallback.
 */
export function resolveApprovalLocale(
  acceptLanguageHeader: string | null | undefined,
): ApprovalValidationLocale {
  if (!acceptLanguageHeader) return DEFAULT_LOCALE;
  const lower = acceptLanguageHeader.toLowerCase();
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}
