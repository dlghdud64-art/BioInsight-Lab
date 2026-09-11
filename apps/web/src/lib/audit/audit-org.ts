/**
 * §audit-org-required (호영님 2026-09-11) — 감사가 **어느 조직의 일인지**를 호출자가 정한다.
 *
 * 문제: MutationAuditEvent.orgId 가 예외 없이 null 이었다(enforceAction 167곳 중 조직을 넘기는 곳 0).
 *   그리고 그 null 이 "조직이 없다" 인지 "안 정했다" 인지 구분되지 않았다 — 선택 인자가 만든 결함과 같은 모양.
 *
 * 설계: `complete()` 의 organizationId 를 **필수**로 두고 세 값을 받는다.
 *   string          그 조직의 일
 *   null            조직이 **없는** 일 (명시)
 *   UNRESOLVED_ORG  아직 안 정했다 — 닫는 커밋에서 145곳 일괄. 채울수록 줄고 0 이 완료 신호
 * DB 에는 앞의 둘이 그대로, 셋째는 null + decisionBasis.orgUnresolved=true 로 남는다.
 * 그래서 명시 null 은 이제 "조직이 없다" 만 뜻한다.
 *
 * 🔑 config(enforceAction) 가 아니라 complete() 에서 받는다. 조직 값이 enforceAction 호출 **뒤**에
 *   정해지는 자리가 53/68 이었고 그 53 중 50 은 complete() 앞에 값이 있다(2026-09-11 실측).
 *   config 로 받으려면 조직 조회를 권한 검사 앞으로 옮겨야 한다 — 호영님: "트레이드오프가 아니라 금지".
 *   의미로도 조직은 행동을 시작할 때가 아니라 결과를 기록할 때 확정된다.
 *
 * 🛑 `Symbol.for` 로 만든다. 번들 청크가 모듈을 따로 올려도 같은 기호로 비교된다.
 *   `Symbol()` 이면 모듈 사본마다 달라져, 미들웨어가 기호를 못 알아보고 DB 에 기호를 쓰려다 실패한다.
 */
export const UNRESOLVED_ORG: unique symbol = Symbol.for("audit.org.unresolved");

export type AuditOrganization = string | null | typeof UNRESOLVED_ORG;

/**
 * complete() 가 받은 값을 DB 로 옮긴다. 결코 throw 하지 않는다.
 * undefined(인자 없이 부른 옛 호출 · 테스트) · 빈 문자열 · 기호 · 그 밖의 값은 "안 정했다" 로 읽는다.
 */
export function resolveAuditOrg(raw: unknown): { organizationId: string | null; orgUnresolved: boolean } {
  if (typeof raw === "string" && raw !== "") return { organizationId: raw, orgUnresolved: false };
  if (raw === null) return { organizationId: null, orgUnresolved: false };
  return { organizationId: null, orgUnresolved: true };
}
