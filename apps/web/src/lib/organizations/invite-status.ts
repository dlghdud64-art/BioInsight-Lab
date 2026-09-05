/**
 * §invite-flow Phase 3-2 — 초대 상태 판정 (미리보기·수락 공용)
 *
 * 🛑 이 함수가 왜 `route.ts` 가 아니라 여기 있는가 (2026-09-04 실측 사고):
 *    처음에 `api/invites/[token]/route.ts` 에서 export 했더니 **`next build` 가 깨졌다.**
 *    Next 14 App Router 의 route 파일은 `GET`·`POST`·`dynamic` 같은 **정해진 export 만**
 *    허용한다 — 임의 심볼을 내보내면 "not a valid Route export field" 로 빌드가 죽는다.
 *    `tsc --noEmit` 은 이걸 잡지 못한다(타입은 멀쩡하다). 병렬 세션의 빌드가 먼저 깨져서
 *    발견됐다. route 파일은 **핸들러만** 두고, 공유 로직은 lib 으로 뺀다.
 *
 * 판정 순서가 곧 계약이다 — 아래 주석 참조.
 */
export type InviteStatus = "valid" | "revoked" | "expired" | "accepted";

export function inviteStatusOf(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  /* 🔑 순서 주의: **취소가 만료보다 먼저다.** 취소된 초대가 만료도 됐을 때 "만료" 라고
   * 말하면 관리자가 취소한 사실이 화면에서 사라진다 — 수신자는 "기다렸다 다시 받으면 되나"
   * 로 읽지만 실제로는 관리자가 거둬들인 것이다. */
  if (invite.revokedAt) return "revoked";
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() <= Date.now()) return "expired";
  return "valid";
}

/**
 * **pending 초대의 정본 술어.** 좌석 계산(`seats.ts`)과 화면 목록(`GET /invites`)이
 * **같은 조건**을 써야 한다 — 갈리면 "좌석은 찼다는데 목록엔 없다" 가 된다.
 *
 * 🛑 두 곳에 같은 `where` 를 복제해 두면 한쪽만 고쳐진다(2026-09-05 실측: 실제로 복제돼
 *    있었다 — 값은 같았지만 정본이 둘이었다). 여기서 한 번만 만든다.
 *
 * pending = 미수락 · 미취소 · **미만료**. 만료·취소는 좌석을 잡지 않으므로 목록에도 없다.
 */
export function pendingInviteWhere(organizationId: string, now: Date = new Date()) {
  return {
    organizationId,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  } as const;
}
