/**
 * §invite-invalidation (2026-09-07) — 조직 화면 쿼리키 **정본**.
 *
 * 🔴 배경: `87d7941b` 이 좌석 게이지의 **소스**를 서버(`assertSeatAvailable`)로 모았는데,
 *    그 값을 **다시 읽을 시점**은 아무도 걸지 않았다. 초대를 만들거나 취소해도
 *    좌석 쿼리가 무효화되지 않아 게이지가 옛 수에 멈춘다(prod 실측 2026-09-07).
 *    🔑 **정본을 하나로 모으면 그 정본을 무효화할 책임도 같이 생긴다.**
 *
 * 🛑 무효화 대상을 호출부에 **나열하지 않는다.** 나열하면 세 번째 mutation 에서 또 빠진다 —
 *    이 저장소에서 이미 두 번 그랬다(자체 셸 8곳의 `lg:pl-64` · `GlobalModal` 마운트).
 *    축이 하나 늘면 여기만 고친다.
 */
import type { QueryClient } from "@tanstack/react-query";

export const orgQueryKeys = {
  /** 조직 멤버 목록 */
  members: (organizationId: string) =>
    ["organization-members", organizationId] as const,
  /** pending 초대 목록 (ADMIN/OWNER 전용 라우트) */
  invites: (organizationId: string) =>
    ["organization-invites", organizationId] as const,
  /** 좌석 수 — 서버 `assertSeatAvailable` 결과(멤버 + pending 초대) */
  seat: (organizationId: string) => ["organization-seat", organizationId] as const,
};

/**
 * **초대 수가 바뀌면 함께 무너지는 축.** 생성·취소 mutation 이 이것 하나를 부른다.
 *
 * 🛑 `members` 는 포함하지 않는다 — 초대는 멤버를 만들지 않는다(수락이 만든다).
 *    무관한 축을 함께 무효화하면 "왜 이게 다시 도나" 를 다음 사람이 추적하게 된다.
 *    수락 흐름이 생기면 그때 별도 함수로 가른다.
 */
export function invalidateInviteScoped(
  queryClient: QueryClient,
  organizationId: string,
): void {
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.invites(organizationId) });
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.seat(organizationId) });
}
