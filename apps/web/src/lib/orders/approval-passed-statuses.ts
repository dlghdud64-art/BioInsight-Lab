/**
 * §pocandidate-root-fix / §pocandidate-creation-flow — 승인 통과 집합 (단일 소스).
 *
 * POCandidateApprovalStatus enum 8값 중 변환 풀 진입이 허용되는 3값
 * (Phase 0 실측 2026-08-04, PLAN_pocandidate-root-fix §12 측정2).
 * 제외 5값 = *_required / *_pending / *_rejected.
 *
 * 소비자: bulk-po route + request/[id]/approve route (두 변환 caller 공용 —
 * 상수 이원화 시 한쪽만 갱신되는 drift 를 막기 위해 여기로 추출).
 */
export const APPROVAL_PASSED_STATUSES = [
  "not_required",
  "externally_approved",
  "in_app_approved",
] as const;
