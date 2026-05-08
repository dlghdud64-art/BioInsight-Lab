/**
 * #vendor-email-seed-pilot — pilot vendor identification helper.
 *
 * Vendor.id prefix `vendor-pilot-` 분기로 pilot tenant vendor 를 식별.
 * `apps/web/scripts/pilot/pilot.ts` 의 PILOT_VENDOR_CATALOG 가 explicit
 * `vendor-pilot-*` ID 사용 — cuid() 자동 생성 user-input vendor 와 충돌 0.
 *
 * design intent: pilot 환경에서 실제 SMTP 발송 0 보장. sendEmail 이 본
 * helper 를 호출해 SMTP 단계 skip + audit-only console.log + return.
 */

/** Pilot vendor ID prefix — explicit convention from scripts/pilot/pilot.ts. */
export const PILOT_VENDOR_ID_PREFIX = "vendor-pilot-" as const;

/**
 * Pilot vendor 식별 — id 가 `vendor-pilot-` prefix 인지 확인.
 *
 * - cuid() 자동 생성 ID (예: clt2x9jik0001abc123) 와 충돌 0.
 * - 대소문자 정확 매칭 — `Vendor-Pilot-` 같은 mixed case 는 false.
 * - empty string 은 false (defensive).
 */
export function isVendorPilot(id: string): boolean {
  if (!id) return false;
  return id.startsWith(PILOT_VENDOR_ID_PREFIX);
}
